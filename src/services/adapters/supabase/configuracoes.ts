import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type {
  Configuracoes,
  ItemCatalogo,
  MotivoSituacao,
  RegraAlerta,
  VersaoLegal,
} from "@/types/configuracao";
import { SETTINGS_WRITE_OPERATIONS } from "../_settings";
import { executar, falhaDe, paraIso, umDe } from "./_helpers";
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
   ESCRITA QUE CONTINUA RECUSADA — e por quê
   ------------------------------------------------------------------------- */

export const { update, uploadLogo } = SETTINGS_WRITE_OPERATIONS;
