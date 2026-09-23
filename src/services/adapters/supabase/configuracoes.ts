import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type {
  ConfiguracaoSeguranca,
  Consentimento,
  Configuracoes,
  ItemCatalogo,
  MotivoSituacao,
  RegraAlerta,
  SolicitacaoTitular,
  VersaoLegal,
  VinculoExterno,
} from "@/types/configuracao";
import { SETTINGS_WRITE_OPERATIONS } from "../_settings";
import { TETO_READ, executar, falhaDe, paraIso, umDe } from "./_helpers";
import { getSupabaseClient } from "./client";

/**
 * Configurações — o que está valendo, e o que o painel edita.
 *
 * A tela tem duas metades e elas obedecem a regras opostas no banco, o que é
 * intencional dos dois lados:
 *
 *  - **Vocabulário** (`symptoms`, `notification_types`, `content_categories`,
 *    `conversation_subjects`) é SELECT-only para `authenticated`. Não há
 *    política de escrita, e a razão é boa: `symptoms` é ao mesmo tempo o
 *    seletor do diário, o eixo dos relatórios e o alvo do gatilho de alerta —
 *    renomear um código numa tarde quebraria as três coisas de uma vez.
 *  - **Operação** (documento legal, limiar de alerta, motivo de situação) tem
 *    RPC própria, `SECURITY DEFINER`, com `private.is_active_admin()` no corpo
 *    como única barreira. São decisões da clínica que mudam com a rotina dela.
 *
 * As RPCs desta metade levantam **frase em português**, não sentinela — ver
 * `MENSAGEM_LEGIVEL` em `_helpers`, que é o que faz a frase chegar à tela em
 * vez de virar "Verifique os dados informados".
 */

interface LinhaCatalogo {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
}

function projetar(linha: LinhaCatalogo, detalhe: string | null = null): ItemCatalogo {
  return {
    id: linha.id,
    codigo: linha.code,
    label: linha.label,
    detalhe,
    ativo: linha.is_active,
  };
}

/**
 * Chaves que a tela de referência mostra e que o banco não guarda.
 *
 * Nomeadas uma a uma para que a interface diga o que falta. "Configurações
 * indisponíveis" não ajuda ninguém; "não há onde guardar o logo da clínica"
 * diz o que pedir a quem.
 */
const SEM_ORIGEM = [
  "identidade_visual",
  "cor_primaria",
  "horario_atendimento_chat",
  "resposta_automatica",
  "textos_de_onboarding",
];

export async function get(): Promise<SingleResult<Configuracoes>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const [sintomas, notificacoes, categorias, assuntos] = await Promise.all([
      supabase.from("symptoms").select("id, code, label, is_active, is_psychological").order("sort_order"),
      supabase.from("notification_types").select("id, code, label, is_active, category, is_silenceable").order("sort_order"),
      supabase.from("content_categories").select("id, code, label, is_active, specialties ( label )").order("sort_order"),
      supabase.from("conversation_subjects").select("id, code, label, is_active, specialties ( label )").order("sort_order"),
    ]);

    // Basta uma falhar para a tela não poder afirmar o que está valendo.
    const erro = sintomas.error ?? notificacoes.error ?? categorias.error ?? assuntos.error;
    if (erro) return falhaDe(erro);

    return okOne({
      sintomas: (sintomas.data as unknown as (LinhaCatalogo & { is_psychological: boolean })[]).map(
        (linha) =>
          projetar(linha, linha.is_psychological ? "Sintoma psicológico" : "Sintoma físico"),
      ),

      notificacoes: (
        notificacoes.data as unknown as (LinhaCatalogo & {
          category: string;
          is_silenceable: boolean;
        })[]
      ).map((linha) =>
        projetar(
          linha,
          linha.is_silenceable
            ? `${linha.category} · pode ser silenciada`
            : `${linha.category} · não silenciável`,
        ),
      ),

      categorias_conteudo: (
        categorias.data as unknown as (LinhaCatalogo & {
          specialties: { label: string } | { label: string }[] | null;
        })[]
      ).map((linha) => projetar(linha, umDe(linha.specialties)?.label ?? "Transversal")),

      assuntos_chat: (
        assuntos.data as unknown as (LinhaCatalogo & {
          specialties: { label: string } | { label: string }[] | null;
        })[]
      ).map((linha) => projetar(linha, umDe(linha.specialties)?.label ?? "Qualquer área")),

      sem_origem: SEM_ORIGEM,
    });
  });
}

const TIPO_LABEL: Record<string, string> = {
  terms_of_use: "Termos de uso",
  privacy_policy: "Política de privacidade",
};

/** Termos e política, todas as versões — o histórico é exigência de aceite. */
export async function getTermos(): Promise<ListResult<VersaoLegal>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("legal_document_versions")
      .select("id, kind, version, body, published_at, is_current")
      .order("kind")
      .order("version", { ascending: false });

    if (error) return falhaDe(error);

    const linhas = data as unknown as {
      id: string;
      kind: string;
      version: number;
      body: string;
      published_at: string | null;
      is_current: boolean;
    }[];

    return ok(
      linhas.map<VersaoLegal>((linha) => ({
        id: linha.id,
        tipo: linha.kind === "privacy_policy" ? "politica_de_privacidade" : "termos_de_uso",
        tipo_label: TIPO_LABEL[linha.kind] ?? linha.kind,
        versao: Number(linha.version),
        vigente: linha.is_current,
        publicado_em: paraIso(linha.published_at),
        corpo: linha.body,
      })),
    );
  });
}

/** A versão de uma espécie que está em vigor, para devolver depois de publicar. */
async function versaoVigente(tipo: VersaoLegal["tipo"]): Promise<VersaoLegal | null> {
  const { data } = await getTermos();
  return data.find((versao) => versao.tipo === tipo && versao.vigente) ?? null;
}

/**
 * Publica uma versão nova do documento e aposenta a anterior.
 *
 * O backend numera por espécie e marca a vigência no mesmo ato — a ordem
 * importa lá dentro, porque há índice único parcial sobre "a vigente". Aqui só
 * mandamos o texto.
 */
export async function publishTermos({
  tipo,
  corpo,
}: {
  tipo: VersaoLegal["tipo"];
  corpo: string;
}): Promise<SingleResult<VersaoLegal>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("publish_legal_document", {
      p_kind: tipo === "politica_de_privacidade" ? "privacy_policy" : "terms_of_use",
      p_body: corpo,
    });

    if (error) return falhaDe(error);

    // A RPC devolve só o id. Reler dá a versão numerada e a data de publicação,
    // que é o que a tela mostra — e confirma que a vigência trocou de fato.
    return okOne(await versaoVigente(tipo));
  });
}

/* -------------------------------------------------------------------------
   GATILHOS DE ALERTA
   ------------------------------------------------------------------------- */

/**
 * Uma linha por sintoma ativo, com ou sem limiar.
 *
 * O `LEFT JOIN` é o ponto: listar só as regras existentes mostraria o que está
 * coberto e esconderia o que não está. Numa tela cuja pergunta é "o que dispara
 * alerta?", a ausência é a informação mais importante.
 *
 * A regra vigente é a de `effective_to` nulo — o histórico fica na tabela,
 * porque um alerta de março foi disparado sob a regra de março.
 */
export async function getRegrasAlerta(): Promise<ListResult<RegraAlerta>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const [sintomas, regras] = await Promise.all([
      supabase.from("symptoms").select("id, label").eq("is_active", true).order("sort_order"),
      supabase.from("alert_rules").select("id, symptom_id, min_grade, effective_from").is("effective_to", null),
    ]);

    const erro = sintomas.error ?? regras.error;
    if (erro) return falhaDe(erro);

    const porSintoma = new Map(
      (regras.data as unknown as {
        id: string;
        symptom_id: string;
        min_grade: number;
        effective_from: string;
      }[]).map((regra) => [regra.symptom_id, regra]),
    );

    return ok(
      (sintomas.data as unknown as { id: string; label: string }[]).map((sintoma) => {
        const regra = porSintoma.get(sintoma.id);

        return {
          id: regra?.id ?? null,
          sintoma_id: sintoma.id,
          sintoma_label: sintoma.label,
          grau_minimo: regra ? Number(regra.min_grade) : null,
          vigente_desde: regra ? paraIso(regra.effective_from) : null,
        };
      }),
    );
  });
}

/** A linha de um sintoma depois de escrever, relida da fonte. */
async function regraDoSintoma(sintomaId: string): Promise<SingleResult<RegraAlerta>> {
  const { data, error } = await getRegrasAlerta();
  if (error) return fail(error.code, error.message);

  const regra = data.find((linha) => linha.sintoma_id === sintomaId);
  return regra ? okOne(regra) : fail(ERROR_CODE.NOT_FOUND, "Sintoma não encontrado no catálogo.");
}

export async function setRegraAlerta({
  sintoma_id,
  grau_minimo,
}: {
  sintoma_id: string;
  grau_minimo: number;
}): Promise<SingleResult<RegraAlerta>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_alert_rule", {
      p_symptom_id: sintoma_id,
      p_min_grade: grau_minimo,
    });

    if (error) return falhaDe(error);
    return regraDoSintoma(sintoma_id);
  });
}

export async function removerRegraAlerta({
  sintoma_id,
}: {
  sintoma_id: string;
}): Promise<SingleResult<RegraAlerta>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("disable_alert_rule", {
      p_symptom_id: sintoma_id,
    });

    if (error) return falhaDe(error);
    return regraDoSintoma(sintoma_id);
  });
}

/* -------------------------------------------------------------------------
   MOTIVOS DE SITUAÇÃO
   ------------------------------------------------------------------------- */

interface LinhaMotivo {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  appointment_statuses:
    | { code: string; label: string }
    | { code: string; label: string }[]
    | null;
}

function projetarMotivo(linha: LinhaMotivo): MotivoSituacao {
  const situacao = umDe(linha.appointment_statuses);

  return {
    id: linha.id,
    situacao_codigo: situacao?.code ?? "",
    situacao_label: situacao?.label ?? "Situação desconhecida",
    codigo: linha.code,
    label: linha.label,
    ordem: Number(linha.sort_order),
    ativo: linha.is_active,
  };
}

/**
 * Os motivos EM USO — e só eles.
 *
 * > [!] A política de leitura desta tabela é `is_active`.
 * Quem faz login é `authenticated`, e para esse papel a linha aposentada
 * simplesmente não existe. Ver todas exigiria o papel `clinical_reader`, do
 * qual `authenticated` não é membro — a mesma porta das tabelas clínicas.
 *
 * A consequência é da interface, não daqui: **aposentar é porta de mão única
 * pelo painel.** A linha some da lista e não há como trazê-la de volta,
 * porque não há como sequer enxergá-la. A tela diz isso antes de a pessoa
 * clicar, e a correção de rótulo existe justamente para que aposentar não
 * vire o caminho de corrigir um erro de digitação.
 */
export async function getMotivos(): Promise<ListResult<MotivoSituacao>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("appointment_status_reasons")
      .select("id, code, label, sort_order, is_active, appointment_statuses:status_id ( code, label )")
      .order("sort_order");

    if (error) return falhaDe(error);

    return ok((data as unknown as LinhaMotivo[]).map(projetarMotivo));
  });
}

/** Um motivo pelo id, relido depois de escrever. */
async function motivoPorId(id: string): Promise<SingleResult<MotivoSituacao>> {
  const { data, error } = await getMotivos();
  if (error) return fail(error.code, error.message);

  const motivo = data.find((linha) => linha.id === id);
  return motivo ? okOne(motivo) : fail(ERROR_CODE.NOT_FOUND, "Motivo não encontrado.");
}

export async function criarMotivo({
  situacao_codigo,
  codigo,
  label,
  ordem,
}: {
  situacao_codigo: string;
  codigo: string;
  label: string;
  ordem?: number;
}): Promise<SingleResult<MotivoSituacao>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient().rpc("create_status_reason", {
      p_status_code: situacao_codigo,
      p_code: codigo,
      p_label: label,
      p_sort_order: ordem ?? 0,
    });

    if (error) return falhaDe(error);
    return motivoPorId(data as unknown as string);
  });
}

export async function atualizarMotivo({
  id,
  label,
  ordem,
}: {
  id: string;
  label?: string;
  ordem?: number;
}): Promise<SingleResult<MotivoSituacao>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("update_status_reason", {
      p_reason_id: id,
      // Nulo mantém a coluna: é o contrato das escritas deste banco, e o que
      // permite corrigir só o rótulo sem reenviar a ordem.
      p_label: label ?? null,
      p_sort_order: ordem ?? null,
    });

    if (error) return falhaDe(error);
    return motivoPorId(id);
  });
}

/**
 * Aposenta um motivo — ou o reativa, se algum dia der para enxergá-lo.
 *
 * Depois de aposentar, a releitura **não encontra a linha**: a política de
 * SELECT é `is_active`, então a própria escrita a torna invisível. Isso é
 * sucesso, não falha, e por isso `null` aqui não vira `NOT_FOUND` — um erro
 * depois de uma operação que funcionou faria quem opera clicar de novo.
 */
export async function setMotivoAtivo({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}): Promise<SingleResult<MotivoSituacao>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_status_reason_active", {
      p_reason_id: id,
      p_is_active: ativo,
    });

    if (error) return falhaDe(error);
    if (!ativo) return okOne<MotivoSituacao>(null);

    return motivoPorId(id);
  });
}

/* -------------------------------------------------------------------------
   SEGUNDO FATOR OBRIGATÓRIO
   ------------------------------------------------------------------------- */

/**
 * O estado do interruptor.
 *
 * A tabela tem uma linha só, e a política de leitura é a do administrador
 * ativo. Linha ausente **não** significa "desligado": significa que esta sessão
 * não consegue perguntar — ou porque o perfil não é administrativo, ou porque a
 * própria exigência já está barrando a leitura. Devolver `false` aqui faria a
 * tela afirmar o contrário do que está valendo.
 */
export async function getSeguranca(): Promise<SingleResult<ConfiguracaoSeguranca>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("security_settings")
      .select("require_admin_mfa, updated_at, accounts:updated_by ( full_name, email )")
      .maybeSingle();

    if (error) return falhaDe(error);

    if (!data) {
      return okOne<ConfiguracaoSeguranca>({
        exige_mfa: null,
        atualizado_em: null,
        atualizado_por: null,
      });
    }

    const linha = data as unknown as {
      require_admin_mfa: boolean;
      updated_at: string | null;
      accounts: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
    };

    const autor = umDe(linha.accounts);

    return okOne<ConfiguracaoSeguranca>({
      exige_mfa: linha.require_admin_mfa,
      atualizado_em: paraIso(linha.updated_at),
      // Nulo é o valor de nascimento da linha: ninguém mexeu ainda.
      atualizado_por: autor?.full_name?.trim() || autor?.email || null,
    });
  });
}

/**
 * Liga e desliga a exigência.
 *
 * O backend recusa ligar a partir de uma sessão que ainda não passou pelo
 * segundo fator, e a recusa vem com a frase pronta para a tela. A checagem
 * acontece lá, e não aqui, porque uma guarda que mora só no cliente protege
 * apenas quem usa o cliente.
 */
export async function setExigirMfa({
  exigir,
}: {
  exigir: boolean;
}): Promise<SingleResult<ConfiguracaoSeguranca>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_require_admin_mfa", {
      p_required: exigir,
    });

    if (error) return falhaDe(error);
    return getSeguranca();
  });
}

/* -------------------------------------------------------------------------
   ESCRITA QUE CONTINUA RECUSADA — e por quê
   ------------------------------------------------------------------------- */

export const { update, uploadLogo } = SETTINGS_WRITE_OPERATIONS;

/* -------------------------------------------------------------------------
   FILA DE CONFERÊNCIA DA INTEGRAÇÃO
   -------------------------------------------------------------------------
   A leitura é por `read_external_refs`, e não por `.from()`: a política da
   tabela é do papel `clinical_reader`, do qual `authenticated` não é membro —
   uma consulta direta devolveria zero linhas sem erro nenhum.

   A função EXIGE um estado; ela não tem ramo para "todos". A fila pede
   `proposed`, que é o único que ainda espera decisão: confirmado e rejeitado
   já foram resolvidos, e misturá-los faria a fila deixar de ser fila.

   > [!] Hoje ela está vazia, e a tela precisa existir mesmo assim.
   A sincronização está desligada, então nenhum vínculo foi proposto. Construir
   a conferência no dia em que os vínculos começarem a chegar é construí-la com
   pressa — e o erro que ela evita é o pior possível neste sistema.
   ------------------------------------------------------------------------- */

interface LinhaVinculo {
  id: string;
  system: string;
  entity_type: string;
  local_id: string | null;
  external_key: Record<string, unknown> | null;
  created_at: string;
}

/** O que o sistema de origem chama a linha, em texto legível. */
function chaveLegivel(chave: Record<string, unknown> | null): string {
  if (!chave) return "—";

  const partes = Object.entries(chave)
    .filter(([, valor]) => valor !== null && valor !== undefined && valor !== "")
    .map(([campo, valor]) => `${campo}: ${String(valor)}`);

  return partes.length > 0 ? partes.join(" · ") : "—";
}

export async function getVinculosExternos(): Promise<ListResult<VinculoExterno>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient().rpc("read_external_refs", {
      p_link_status: "proposed",
      p_limit: TETO_READ,
      p_offset: 0,
    });

    if (error) return falhaDe(error);

    return ok(
      ((data ?? []) as LinhaVinculo[]).map((linha) => ({
        id: linha.id,
        sistema: linha.system,
        entidade: linha.entity_type,
        chave_externa: chaveLegivel(linha.external_key),
        local_id: linha.local_id,
        proposto_em: paraIso(linha.created_at) ?? linha.created_at,
      })),
    );
  });
}

/**
 * Confirma ou rejeita um vínculo proposto.
 *
 * A linha sai da fila nos dois casos — é por isso que a resposta não a relê:
 * ela deixou de ser `proposed`, e uma releitura devolveria "não encontrado"
 * para uma operação que funcionou.
 */
export async function confirmarVinculoExterno({
  id,
  confirmar,
}: {
  id: string;
  confirmar: boolean;
}): Promise<SingleResult<VinculoExterno>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("confirm_external_link", {
      p_ref_id: id,
      p_confirm: confirmar,
    });

    if (error) return falhaDe(error);

    return okOne<VinculoExterno>(null);
  });
}

/* -------------------------------------------------------------------------
   CONSENTIMENTOS
   ------------------------------------------------------------------------- */

interface LinhaConsentimento {
  id: string;
  accepted_at: string;
  revoked_at: string | null;
  accounts: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  legal_document_versions: { kind: string; version: number } | { kind: string; version: number }[] | null;
}

/**
 * Quem aceitou qual versão.
 *
 * Leitura direta: `consent_records` tem política para o administrador, fora do
 * pedágio das tabelas clínicas. Não há escrita — aceitar é ato do titular no
 * aplicativo, e revogar também.
 */
export async function getConsentimentos(): Promise<ListResult<Consentimento>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("consent_records")
      .select(
        "id, accepted_at, revoked_at, accounts:account_id ( full_name, email ), legal_document_versions:document_version_id ( kind, version )",
      )
      .order("accepted_at", { ascending: false })
      .limit(TETO_READ);

    if (error) return falhaDe(error);

    return ok(
      (data as unknown as LinhaConsentimento[]).map((linha) => {
        const pessoa = umDe(linha.accounts);
        const versao = umDe(linha.legal_document_versions);

        return {
          id: linha.id,
          pessoa: pessoa?.full_name?.trim() || pessoa?.email || "Não identificado",
          documento: versao
            ? `${TIPO_LABEL[versao.kind] ?? versao.kind} · versão ${versao.version}`
            : "Documento não identificado",
          aceito_em: paraIso(linha.accepted_at) ?? linha.accepted_at,
          revogado_em: paraIso(linha.revoked_at),
        };
      }),
    );
  });
}

/* -------------------------------------------------------------------------
   PEDIDOS DO TITULAR (LGPD)
   -------------------------------------------------------------------------
   Leitura direta: `data_subject_requests` tem política para o administrador.
   A decisão é por RPC, que aceita apenas deferir e recusar.

   > [!] "Cumprido" existe na estrutura e é inalcançável.
   O estado `executed` está no enum e nenhuma função o atinge. Para a LGPD o
   que conta é o ATENDIMENTO, não o deferimento — então é exatamente a prova do
   atendimento que o painel não consegue registrar. A tela declara isso; o
   pedido está na carta ao responsável pelo banco.
   ------------------------------------------------------------------------- */

const TIPO_SOLICITACAO_LABEL: Record<string, string> = {
  access: "Acesso aos dados",
  rectification: "Correção de dados",
  portability: "Portabilidade",
  consent_revocation: "Revogação de consentimento",
  deletion: "Exclusão de dados",
};

const STATUS_SOLICITACAO_LABEL: Record<string, string> = {
  requested: "Aberto",
  under_review: "Em análise",
  granted: "Deferido",
  executed: "Cumprido",
  refused: "Recusado",
};

/** Os dois estados que ainda aceitam decisão — é o que define "aberto". */
const ABERTOS = new Set(["requested", "under_review"]);

interface LinhaSolicitacao {
  id: string;
  request_type: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
  accounts: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  decisor: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
}

function projetarSolicitacao(linha: LinhaSolicitacao): SolicitacaoTitular {
  const titular = umDe(linha.accounts);
  const decisor = umDe(linha.decisor);

  return {
    id: linha.id,
    pessoa: titular?.full_name?.trim() || titular?.email || "Não identificado",
    tipo: linha.request_type,
    tipo_label: TIPO_SOLICITACAO_LABEL[linha.request_type] ?? linha.request_type,
    status: linha.status,
    status_label: STATUS_SOLICITACAO_LABEL[linha.status] ?? linha.status,
    criado_em: paraIso(linha.created_at) ?? linha.created_at,
    decidido_em: paraIso(linha.decided_at),
    decidido_por: decisor?.full_name?.trim() || decisor?.email || null,
    observacao: linha.decision_note,
    aberto: ABERTOS.has(linha.status),
  };
}

export async function getSolicitacoesTitular(): Promise<ListResult<SolicitacaoTitular>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("data_subject_requests")
      .select(
        "id, request_type, status, created_at, decided_at, decision_note, accounts:account_id ( full_name, email ), decisor:decided_by ( full_name, email )",
      )
      .order("created_at", { ascending: false })
      .limit(TETO_READ);

    if (error) return falhaDe(error);

    const solicitacoes = (data as unknown as LinhaSolicitacao[]).map(projetarSolicitacao);

    // Aberto primeiro: é uma fila com prazo correndo, e ordenar só por data
    // misturaria o que espera decisão com o que já foi decidido.
    return ok(
      solicitacoes.sort((a, b) => Number(b.aberto) - Number(a.aberto) || b.criado_em.localeCompare(a.criado_em)),
    );
  });
}

export async function decidirSolicitacaoTitular({
  id,
  deferir,
  observacao,
}: {
  id: string;
  deferir: boolean;
  observacao: string;
}): Promise<SingleResult<SolicitacaoTitular>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("decide_data_subject_request", {
      p_request_id: id,
      p_status: deferir ? "granted" : "refused",
      p_note: observacao,
    });

    if (error) return falhaDe(error);

    const { data, error: erroLeitura } = await getSolicitacoesTitular();
    if (erroLeitura) return fail(erroLeitura.code, erroLeitura.message);

    const solicitacao = data.find((linha) => linha.id === id);
    return solicitacao ? okOne(solicitacao) : fail(ERROR_CODE.NOT_FOUND, "Pedido não encontrado.");
  });
}
