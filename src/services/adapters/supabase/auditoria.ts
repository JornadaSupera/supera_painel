import { ACAO_AUDITORIA, RECURSO_AUDITORIA_LABEL, type AcaoAuditoria } from "@/lib/enums";
import {
  ERROR_CODE,
  fail,
  normalizeListParams,
  ok,
  okOne,
  type DateRange,
  type ListParams,
  type ListResult,
  type SingleResult,
  type Sort,
} from "@/services/contracts";
import type { AuditoriaListItem, FacetasAuditoria, ResumoAuditoria } from "@/types/auditoria";
import { AUDIT_DEFAULT_SORT, buildFacetOptions, summarizeAudit, toAuditExport } from "../_audit";
import { paginate } from "../_list";
import { TETO_READ, executar, falhaDe, paraIso, umDe } from "./_helpers";
import { getSupabaseClient } from "./client";
import { paraAcaoAuditoria, paraOrigemDoAtor, paraVerbosDeAuditoria } from "./mapping";

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
 * protótipo mostra sete categorias. "Sigiloso" deixou de ser uma delas: virou
 * marca da própria linha (`is_restricted_material`), então é contável e
 * filtrável. "Exportação" continua sem origem — é um evento que acontece no
 * navegador e nunca chega ao banco. Ela é declarada em `sem_origem`, não
 * zerada.
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
  origin,
  actor_capacity,
  is_restricted_material,
  accounts:actor_account_id ( full_name, email )
`;

/**
 * NOME DE PACIENTE NÃO SAI DO JOIN — e a tentativa era silenciosamente vazia.
 * =============================================================================
 * `audit_log` é legível pelo administrador, mas `patients` não é: a política
 * dela vale só dentro das funções `read_*`. Um vínculo embutido
 * (`patients:patient_id ( full_name )`) atravessa a mesma RLS e volta **nulo**,
 * sem erro — medido na base: das 76 linhas da trilha, 47 têm paciente e
 * **zero** nomes resolviam. A coluna de paciente da tela e da exportação
 * ficava em branco, e ninguém era avisado disso.
 *
 * O nome vem de `read_patients`, que é a porta que alcança a tabela. São 200
 * pacientes por chamada e **uma** chamada por leitura da trilha — nunca uma por
 * linha, que encheria a própria trilha de acessos gerados por quem a consulta.
 *
 * Que essa chamada registre "administrador leu a lista de pacientes" é
 * correto, não efeito colateral: a tela de fato exibe nome de paciente, e a
 * trilha deve dizer isso.
 */
async function nomesDePacientes(): Promise<Map<string, string>> {
  const { data, error } = await getSupabaseClient().rpc("read_patients", {
    p_limit: TETO_READ,
    p_offset: 0,
  });

  // Falha aqui não derruba a trilha: sem o mapa, a linha continua listada e o
  // paciente aparece como não identificado. Perder o nome é degradação; perder
  // a trilha inteira seria outra coisa.
  if (error || !data) return new Map();

  return new Map(
    (data as { id: string; full_name: string }[]).map((linha) => [linha.id, linha.full_name]),
  );
}

/**
 * Resolves patient names only when some row is about a patient. A trail with no
 * record access does not justify generating one.
 */
async function nomesSeHouverPaciente(
  linhas: { patient_id: string | null }[],
): Promise<Map<string, string>> {
  return linhas.some((linha) => linha.patient_id) ? nomesDePacientes() : new Map();
}

/**
 * O rótulo de um paciente na trilha.
 *
 * `null` quando a linha não é sobre paciente nenhum — que é diferente de ser
 * sobre um paciente cujo nome não alcançamos. O segundo caso é dito com todas
 * as letras, porque "sem paciente" e "paciente não identificado" levam a
 * conclusões opostas em uma apuração.
 */
function rotuloDePaciente(id: string | null, nomes: Map<string, string>): string | null {
  if (!id) return null;
  return nomes.get(id) ?? "Paciente não identificado";
}

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
  origin: string | null;
  actor_capacity: string | null;
  is_restricted_material: boolean | null;
  accounts: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
}

/**
 * The trail inside the window, newest first and capped. The period is the one
 * filter applied on the server — it is the only one that cuts volume before
 * the row travels.
 */
function consultarJanela(colunas: string, range: DateRange | null | undefined) {
  let consulta = getSupabaseClient()
    .from("audit_log")
    .select(colunas)
    .order("occurred_at", { ascending: false })
    .limit(TETO_TRILHA);

  if (range?.from) consulta = consulta.gte("occurred_at", range.from);
  if (range?.to) consulta = consulta.lte("occurred_at", range.to);

  return consulta;
}

/* -------------------------------------------------------------------------
   RECORTE NO SERVIDOR
   -------------------------------------------------------------------------
   Três dos quatro filtros que o escopo pede são COLUNA de `audit_log`, e
   portanto se aplicam antes de a linha viajar. Enquanto eles eram resolvidos
   em memória, "quem abriu a ficha desta pessoa" só encontrava rastro dentro
   das últimas mil linhas — e a tela não tinha como dizer que parou ali.

   Nem tudo sobe junto, e o que fica é o que depende do vínculo com `accounts`
   ou do nome do paciente, que vem de outra chamada:

     busca textual  → varre nome de pessoa e rótulo em português
     ordenar por    → `usuario_nome`, `paciente_nome`

   Por isso existem dois caminhos, e a escolha é automática. O de baixo é o
   antigo, com o mesmo teto de sempre; o de cima é exato e não tem teto.
   ------------------------------------------------------------------------- */

/**
 * Colunas do painel que o servidor sabe ordenar, e o nome delas lá.
 *
 * São duas, e a lista é curta de propósito. `acao` e `recurso_label` PARECEM
 * ordenáveis — as colunas existem — mas a tela mostra o rótulo traduzido e o
 * banco ordenaria o valor cru: `read`, `create`, `update`, `delete` sai em
 * ordem alfabética como Edição, Exclusão, Leitura, Edição, com a mesma
 * categoria em dois pedaços da lista. Ordenação que embaralha a coluna que
 * ordena é pior do que ordenação feita em memória.
 */
const ORDENAVEL_NO_SERVIDOR: Record<string, string> = {
  criado_em: "occurred_at",
  linhas: "row_count",
};

/** Um filtro da tela que o servidor não sabe responder. */
const RECORTE_IMPOSSIVEL = Symbol("recorte sem correspondência no banco");

type FiltroDeAcao = { verbos: string[] } | { restrito: true } | null | typeof RECORTE_IMPOSSIVEL;

/**
 * A categoria escolhida na tela, traduzida para o que o banco guarda.
 *
 * `sigiloso` não é verbo: é a marca da linha. `exportacao`, `login` e `logout`
 * não existem em `audit_log`, e para eles a resposta correta é **lista
 * vazia** — devolver tudo responderia "todos os acessos" a uma pergunta sobre
 * exportações, que é o tipo de erro que passa por resultado.
 */
function filtroDeAcao(valor: unknown): FiltroDeAcao {
  if (valor === undefined || valor === null || valor === "" || valor === "todos") return null;
  if (valor === ACAO_AUDITORIA.SIGILOSO) return { restrito: true };

  const verbos = paraVerbosDeAuditoria(String(valor));
  return verbos ? { verbos } : RECORTE_IMPOSSIVEL;
}

function projetar(linha: LinhaLog, nomes: Map<string, string>): AuditoriaListItem {
  const ator = umDe(linha.accounts);

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
    paciente_nome: rotuloDePaciente(linha.patient_id, nomes),
    linhas: linha.row_count === null ? null : Number(linha.row_count),
    // A qualidade em que a pessoa agiu, não o aplicativo — ver
    // `paraOrigemDoAtor`, que explica por que a aproximação é aceitável e o
    // que ela preserva.
    origem: paraOrigemDoAtor(linha.actor_capacity),
    // Vazio é resposta legítima: chamada fora da web não tem endereço, e
    // preencher com o do servidor pareceria informação sem ser.
    ip: linha.origin?.trim() || null,
    material_restrito: linha.is_restricted_material === true,
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
 * vai em `range`. Período, ação, usuário e paciente são aplicados no servidor
 * sempre que a pergunta couber lá — ver `ORDENAVEL_NO_SERVIDOR` e
 * `filtroDeAcao` para saber quando não cabe.
 */
export async function list(params: ListParams = {}): Promise<ListResult<AuditoriaListItem>> {
  const sort = params.sort ?? AUDIT_DEFAULT_SORT;
  const busca = params.search?.trim() ?? "";
  const acao = filtroDeAcao(params.filters?.acao);

  // Pergunta que o banco não responde: nenhuma linha corresponde, e é isso que
  // a tela precisa mostrar.
  if (acao === RECORTE_IMPOSSIVEL) return ok([], 0);

  const noServidor = !busca && Boolean(ORDENAVEL_NO_SERVIDOR[sort.field]);

  return noServidor ? listaNoServidor(params, sort, acao) : listaNaJanela(params, sort);
}

/**
 * O caminho exato: filtro, ordenação, contagem e página no banco.
 *
 * O total é o do CONJUNTO FILTRADO, não o da janela trazida — é a diferença
 * entre uma paginação que sabe quantas páginas tem e uma que afirma saber.
 */
async function listaNoServidor(
  params: ListParams,
  sort: Sort,
  acao: Exclude<FiltroDeAcao, typeof RECORTE_IMPOSSIVEL>,
): Promise<ListResult<AuditoriaListItem>> {
  return executar(async () => {
    const { from, to } = normalizeListParams(params);

    let consulta = getSupabaseClient()
      .from("audit_log")
      .select(SELECT_LOG, { count: "exact" })
      .order(ORDENAVEL_NO_SERVIDOR[sort.field] ?? "occurred_at", {
        ascending: sort.direction !== "desc",
      })
      .range(from, to);

    if (params.range?.from) consulta = consulta.gte("occurred_at", params.range.from);
    if (params.range?.to) consulta = consulta.lte("occurred_at", params.range.to);

    if (acao && "verbos" in acao) consulta = consulta.in("action", acao.verbos);
    if (acao && "restrito" in acao) consulta = consulta.is("is_restricted_material", true);

    const usuarioId = params.filters?.usuario_id;
    if (typeof usuarioId === "string" && usuarioId) {
      consulta = consulta.eq("actor_account_id", usuarioId);
    }

    const pacienteId = params.filters?.paciente_id;
    if (typeof pacienteId === "string" && pacienteId) {
      consulta = consulta.eq("patient_id", pacienteId);
    }

    const { data, error, count } = await consulta;
    if (error) return falhaDe(error);

    const brutas = (data ?? []) as unknown as LinhaLog[];
    const nomes = await nomesSeHouverPaciente(brutas);

    return ok(
      brutas.map((linha) => projetar(linha, nomes)),
      // `count` nulo só acontece se o servidor recusar a contagem; cair no
      // tamanho da página é melhor que cair em zero, que esconderia a página.
      count ?? brutas.length,
    );
  });
}

/**
 * O caminho antigo, para o que o servidor não responde: busca textual e
 * ordenação por nome de pessoa.
 *
 * Traz a janela e resolve o resto em memória, com o teto de sempre. Continua
 * existindo porque o nome do ator vem de um vínculo e o do paciente de outra
 * chamada — nenhum dos dois é coluna que dê para filtrar ou ordenar lá.
 */
async function listaNaJanela(
  params: ListParams,
  sort: Sort,
): Promise<ListResult<AuditoriaListItem>> {
  return executar(async () => {
    const { data, error } = await consultarJanela(SELECT_LOG, params.range);
    if (error) return falhaDe(error);

    const brutas = data as unknown as LinhaLog[];
    const nomes = await nomesSeHouverPaciente(brutas);
    const linhas = brutas.map((linha) => projetar(linha, nomes));

    return paginate(
      linhas,
      {
        ...params,
        // O período já foi aplicado no servidor; repeti-lo em memória não muda
        // o resultado e só dá chance de os dois critérios divergirem.
        range: null,
        sort,
        filters: filtrosEmMemoria(params.filters),
      },
      { searchFields: CAMPOS_BUSCA, rangeField: "criado_em" },
    );
  });
}

/**
 * Os mesmos filtros da tela, sobre os campos que a linha projetada tem.
 *
 * Um só precisa de tradução: nenhuma linha vem com `acao: "sigiloso"` — o
 * sigilo é marca da linha, não categoria do verbo. Sem esta troca, escolher
 * "Sigiloso" e digitar uma busca devolveria lista vazia em vez dos acessos
 * marcados, e o vazio pareceria ausência de acesso restrito.
 */
function filtrosEmMemoria(filtros: ListParams["filters"]): ListParams["filters"] {
  if (filtros?.acao !== ACAO_AUDITORIA.SIGILOSO) return filtros;

  return { ...filtros, acao: undefined, material_restrito: true };
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

    const linha = data as unknown as LinhaLog;

    return okOne(projetar(linha, await nomesSeHouverPaciente([linha])));
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
  ACAO_AUDITORIA.SIGILOSO,
];

/**
 * Categorias do protótipo sem origem na trilha.
 *
 * Sobrou uma. `exportacao` é um evento do cliente: nada é gravado no banco
 * quando alguém baixa um CSV do que já estava na tela, então o contador
 * continua declarado ausente em vez de zerado.
 */
const SEM_ORIGEM: AcaoAuditoria[] = [ACAO_AUDITORIA.EXPORTACAO];

export async function getSummary(params: {
  janelaHoras?: number;
} = {}): Promise<SingleResult<ResumoAuditoria>> {
  return executar(async () => {
    const janela_horas = params.janelaHoras ?? 24;
    const desde = new Date(Date.now() - janela_horas * 3_600_000).toISOString();

    // Duas colunas: a contagem não precisa de nome de pessoa nem de paciente,
    // e trazer os vínculos aqui seria puxar dado pessoal para desenhar quatro
    // números.
    const { data, error } = await getSupabaseClient()
      .from("audit_log")
      .select("action, is_restricted_material")
      .gte("occurred_at", desde)
      .limit(10_000);

    if (error) return falhaDe(error);

    const linhas = data as unknown as { action: string; is_restricted_material: boolean | null }[];

    return okOne(
      summarizeAudit({
        /**
         * Uma leitura de material restrito conta nos DOIS cartões, e é o
         * comportamento certo: ela é uma leitura, e é uma leitura sob sigilo.
         * Descontá-la de "Leitura" faria o total de leituras da janela não
         * bater com o número de linhas lidas, e quem confere uma trilha
         * confere exatamente isso.
         */
        actions: linhas.flatMap((linha) => [
          paraAcaoAuditoria(linha.action),
          ...(linha.is_restricted_material ? [ACAO_AUDITORIA.SIGILOSO] : []),
        ]),
        countable: CONTAVEIS,
        windowHours: janela_horas,
        withoutSource: SEM_ORIGEM,
      }),
    );
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
    const { data, error } = await consultarJanela(
      "actor_account_id, patient_id, accounts:actor_account_id ( full_name, email )",
      params.range,
    );
    if (error) return falhaDe(error);

    const linhas = data as unknown as Pick<
      LinhaLog,
      "actor_account_id" | "patient_id" | "accounts"
    >[];

    // Uma chamada só, e apenas quando há paciente na janela.
    const nomes = await nomesSeHouverPaciente(linhas);

    return okOne({
      // Ação sem ator é ação do próprio sistema — gatilho, rotina, integração.
      // Ela existe na trilha e não é filtrável por pessoa, então fica de fora
      // do seletor em vez de virar uma opção que não corresponde a ninguém.
      atores: buildFacetOptions(
        linhas.map((linha) => {
          if (!linha.actor_account_id) return null;

          const ator = umDe(linha.accounts);
          return {
            id: linha.actor_account_id,
            nome: ator?.full_name?.trim() || ator?.email || "Sem identificação",
          };
        }),
      ),
      pacientes: buildFacetOptions(
        linhas.map((linha) =>
          // `rotuloDePaciente` só devolve `null` sem id, e aqui há id.
          linha.patient_id
            ? { id: linha.patient_id, nome: rotuloDePaciente(linha.patient_id, nomes) ?? "" }
            : null,
        ),
      ),
      truncado: linhas.length >= TETO_TRILHA,
    });
  });
}

/* -------------------------------------------------------------------------
   EXPORTAÇÃO
   ------------------------------------------------------------------------- */

/** Linhas achatadas para CSV ou JSON. A serialização é da interface (`lib/csv.ts`). */
export async function exportar(params: ListParams = {}): Promise<ListResult<Record<string, string>>> {
  // Sem paginação: a exportação é do RECORTE inteiro, não da página aberta.
  return executar(async () =>
    toAuditExport(await list({ ...params, page: 1, pageSize: TETO_TRILHA })),
  );
}

export { exportar as export };
