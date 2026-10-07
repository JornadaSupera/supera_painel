import { attachmentError, safeAttachmentName } from "@/lib/attachments";
import { type AutorMensagem, type CondutaAlerta, type StatusAlerta } from "@/lib/enums";
import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type {
  AlertaClinico,
  AnexoMensagem,
  CompromissoAgenda,
  ConversaClinico,
  DesempenhoProfissional,
  MensagemClinico,
} from "@/types/clinico";
import {
  severidadeDoGrau,
  STATUS_ALERTA_POR_CODIGO,
  STATUS_CONVERSA_POR_CODIGO,
  situacaoDoCompromisso,
  TOM_POR_STATUS_ALERTA,
  TOM_POR_STATUS_CONVERSA,
} from "./_clinicalMaps";
import { executar, falhaDe, profissionalDaSessao } from "./_helpers";
import { nomesDePacientes } from "./_patientNames";
import { namesById, professionalNamesQuery, type ProfessionalNameRow } from "./_professionalNames";
import { falhou, janelaDeDias, resumirChat } from "./_summaries";
import { getSupabaseClient } from "./client";
import { paraEspecialidade } from "./mapping";

type SupabaseClientLike = ReturnType<typeof getSupabaseClient>;

/** The professional's current specialties, by id — the ones `claim_conversation` accepts. */
async function areasVigentes(
  supabase: SupabaseClientLike,
  profissionalId: string,
): Promise<Set<string> | ReturnType<typeof falhaDe>> {
  const { data, error } = await supabase
    .from("professional_specialties")
    .select("specialty_id")
    .eq("professional_id", profissionalId)
    .is("ended_at", null);
  if (error) return falhaDe(error);

  return new Set(((data ?? []) as { specialty_id: string }[]).map((linha) => linha.specialty_id));
}

function ehFalha<T>(valor: T | ReturnType<typeof falhaDe>): valor is ReturnType<typeof falhaDe> {
  return Boolean(valor) && typeof valor === "object" && (valor as { error?: unknown }).error != null;
}

/**
 * Painel clínico — leitura recortada pelo profissional da sessão.
 *
 * `read_my_agenda` já devolve só os compromissos do professional_id logado
 * (resolvido no banco, via `private.my_professional_id()`) — nenhum filtro de
 * "quem sou eu" precisa ser passado ou é possível de forjar daqui.
 *
 * A função devolve a linha crua de `appointments`: sem nome de paciente, sem
 * rótulo de tipo ou status. As três hidratações abaixo são chamadas à parte —
 * `read_patient` por paciente distinto no recorte (a janela é um dia ou uma
 * semana; N é pequeno) e uma leitura direta dos dois catálogos, que são
 * SELECT-only para qualquer `authenticated` (mesmo padrão de
 * `appointment_types`/`appointment_statuses` já usado em Configurações).
 */

interface LinhaAppointment {
  id: string;
  patient_id: string;
  title: string;
  appointment_type_id: string | null;
  status_id: string | null;
  starts_at: string;
  ends_at: string;
  location_label: string | null;
  confirmed_at: string | null;
}

export async function getMinhaAgenda(params: {
  de: string;
  ate: string;
  semNomes?: boolean;
}): Promise<ListResult<CompromissoAgenda>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("read_my_agenda", {
      p_from: params.de,
      p_to: params.ate,
    });
    if (error) return falhaDe(error);

    const linhas = (data ?? []) as LinhaAppointment[];
    if (linhas.length === 0) return ok([]);

    const idsPacientes = [...new Set(linhas.map((linha) => linha.patient_id))];
    const idsTipos = [
      ...new Set(linhas.map((linha) => linha.appointment_type_id).filter((id): id is string => Boolean(id))),
    ];
    const idsStatus = [
      ...new Set(linhas.map((linha) => linha.status_id).filter((id): id is string => Boolean(id))),
    ];

    const [nomePorPacienteOuFalha, tiposRes, statusRes] = await Promise.all([
      // Cada nome é uma leitura auditada do paciente: quem só desenha horário e
      // tipo (a visão de mês) não as pede.
      params.semNomes ? Promise.resolve(new Map<string, string>()) : nomesDePacientes(supabase, idsPacientes),
      idsTipos.length
        ? supabase.from("appointment_types").select("id, label").in("id", idsTipos)
        : Promise.resolve({ data: [] as { id: string; label: string }[], error: null }),
      idsStatus.length
        ? supabase.from("appointment_statuses").select("id, code, label").in("id", idsStatus)
        : Promise.resolve({ data: [] as { id: string; code: string; label: string }[], error: null }),
    ]);

    if (ehFalha(nomePorPacienteOuFalha)) return nomePorPacienteOuFalha;
    const nomePorPaciente = nomePorPacienteOuFalha;

    if (tiposRes.error) return falhaDe(tiposRes.error);
    if (statusRes.error) return falhaDe(statusRes.error);

    const labelPorTipo = new Map((tiposRes.data ?? []).map((tipo) => [tipo.id, tipo.label]));
    const statusPorId = new Map((statusRes.data ?? []).map((status) => [status.id, status]));

    const compromissos: CompromissoAgenda[] = linhas.map((linha) => {
      const status = linha.status_id ? statusPorId.get(linha.status_id) : undefined;
      const situacao = situacaoDoCompromisso(status, linha.ends_at);
      const tipo = (linha.appointment_type_id && labelPorTipo.get(linha.appointment_type_id)) || "Compromisso";

      return {
        id: linha.id,
        paciente_id: linha.patient_id,
        paciente_nome: nomePorPaciente.get(linha.patient_id) ?? "Paciente",
        titulo: linha.title?.trim() || tipo,
        tipo_label: tipo,
        status_label: situacao.label,
        status_codigo: status?.code ?? null,
        status_tom: situacao.tom,
        inicio: linha.starts_at,
        fim: linha.ends_at,
        local: linha.location_label,
        confirmado_em: linha.confirmed_at,
      };
    });

    return ok(compromissos);
  });
}

/* -------------------------------------------------------------------------
   ALERTAS — fila compartilhada pela equipe, ver types/clinico.ts
   ------------------------------------------------------------------------- */

interface LinhaAlert {
  id: string;
  patient_id: string;
  /** Who wrote the diary entry that raised it — copied to the alert for the queue. */
  source_actor_kind: "patient" | "caregiver";
  symptom_id: string | null;
  diary_entry_id: string | null;
  grade: number;
  status: "open" | "in_progress" | "resolved";
  conduct_kind: "guidance" | "scheduling" | "referral" | null;
  conduct_notes: string | null;
  created_at: string;
  assigned_professional_id: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
}

const CODIGO_POR_STATUS_ALERTA: Record<StatusAlerta, LinhaAlert["status"]> = {
  pendente: "open",
  assumido: "in_progress",
  resolvido: "resolved",
};

const CONDUTA_POR_CODIGO: Record<NonNullable<LinhaAlert["conduct_kind"]>, CondutaAlerta> = {
  guidance: "orientacao",
  scheduling: "agendamento",
  referral: "encaminhamento",
};

const CODIGO_POR_CONDUTA: Record<CondutaAlerta, NonNullable<LinhaAlert["conduct_kind"]>> = {
  orientacao: "guidance",
  agendamento: "scheduling",
  encaminhamento: "referral",
};

export async function listAlertas(params?: {
  status?: StatusAlerta;
  semNomes?: boolean;
}): Promise<ListResult<AlertaClinico>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("read_alerts", {
      p_status: params?.status ? CODIGO_POR_STATUS_ALERTA[params.status] : null,
      p_limit: 200,
      p_before: null,
    });
    if (error) return falhaDe(error);

    const linhas = (data ?? []) as LinhaAlert[];
    if (linhas.length === 0) return ok([]);

    // Who is signed in, to mark the alerts that are theirs. An administrator
    // has no professional profile, and no alert is "theirs".
    const eu = await profissionalDaSessao();
    const meuId = "error" in eu ? null : eu.profissionalId;

    const idsPacientes = [...new Set(linhas.map((linha) => linha.patient_id))];
    const idsSintomas = [
      ...new Set(linhas.map((linha) => linha.symptom_id).filter((id): id is string => Boolean(id))),
    ];
    const idsResponsaveis = [
      ...new Set(
        linhas.map((linha) => linha.assigned_professional_id).filter((id): id is string => Boolean(id)),
      ),
    ];

    const [nomePorPacienteOuFalha, sintomasRes, responsaveisRes] = await Promise.all([
      // Quem só conta os alertas não precisa dos nomes, e cada nome é uma leitura
      // de paciente gravada na trilha.
      params?.semNomes ? Promise.resolve(new Map<string, string>()) : nomesDePacientes(supabase, idsPacientes),
      idsSintomas.length
        ? supabase.from("symptoms").select("id, label, is_psychological").in("id", idsSintomas)
        : Promise.resolve({
            data: [] as { id: string; label: string; is_psychological: boolean }[],
            error: null,
          }),
      idsResponsaveis.length
        ? professionalNamesQuery(supabase, idsResponsaveis)
        : Promise.resolve({ data: [] as ProfessionalNameRow[], error: null }),
    ]);

    if (ehFalha(nomePorPacienteOuFalha)) return nomePorPacienteOuFalha;
    const nomePorPaciente = nomePorPacienteOuFalha;
    if (sintomasRes.error) return falhaDe(sintomasRes.error);
    if (responsaveisRes.error) return falhaDe(responsaveisRes.error);

    const nomePorResponsavel = namesById((responsaveisRes.data ?? []) as ProfessionalNameRow[]);

    const sintomaPorId = new Map((sintomasRes.data ?? []).map((sintoma) => [sintoma.id, sintoma]));

    const alertas: AlertaClinico[] = linhas.map((linha) => {
      const statusApp = STATUS_ALERTA_POR_CODIGO[linha.status];

      return {
        id: linha.id,
        paciente_id: linha.patient_id,
        paciente_nome: nomePorPaciente.get(linha.patient_id) ?? "Paciente",
        sintoma_label: (linha.symptom_id && sintomaPorId.get(linha.symptom_id)?.label) || "Sintoma",
        sintoma_psicologico: Boolean(
          linha.symptom_id && sintomaPorId.get(linha.symptom_id)?.is_psychological,
        ),
        diario_id: linha.diary_entry_id,
        grau: linha.grade,
        severidade: severidadeDoGrau(linha.grade),
        pelo_acompanhante: linha.source_actor_kind === "caregiver",
        status: statusApp,
        status_tom: TOM_POR_STATUS_ALERTA[statusApp],
        conduta_tipo: linha.conduct_kind ? CONDUTA_POR_CODIGO[linha.conduct_kind] : null,
        conduta_notas: linha.conduct_notes,
        atribuido_a: linha.assigned_professional_id
          ? (nomePorResponsavel.get(linha.assigned_professional_id) ?? null)
          : null,
        meu: meuId !== null && linha.assigned_professional_id === meuId,
        criado_em: linha.created_at,
        assumido_em: linha.assigned_at,
        resolvido_em: linha.resolved_at,
      };
    });

    return ok(alertas);
  });
}

/**
 * Assume um alerta em aberto.
 *
 * `claim_alert` exige a permissão `alerts.triage` — sem ela, devolve
 * `insufficient_privilege` (42501), que `falhaDe` traduz para FORBIDDEN. O
 * botão não checa a permissão antes: não há como o cliente saber se ela foi
 * concedida sem perguntar ao banco, e perguntar É chamar a RPC.
 */
export async function assumirAlerta(params: { id: string }): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("claim_alert", { p_alert_id: params.id });
    if (error) return falhaDe(error);
    return okOne(null);
  });
}

/**
 * Designa um alerta em atendimento a outro profissional.
 *
 * Além da permissão `alerts.triage` (`42501`), a função recusa alerta que não
 * está em atendimento (`check_violation`, `23514`) e profissional inativo ou
 * inexistente (`no_data_found`). Cada recusa tem uma frase: a pessoa que clicou
 * precisa saber o que mudou, e não só que "não deu".
 */
export async function designarAlerta(params: {
  id: string;
  profissionalId: string;
}): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("assign_alert", {
      p_alert_id: params.id,
      p_professional_id: params.profissionalId,
    });

    if (error) {
      if (error.code === "42501") {
        return fail(ERROR_CODE.FORBIDDEN, "Designar um alerta exige a permissão de triagem de alertas.", {
          code: error.code,
          message: error.message,
        });
      }
      if (error.code === "23514") {
        return fail(ERROR_CODE.CONFLICT, "Só um alerta em atendimento pode ser designado. Recarregue a fila.", {
          code: error.code,
          message: error.message,
        });
      }
      if (error.code === "P0002") {
        return fail(
          ERROR_CODE.NOT_FOUND,
          "O alerta ou o profissional não existe mais, ou o profissional foi desativado.",
          { code: error.code, message: error.message },
        );
      }
      return falhaDe(error);
    }

    return okOne(null);
  });
}

export async function resolverAlerta(params: {
  id: string;
  conduta: CondutaAlerta;
  notas?: string;
}): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("resolve_alert", {
      p_alert_id: params.id,
      p_conduct_kind: CODIGO_POR_CONDUTA[params.conduta],
      p_conduct_notes: params.notas?.trim() || null,
    });
    if (error) return falhaDe(error);
    return okOne(null);
  });
}

/* -------------------------------------------------------------------------
   CHAT — mesma fila de equipe dos alertas.
   ------------------------------------------------------------------------- */

interface LinhaConversation {
  id: string;
  patient_id: string;
  subject_id: string | null;
  status: "open" | "resolved";
  origin_specialty_id: string | null;
  /** Quem assumiu. `null` enquanto a conversa está na fila. Ausente em bases antigas. */
  assigned_professional_id?: string | null;
  last_message_at: string;
  team_last_read_at: string | null;
}

export async function listConversas(): Promise<ListResult<ConversaClinico>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("read_conversations", {
      p_patient_id: null,
      p_limit: 200,
      p_offset: 0,
    });
    if (error) return falhaDe(error);

    // A fila de cada um. Conversa assumida é de quem assumiu: a leitura ainda a
    // entrega aos colegas, então ela sai daqui. Sem responsável, fica a da própria
    // área ou a sem área: a roteada a outra área só quem é de lá assume
    // (`claim_conversation`), e mostrá-la seria oferecer o que não dá para pegar.
    // A barreira de verdade é do banco. Quem não tem perfil de profissional (o
    // administrador) vê a fila inteira.
    const eu = await profissionalDaSessao();
    const meuId = "error" in eu ? null : eu.profissionalId;

    let minhasAreas: Set<string> | null = null;
    if (meuId) {
      const areas = await areasVigentes(supabase, meuId);
      if (!(areas instanceof Set)) return areas;
      minhasAreas = areas;
    }

    const linhas = ((data ?? []) as LinhaConversation[]).filter((linha) => {
      if (meuId === null || minhasAreas === null) return true;
      if (linha.assigned_professional_id) return linha.assigned_professional_id === meuId;
      return !linha.origin_specialty_id || minhasAreas.has(linha.origin_specialty_id);
    });
    if (linhas.length === 0) return ok([]);

    const idsPacientes = [...new Set(linhas.map((linha) => linha.patient_id))];
    const idsAssuntos = [
      ...new Set(linhas.map((linha) => linha.subject_id).filter((id): id is string => Boolean(id))),
    ];

    const idsEspecialidades = [
      ...new Set(
        linhas.map((linha) => linha.origin_specialty_id).filter((id): id is string => Boolean(id)),
      ),
    ];

    const [nomePorPacienteOuFalha, assuntosRes, especialidadesRes] = await Promise.all([
      nomesDePacientes(supabase, idsPacientes),
      idsAssuntos.length
        ? supabase.from("conversation_subjects").select("id, label").in("id", idsAssuntos)
        : Promise.resolve({ data: [] as { id: string; label: string }[], error: null }),
      idsEspecialidades.length
        ? supabase.from("specialties").select("id, code").in("id", idsEspecialidades)
        : Promise.resolve({ data: [] as { id: string; code: string }[], error: null }),
    ]);

    if (ehFalha(nomePorPacienteOuFalha)) return nomePorPacienteOuFalha;
    const nomePorPaciente = nomePorPacienteOuFalha;
    if (assuntosRes.error) return falhaDe(assuntosRes.error);
    if (especialidadesRes.error) return falhaDe(especialidadesRes.error);

    const labelPorAssunto = new Map((assuntosRes.data ?? []).map((assunto) => [assunto.id, assunto.label]));
    const codigoPorEspecialidade = new Map(
      (especialidadesRes.data ?? []).map((especialidade) => [especialidade.id, especialidade.code]),
    );

    const conversas: ConversaClinico[] = linhas.map((linha) => {
      const statusApp = STATUS_CONVERSA_POR_CODIGO[linha.status];

      return {
        id: linha.id,
        paciente_id: linha.patient_id,
        paciente_nome: nomePorPaciente.get(linha.patient_id) ?? "Paciente",
        assunto_label: (linha.subject_id && labelPorAssunto.get(linha.subject_id)) || "Outros",
        status: statusApp,
        status_tom: TOM_POR_STATUS_CONVERSA[statusApp],
        ultima_mensagem_em: linha.last_message_at,
        nao_lida_pela_equipe:
          !linha.team_last_read_at || linha.team_last_read_at < linha.last_message_at,
        equipe_lida_em: linha.team_last_read_at,
        atribuida: Boolean(linha.assigned_professional_id),
        minha: meuId !== null && linha.assigned_professional_id === meuId,
        especialidade_origem: linha.origin_specialty_id
          ? paraEspecialidade(codigoPorEspecialidade.get(linha.origin_specialty_id))
          : null,
      };
    });

    return ok(conversas);
  });
}

interface LinhaMessage {
  id: string;
  author_kind: "patient" | "caregiver" | "professional" | "system";
  /** Quem da equipe escreveu. `null` nas mensagens de quem não é da equipe. */
  author_professional_id: string | null;
  body: string;
  created_at: string;
}

interface LinhaAttachment {
  id: string;
  message_id: string;
  storage_path: string;
  mime_type: string;
  byte_size: number;
}

const AUTOR_POR_CODIGO: Record<LinhaMessage["author_kind"], AutorMensagem> = {
  patient: "paciente",
  caregiver: "cuidador",
  professional: "profissional",
  system: "sistema",
};

const BUCKET_CHAT = "chat-attachments";

/** O nome do arquivo é o que vem depois do id da mensagem no caminho do bucket. */
function nomeDoAnexo(caminho: string): string {
  return caminho.slice(caminho.indexOf("/") + 1);
}

export async function listMensagens(params: {
  conversaId: string;
}): Promise<ListResult<MensagemClinico>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const [mensagensRes, anexosRes] = await Promise.all([
      supabase.rpc("read_messages", {
        p_conversation_id: params.conversaId,
        p_limit: 200,
        p_before: null,
      }),
      supabase.rpc("read_message_attachments", { p_conversation_id: params.conversaId }),
    ]);
    if (mensagensRes.error) return falhaDe(mensagensRes.error);
    if (anexosRes.error) return falhaDe(anexosRes.error);

    const anexosPorMensagem = new Map<string, AnexoMensagem[]>();
    for (const anexo of (anexosRes.data ?? []) as LinhaAttachment[]) {
      const lista = anexosPorMensagem.get(anexo.message_id) ?? [];
      lista.push({
        id: anexo.id,
        caminho: anexo.storage_path,
        nome: nomeDoAnexo(anexo.storage_path),
        mime_type: anexo.mime_type,
        tamanho: Number(anexo.byte_size),
      });
      anexosPorMensagem.set(anexo.message_id, lista);
    }

    const linhas = ((mensagensRes.data ?? []) as LinhaMessage[])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    /*
     * `read_messages` já entrega quem da equipe escreveu cada mensagem
     * (`author_professional_id`). Sem o nome, o paciente e o colega que assume a
     * conversa leem só "Equipe" e não sabem com quem a conversa esteve.
     */
    const idsDeAutores = [
      ...new Set(
        linhas.map((linha) => linha.author_professional_id).filter((id): id is string => Boolean(id)),
      ),
    ];

    let nomePorAutor = new Map<string, string>();
    if (idsDeAutores.length > 0) {
      const autoresRes = await professionalNamesQuery(supabase, idsDeAutores);
      if (autoresRes.error) return falhaDe(autoresRes.error);
      nomePorAutor = namesById((autoresRes.data ?? []) as ProfessionalNameRow[]);
    }

    return ok(
      linhas.map<MensagemClinico>((linha) => ({
        id: linha.id,
        autor: AUTOR_POR_CODIGO[linha.author_kind],
        autor_nome: linha.author_professional_id
          ? (nomePorAutor.get(linha.author_professional_id) ?? null)
          : null,
        corpo: linha.body,
        criado_em: linha.created_at,
        anexos: anexosPorMensagem.get(linha.id) ?? [],
      })),
    );
  });
}

/**
 * The conversation RPCs answer "insufficient_privilege" (`42501`, which the
 * generic mapping turns into "you have no permission for this content") for
 * three different reasons — already claimed, already resolved, another
 * specialty's. The person who clicked needs the actual reason, not a message
 * that sends them to ask for access they do not lack.
 */
function falhaDeConversa(erro: Parameters<typeof falhaDe>[0], motivo: string) {
  if (erro?.code === "42501") {
    return fail(ERROR_CODE.FORBIDDEN, motivo, { code: erro.code, message: erro.message });
  }
  return falhaDe(erro);
}

/**
 * Responde na conversa.
 *
 * O INSERT direto em `messages` é o caminho previsto: a política
 * `messages_insert_professional` chama `can_reply_as_professional` (profissional
 * ativo, conversa aberta, de equipe ou da própria especialidade). O profissional
 * não tem SELECT na tabela, então o INSERT **não pede a linha de volta** — o id
 * nasce aqui, e a conversa é relida por `read_messages`.
 *
 * O anexo segue a ordem que o banco impõe: a linha em `message_attachments`
 * precisa existir antes do upload (é ela que autoriza o objeto), e o caminho
 * começa pelo id da mensagem.
 */
export async function enviarMensagem(params: {
  conversaId: string;
  corpo: string;
  anexo?: File;
}): Promise<SingleResult<null>> {
  return executar(async () => {
    const corpo = params.corpo.trim();
    if (!corpo) return fail(ERROR_CODE.VALIDATION, "Escreva a mensagem antes de enviar.");

    // Antes de gravar qualquer coisa: depois, mensagem e anexo não se desfazem.
    if (params.anexo) {
      const motivo = attachmentError(params.anexo);
      if (motivo) return fail(ERROR_CODE.VALIDATION, motivo);
    }

    const supabase = getSupabaseClient();

    const eu = await profissionalDaSessao();
    if ("error" in eu) return eu;
    const { contaId, profissionalId } = eu;

    const mensagemId = crypto.randomUUID();

    const { error: erroMensagem } = await supabase.from("messages").insert({
      id: mensagemId,
      conversation_id: params.conversaId,
      author_kind: "professional",
      author_account_id: contaId,
      author_professional_id: profissionalId,
      body: corpo,
    });
    if (erroMensagem) {
      return falhaDeConversa(
        erroMensagem,
        "Esta conversa já foi encerrada ou não é da sua área: não dá para enviar mensagem nela.",
      );
    }

    if (!params.anexo) return okOne(null);

    const caminho = `${mensagemId}/${safeAttachmentName(params.anexo.name, params.anexo.type)}`;

    const { error: erroAnexo } = await supabase.from("message_attachments").insert({
      message_id: mensagemId,
      storage_path: caminho,
      mime_type: params.anexo.type,
      byte_size: params.anexo.size,
    });
    if (erroAnexo) {
      return fail(
        ERROR_CODE.UNKNOWN,
        "A mensagem foi enviada, mas o anexo não pôde ser registrado. Não reenvie a mensagem: envie só o arquivo, numa nova.",
        { mensagemEnviada: true, code: erroAnexo.code, message: erroAnexo.message },
      );
    }

    const { error: erroUpload } = await supabase.storage
      .from(BUCKET_CHAT)
      .upload(caminho, params.anexo, { contentType: params.anexo.type, upsert: false });
    if (erroUpload) {
      return fail(
        ERROR_CODE.UNKNOWN,
        "A mensagem foi enviada, mas o arquivo não subiu. Não reenvie a mensagem: envie só o arquivo, numa nova.",
        { mensagemEnviada: true, message: erroUpload.message },
      );
    }

    return okOne(null);
  });
}

export async function baixarAnexo(params: { caminho: string }): Promise<SingleResult<Blob>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient().storage.from(BUCKET_CHAT).download(params.caminho);
    if (error || !data) {
      return fail(ERROR_CODE.NOT_FOUND, "Não foi possível abrir este anexo. O arquivo pode não ter chegado a subir.", {
        message: error?.message,
      });
    }
    return okOne(data);
  });
}

export async function assumirConversa(params: { id: string }): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("claim_conversation", {
      p_conversation_id: params.id,
    });
    if (error) {
      return falhaDeConversa(error, "A conversa já foi assumida ou resolvida, ou só um profissional ativo com especialidade pode assumi-la.");
    }
    return okOne(null);
  });
}

export async function resolverConversa(params: { id: string }): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("resolve_conversation", {
      p_conversation_id: params.id,
    });
    if (error) {
      return falhaDeConversa(error, "Esta conversa já foi resolvida ou pertence a outra especialidade.");
    }
    return okOne(null);
  });
}

export async function marcarConversaLida(params: { id: string }): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("mark_conversation_read", {
      p_conversation_id: params.id,
    });
    if (error) return falhaDe(error);
    return okOne(null);
  });
}

/* -------------------------------------------------------------------------
   TEMPO DE RESPOSTA — o número que o dashboard e o chat clínicos mostram
   ------------------------------------------------------------------------- */

/**
 * Average minutes until the team's first reply, over the last `dias` days.
 *
 * `summarize_chat_response_times` runs under the caller's row policies, so a
 * professional's number covers the conversations they can see. Weighted by
 * answered conversations, not an average of averages: a bucket with one
 * conversation and one with forty would otherwise weigh the same. `null` when
 * nothing was answered in the window — which is not zero minutes.
 */
/**
 * The signed-in professional's own numbers in a window.
 *
 * `summarize_my_portfolio` repeats these numbers on every specialty row — the
 * rows differ only in the comparison with peers, which is not read here — so
 * the first row is enough. It always returns at least one.
 */
export async function getMeuDesempenho(params: {
  de: string;
  ate: string;
}): Promise<SingleResult<DesempenhoProfissional>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient().rpc("summarize_my_portfolio", {
      p_from: params.de,
      p_to: params.ate,
    });
    if (error) return falhaDe(error);

    const linha = ((data ?? []) as LinhaCarteira[])[0];

    return okOne<DesempenhoProfissional>({
      alertas_assumidos: Number(linha?.alerts_triaged_count ?? 0),
      alertas_resolvidos: Number(linha?.alerts_resolved_count ?? 0),
      primeiras_respostas: Number(linha?.first_response_count ?? 0),
      tempo_medio_minutos:
        linha?.first_response_avg_seconds == null
          ? null
          : Math.round(Number(linha.first_response_avg_seconds) / 60),
    });
  });
}

/** Counts arrive as numbers or, for `bigint`, as strings. */
interface LinhaCarteira {
  alerts_triaged_count: number | string;
  alerts_resolved_count: number | string;
  first_response_count: number | string;
  first_response_avg_seconds: number | string | null;
}

export async function getTempoDeResposta(params: {
  dias: number;
}): Promise<SingleResult<{ minutos: number | null }>> {
  return executar(async () => {
    const chat = await resumirChat({ janela: janelaDeDias(params.dias), granularidade: "month" });
    if (falhou(chat)) return chat;

    let segundos = 0;
    let conversas = 0;
    for (const linha of chat.linhas) {
      if (linha.first_response_avg_seconds === null || linha.answered_count === 0) continue;
      segundos += linha.first_response_avg_seconds * linha.answered_count;
      conversas += linha.answered_count;
    }

    return okOne({ minutos: conversas === 0 ? null : Math.round(segundos / conversas / 60) });
  });
}
