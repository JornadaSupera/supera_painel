import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type { Configuracoes, ItemCatalogo, VersaoLegal } from "@/types/configuracao";
import { executar, falhaDe, paraIso, umDe } from "./_helpers";
import { getSupabaseClient } from "./client";

/**
 * Configurações — o que está valendo, e o que o painel não edita.
 *
 * Todos os catálogos daqui são SELECT-only para `authenticated`. Não existe
 * política de escrita para nenhum deles, e a razão é boa: `symptoms` é ao mesmo
 * tempo o seletor do diário, o eixo dos relatórios e o gatilho dos alertas —
 * renomear um código numa tarde quebraria as três coisas de uma vez. O
 * vocabulário muda por migração versionada.
 *
 * Por isso este adapter LÊ. As operações de escrita recusam com o motivo, e a
 * tela desabilita o que não dá para salvar em vez de oferecer um formulário que
 * devolveria `permission denied` no fim.
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
  "gatilhos_de_alerta",
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

/* -------------------------------------------------------------------------
   ESCRITA — nenhuma existe hoje
   ------------------------------------------------------------------------- */

const SO_POR_MIGRACAO =
  "Os catálogos do sistema mudam por migração versionada, com revisão, e não por formulário: o mesmo vocabulário alimenta o diário do paciente, os relatórios e os gatilhos de alerta, e renomear um código aqui quebraria os três de uma vez.";

export async function update(): Promise<SingleResult<Configuracoes>> {
  return fail(ERROR_CODE.FORBIDDEN, SO_POR_MIGRACAO);
}

export async function uploadLogo(): Promise<SingleResult<{ url: string }>> {
  return fail(
    ERROR_CODE.NOT_IMPLEMENTED,
    "Não há onde guardar a identidade visual: nenhuma tabela de parâmetro e nenhum bucket de marca no Storage.",
  );
}

export async function publishTermos(): Promise<SingleResult<VersaoLegal>> {
  return fail(
    ERROR_CODE.FORBIDDEN,
    "Publicar uma nova versão dos termos cria obrigação de novo aceite para todos os pacientes. A tabela só permite leitura pelo painel — a publicação é feita pela migração que traz o texto revisado.",
  );
}
