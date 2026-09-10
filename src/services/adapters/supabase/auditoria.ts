import {
  ACAO_AUDITORIA,
  ACAO_AUDITORIA_LABEL,
  ORIGEM_AUDITORIA,
  RECURSO_AUDITORIA_LABEL,
  type AcaoAuditoria,
} from "@/lib/enums";
import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type DateRange,
  type ListParams,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type {
  AuditoriaListItem,
  FacetasAuditoria,
  OpcaoFiltroAuditoria,
  ResumoAuditoria,
} from "@/types/auditoria";
import { paginate } from "../_list";
import { executar, falhaDe, paraIso, umDe } from "./_helpers";
import { getSupabaseClient } from "./client";
import { paraAcaoAuditoria } from "./mapping";

/**
 * Auditoria & logs — a trilha de acesso a dado sensível.
 *
 * `audit_log` é append-only, garantido no banco por REVOKE mais gatilho: não há
 * UPDATE nem DELETE a expor aqui, e é por isso que este adapter só lê e conta.
 *
 * A leitura é do administrador ativo — é a única política de SELECT da tabela.
 * Um profissional que abrir a rota recebe lista vazia, não erro; por isso a
 * rota também é guardada por `auditoria:read`, para que a recusa apareça como
 * "sem permissão" em vez de "nenhum registro".
 *
 * > [!] Dois vocabulários não coincidem, e a diferença é informação.
 * O banco registra quatro verbos (`read`, `create`, `update`, `delete`); o
 * protótipo mostra sete categorias. "Sigiloso" e "exportação" NÃO são deriváveis
 * de `audit_log` — a primeira depende da visibilidade da linha lida, a segunda
 * de um evento que acontece no cliente. Elas são declaradas em `sem_origem`,
 * não zeradas.
 */

/* -------------------------------------------------------------------------
   PROJEÇÃO
   ------------------------------------------------------------------------- */

const SELECT_LOG = `
  id,
  occurred_at,
  action,
  resource_table,
  resource_id,
  row_count,
  actor_account_id,
  patient_id,
  accounts:actor_account_id ( full_name, email ),
  patients:patient_id ( full_name )
`;

/**
 * Teto de linhas trazidas para o recorte em memória.
 *
 * A trilha cresce sem parar — é o único dado do painel que só aumenta —, então
 * ela é o primeiro lugar onde "trazer tudo e filtrar no cliente" deixa de
 * funcionar. O teto mantém a página previsível; quando a retenção de cinco anos
 * encher a tabela, o filtro sobe para o servidor e este número sai.
 */
const TETO_TRILHA = 1000;

interface LinhaLog {
  id: number;
  occurred_at: string;
  action: string;
  resource_table: string;
  resource_id: string | null;
  row_count: number | null;
  actor_account_id: string | null;
  patient_id: string | null;
  accounts: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  patients: { full_name: string } | { full_name: string }[] | null;
}

function projetar(linha: LinhaLog): AuditoriaListItem {
  const ator = umDe(linha.accounts);
  const paciente = umDe(linha.patients);

  return {
    id: String(linha.id),
    criado_em: paraIso(linha.occurred_at) ?? linha.occurred_at,
    acao: paraAcaoAuditoria(linha.action),
    usuario_id: linha.actor_account_id,
    // Ação sem ator é ação do próprio sistema — rotina agendada, gatilho,
    // integração. Dizer "Sistema" é mais honesto do que deixar em branco.
    usuario_nome: ator?.full_name?.trim() || ator?.email || "Sistema",
    recurso: linha.resource_table,
    recurso_label: RECURSO_AUDITORIA_LABEL[linha.resource_table] ?? linha.resource_table,
    recurso_id: linha.resource_id,
    paciente_id: linha.patient_id,
    paciente_nome: paciente?.full_name ?? null,
    linhas: linha.row_count === null ? null : Number(linha.row_count),
    // Toda linha de `audit_log` nasce dentro do banco, a partir de uma chamada
    // do painel ou dos aplicativos. A tabela não distingue a procedência, e
    // inventar a distinção aqui seria dado falso.
    origem: ORIGEM_AUDITORIA.PAINEL,
    // Ver `AuditoriaListItem.ip`: o gatilho roda no Postgres, que não enxerga
    // o endereço do navegador.
    ip: null,
  };
}

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

const CAMPOS_BUSCA = ["usuario_nome", "recurso_label", "paciente_nome", "recurso_id"];

/**
 * Linhas da trilha, do mais recente para o mais antigo.
 *
 * Filtros aceitos: `acao`, `usuario_id`, `paciente_id`. O recorte por período
 * vai em `range`, e esse SIM é aplicado no servidor — é o único que corta
 * volume antes de a linha viajar.
 */
export async function list(params: ListParams = {}): Promise<ListResult<AuditoriaListItem>> {
  return executar(async () => {
    let consulta = getSupabaseClient()
      .from("audit_log")
      .select(SELECT_LOG)
      .order("occurred_at", { ascending: false })
      .limit(TETO_TRILHA);

    if (params.range?.from) consulta = consulta.gte("occurred_at", params.range.from);
    if (params.range?.to) consulta = consulta.lte("occurred_at", params.range.to);

    const { data, error } = await consulta;
    if (error) return falhaDe(error);

    const linhas = (data as unknown as LinhaLog[]).map(projetar);

    return paginate(
      linhas,
      {
        ...params,
        // O período já foi aplicado no servidor; repeti-lo em memória não muda
        // o resultado e só dá chance de os dois critérios divergirem.
        range: null,
        sort: params.sort ?? { field: "criado_em", direction: "desc" },
      },
      { searchFields: CAMPOS_BUSCA, rangeField: "criado_em" },
    );
  });
}

export async function getById({ id }: { id: string }): Promise<SingleResult<AuditoriaListItem>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("audit_log")
      .select(SELECT_LOG)
      .eq("id", Number(id))
      .maybeSingle();

    if (error) return falhaDe(error);
    if (!data) return fail(ERROR_CODE.NOT_FOUND, "Registro de auditoria não encontrado.");

    return okOne(projetar(data as unknown as LinhaLog));
  });
}

/* -------------------------------------------------------------------------
   CONTADORES DA JANELA
   ------------------------------------------------------------------------- */

/** As categorias que `audit_log` sabe separar, na ordem do protótipo. */
const CONTAVEIS: AcaoAuditoria[] = [
  ACAO_AUDITORIA.LEITURA,
  ACAO_AUDITORIA.EDICAO,
  ACAO_AUDITORIA.EXCLUSAO,
];

/**
 * Categorias do protótipo sem origem na trilha.
 *
 * `sigiloso` depende da visibilidade da linha lida (`clinical_visibility`), que
 * `audit_log` não copia — a trilha guarda qual tabela, não qual linha nem sob
 * que sigilo. `exportacao` é um evento do cliente: nada é gravado no banco
 * quando alguém baixa um CSV do que já estava na tela.
 */
const SEM_ORIGEM: AcaoAuditoria[] = [ACAO_AUDITORIA.SIGILOSO, ACAO_AUDITORIA.EXPORTACAO];

export async function getSummary(params: {
  janelaHoras?: number;
} = {}): Promise<SingleResult<ResumoAuditoria>> {
  return executar(async () => {
    const janela_horas = params.janelaHoras ?? 24;
    const desde = new Date(Date.now() - janela_horas * 3_600_000).toISOString();

    // Só a coluna `action`: a contagem não precisa de nome de pessoa nem de
    // paciente, e trazer os vínculos aqui seria puxar dado pessoal para
    // desenhar cinco números.
    const { data, error } = await getSupabaseClient()
      .from("audit_log")
      .select("action")
      .gte("occurred_at", desde)
      .limit(10_000);

    if (error) return falhaDe(error);

    const total = new Map<AcaoAuditoria, number>();

    for (const linha of data as unknown as { action: string }[]) {
      const acao = paraAcaoAuditoria(linha.action);
      total.set(acao, (total.get(acao) ?? 0) + 1);
    }

    return okOne({
      janela_horas,
      contagens: CONTAVEIS.map((acao) => ({
        acao,
        label: ACAO_AUDITORIA_LABEL[acao],
        total: total.get(acao) ?? 0,
      })),
      sem_origem: SEM_ORIGEM,
    });
  });
}

/* -------------------------------------------------------------------------
   QUEM APARECE NA JANELA
   ------------------------------------------------------------------------- */

/**
 * Opções dos seletores de usuário e de paciente.
 *
 * Sai da própria trilha, e não dos cadastros. Consultar `usuarios` e
 * `pacientes` para desenhar dois seletores custaria uma leitura de prontuário
 * a cada abertura desta tela — na tela cuja função é apontar leituras de
 * prontuário. Além disso o cadastro lista quem está ativo, e a trilha guarda
 * quem agiu: filtrar por cadastro faria desaparecer justamente o rastro de
 * quem foi desativado depois, que é o mais interessante numa apuração.
 *
 * Recebe só o `range`. As opções descrevem a JANELA, não o recorte — se
 * dependessem dos filtros aplicados, escolher um usuário apagaria os demais da
 * lista e não haveria como trocar de escolha.
 */
export async function getFacets(
  params: { range?: DateRange | null } = {},
): Promise<SingleResult<FacetasAuditoria>> {
  return executar(async () => {
    let consulta = getSupabaseClient()
      .from("audit_log")
      .select(
        "actor_account_id, patient_id, accounts:actor_account_id ( full_name, email ), patients:patient_id ( full_name )",
      )
      .order("occurred_at", { ascending: false })
      .limit(TETO_TRILHA);

    if (params.range?.from) consulta = consulta.gte("occurred_at", params.range.from);
    if (params.range?.to) consulta = consulta.lte("occurred_at", params.range.to);

    const { data, error } = await consulta;
    if (error) return falhaDe(error);

    const linhas = data as unknown as Pick<
      LinhaLog,
      "actor_account_id" | "patient_id" | "accounts" | "patients"
    >[];

    const atores = new Map<string, OpcaoFiltroAuditoria>();
    const pacientes = new Map<string, OpcaoFiltroAuditoria>();

    function contar(mapa: Map<string, OpcaoFiltroAuditoria>, id: string, nome: string) {
      const atual = mapa.get(id);
      if (atual) atual.total += 1;
      else mapa.set(id, { id, nome, total: 1 });
    }

    for (const linha of linhas) {
      // Ação sem ator é ação do próprio sistema — gatilho, rotina, integração.
      // Ela existe na trilha e não é filtrável por pessoa, então fica de fora
      // do seletor em vez de virar uma opção que não corresponde a ninguém.
      if (linha.actor_account_id) {
        const ator = umDe(linha.accounts);
        contar(
          atores,
          linha.actor_account_id,
          ator?.full_name?.trim() || ator?.email || "Sem identificação",
        );
      }

      if (linha.patient_id) {
        const paciente = umDe(linha.patients);
        contar(pacientes, linha.patient_id, paciente?.full_name ?? "Paciente removido");
      }
    }

    // Mais volume primeiro: quem tem mais linhas na janela é quem alguém veio
    // procurar. Empate resolve por nome, para a ordem não dançar entre cargas.
    const ordenar = (opcoes: OpcaoFiltroAuditoria[]) =>
      opcoes.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));

    return okOne({
      atores: ordenar([...atores.values()]),
      pacientes: ordenar([...pacientes.values()]),
      truncado: linhas.length >= TETO_TRILHA,
    });
  });
}

/* -------------------------------------------------------------------------
   EXPORTAÇÃO
   ------------------------------------------------------------------------- */

/**
 * Linhas achatadas para CSV ou JSON — o relatório que o DPO pede.
 *
 * As colunas são decididas aqui, e não na tela, para que a exportação não
 * dependa de quem clicou nem de quais colunas estavam visíveis. A serialização
 * é da interface (`lib/csv.ts`).
 */
export async function exportar(params: ListParams = {}): Promise<ListResult<Record<string, string>>> {
  return executar(async () => {
    // Sem paginação: a exportação é do RECORTE inteiro, não da página aberta.
    const resultado = await list({ ...params, page: 1, pageSize: TETO_TRILHA });

    // O erro é repassado com o código original: quem exporta precisa saber se
    // faltou permissão ou se a consulta caiu.
    if (resultado.error) {
      return fail(resultado.error.code, resultado.error.message, resultado.error.details);
    }

    const linhas = resultado.data.map((registro) => ({
      data_hora: registro.criado_em,
      acao: ACAO_AUDITORIA_LABEL[registro.acao],
      usuario: registro.usuario_nome,
      recurso: registro.recurso_label,
      registro_id: registro.recurso_id ?? "",
      paciente: registro.paciente_nome ?? "",
      linhas_alcancadas: registro.linhas === null ? "" : String(registro.linhas),
    }));

    return ok(linhas, resultado.count);
  });
}

export { exportar as export };
