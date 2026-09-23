import { FASE_TRATAMENTO_LABEL, STATUS_PACIENTE, STATUS_PACIENTE_LABEL } from "@/lib/enums";
import { ageInYears } from "@/lib/format";
import { maskCpf, maskEmail, maskPhone } from "@/lib/mask";
import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type FilterValue,
  type ListParams,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import { STATUS_CONVITE_LABEL } from "@/types/paciente";
import type {
  CampoPii,
  CuidadorVinculado,
  PacienteDetalhe,
  PacienteEntrada,
  PacienteListItem,
  PiiRevelada,
  ResultadoConvite,
  StatusConvite,
} from "@/types/paciente";
import { PATIENT_DEFAULT_SORT, normalizePatientSearch } from "../_people";
import { TETO_READ, executar, falhaDe, paraIso, umDe } from "./_helpers";
import { getSupabaseClient } from "./client";
import { codigoExibidoDoPaciente, paraCodigoDeFase, paraFase } from "./mapping";

/**
 * Pacientes.
 *
 * Três regras do banco moldam este arquivo inteiro:
 *
 * 1. **Leitura clínica é por `.rpc('read_…')`, nunca por `.from()`.** As
 *    políticas de leitura da equipe não valem para o role normal do PostgREST —
 *    valem só dentro das funções `read_*`, que registram em `audit_log` quem
 *    leu, quando e quantas linhas. Com `.from('patients')` o painel receberia
 *    zero linhas, silenciosamente. É o pedágio de auditoria, e ele é exigência
 *    de LGPD, não detalhe de implementação.
 *
 * 2. **A listagem é `read_patient_list`, e ela resolve tudo no servidor** —
 *    busca sem acento, filtro por protocolo, CID e fase, ordenação e o **total
 *    do conjunto filtrado**. `read_patients`, a antiga, aceitava só `p_limit` e
 *    `p_offset`, e é isso que este arquivo deixou de usar.
 *
 * 3. **A ficha continua em duas leituras diferentes da listagem.**
 *    `read_patient` devolve a linha inteira de `patients`; diagnóstico, plano e
 *    histórico saem de três funções próprias. Cada uma é um acesso registrado no
 *    titular — e é por isso que a listagem não as chama.
 *
 * > [!] O CPF da LISTA é mascarado pelo banco; o da FICHA, aqui.
 * `read_patient_list` devolve `cpf_masked`, e o documento inteiro não sai da
 * clínica — não há o que vazar no DevTools nem no cache do navegador.
 * `read_patient` ainda devolve `SETOF patients`, com CPF, telefone e e-mail em
 * claro: ali `revealPii` não é uma barreira, é convenção de interface, porque o
 * valor completo já chegou. `lib/mask.ts` reproduz a mesma forma do banco para
 * que lista e ficha não pareçam divergir. A view mascarada para `read_patient`
 * continua pendente com o responsável pelo banco.
 */

/* -------------------------------------------------------------------------
   LINHAS DO BANCO
   ------------------------------------------------------------------------- */

interface LinhaPaciente {
  id: string;
  account_id: string | null;
  full_name: string;
  cpf: string;
  birth_date: string;
  is_active: boolean;
  email: string | null;
  phone: string | null;
  insurance_name: string | null;
  treatment_phase_id: string | null;
  created_at: string;
  updated_at: string;
  /**
   * De onde veio cada metade da ficha, e quando.
   *
   * Chegam em toda leitura porque `read_patient` devolve `SETOF patients` — o
   * adapter as recebia e descartava. Hoje valem `local` em tudo, com a
   * integração desligada; deixam de ser inertes no dia em que ela ligar.
   */
  demographics_source: "local" | "gemed";
  demographics_synced_at: string | null;
  clinical_source: "local" | "gemed";
  clinical_synced_at: string | null;
}

/**
 * Uma linha de `patient_invitations`.
 *
 * O administrador tem política de `SELECT` nesta tabela — é a fila que o painel
 * lê para saber se o convite está de pé. O token não está aqui: a coluna guarda
 * o hash, e o valor em claro sai uma única vez de `invite_patient`.
 */
interface LinhaConvite {
  id: string;
  destination: string;
  status: "pending" | "accepted" | "cancelled";
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

interface LinhaDiagnostico {
  patient_id: string;
  cid10_id: string;
  staging: string | null;
  diagnosed_on: string | null;
  is_primary: boolean;
}

interface LinhaHistorico {
  patient_id: string;
  kind: "allergy" | "prior_reaction";
  description: string;
}

interface LinhaPlano {
  patient_id: string;
  protocol_name: string;
  cycles_planned: number | null;
  ended_on: string | null;
  source: "local" | "gemed";
  synced_at: string | null;
}

/** Catálogos usados para traduzir id em rótulo. São curtos e mudam por migração. */
interface Catalogos {
  cidPorId: Map<string, { code: string; label: string }>;
  fasePorId: Map<string, string>;
}

/**
 * Fases do tratamento, nos dois sentidos.
 *
 * A listagem precisa dos dois: `read_patient_list` devolve `treatment_phase_id`
 * e recebe `p_treatment_phase_id`, enquanto a tela fala em código de fase. O
 * catálogo é curto e de leitura direta, sem pedágio de auditoria.
 */
interface Fases {
  porId: Map<string, string>;
  idPorCodigo: Map<string, string>;
}

async function carregarFases(): Promise<Fases | ReturnType<typeof falhaDe>> {
  const { data, error } = await getSupabaseClient().from("treatment_phases").select("id, code");

  if (error) return falhaDe(error);

  const linhas = (data ?? []) as { id: string; code: string }[];

  return {
    porId: new Map(linhas.map((linha) => [linha.id, linha.code])),
    idPorCodigo: new Map(linhas.map((linha) => [linha.code, linha.id])),
  };
}

async function carregarCatalogos(): Promise<Catalogos | ReturnType<typeof falhaDe>> {
  const supabase = getSupabaseClient();

  const [cids, fases] = await Promise.all([
    supabase.from("cid10").select("id, code, label"),
    supabase.from("treatment_phases").select("id, code"),
  ]);

  if (cids.error) return falhaDe(cids.error);
  if (fases.error) return falhaDe(fases.error);

  return {
    cidPorId: new Map(
      (cids.data as { id: string; code: string; label: string }[]).map((linha) => [
        linha.id,
        { code: linha.code, label: linha.label },
      ]),
    ),
    fasePorId: new Map(
      (fases.data as { id: string; code: string }[]).map((linha) => [linha.id, linha.code]),
    ),
  };
}

/* -------------------------------------------------------------------------
   PROJEÇÃO
   ------------------------------------------------------------------------- */

/**
 * Situação do convite.
 *
 * `account_id` preenchido é o fato definitivo: o app foi ativado, e nenhum
 * convite pendente muda isso. Sem conta, quem responde é `patient_invitations`
 * — um convite pendente e dentro da validade é "enviado"; cancelado, expirado
 * ou inexistente é "não enviado", porque nenhum deles ativa nada.
 *
 * Convite expirado cai em "não enviado" de propósito: o estado que interessa a
 * quem opera é "precisa emitir de novo", e um rótulo próprio para expirado
 * exigiria uma quarta coluna na lista para dizer a mesma coisa.
 */
function statusDoConvite(linha: LinhaPaciente, convite?: LinhaConvite | null): StatusConvite {
  if (linha.account_id) return "aceito";
  if (!convite || convite.status !== "pending") return "nao_enviado";

  return new Date(convite.expires_at).getTime() > Date.now() ? "enviado" : "nao_enviado";
}

interface ContextoProjecao {
  catalogos: Catalogos;
  diagnostico?: LinhaDiagnostico | null;
  plano?: LinhaPlano | null;
  historico?: LinhaHistorico[];
  convite?: LinhaConvite | null;
}

function projetar(linha: LinhaPaciente, contexto: ContextoProjecao): PacienteListItem {
  const cid = contexto.diagnostico ? contexto.catalogos.cidPorId.get(contexto.diagnostico.cid10_id) : undefined;
  const faseCodigo = linha.treatment_phase_id
    ? contexto.catalogos.fasePorId.get(linha.treatment_phase_id)
    : null;

  return {
    id: linha.id,
    codigo: codigoExibidoDoPaciente(linha.id),
    nome: linha.full_name,
    cpf_mascarado: maskCpf(linha.cpf),
    nascimento: linha.birth_date,
    // `patients` não tem coluna de sexo. `null` mantém a ficha honesta: o
    // campo aparece vazio em vez de exibir um valor que ninguém informou.
    sexo: null,
    cid: cid?.code ?? "",
    cid_descricao: cid?.label ?? "",
    // `treatment_plans.protocol_name` é texto livre, não chave estrangeira:
    // não existe id de protocolo para referenciar. O nome serve aos dois.
    protocolo_id: contexto.plano?.protocol_name ?? "",
    protocolo_nome: contexto.plano?.protocol_name ?? "—",
    fase: paraFase(faseCodigo),
    status: linha.is_active ? STATUS_PACIENTE.ATIVO : STATUS_PACIENTE.INATIVO,
    // Não há classificação de risco no banco: nenhuma tabela de alerta, nenhuma
    // regra de criticidade. Calcular no painel seria inferência clínica no
    // front-end, que é justamente o que o projeto proíbe.
    risco: null,
    convite_status: statusDoConvite(linha, contexto.convite),
    criado_em: linha.created_at,
  };
}

function detalhar(linha: LinhaPaciente, contexto: ContextoProjecao): PacienteDetalhe {
  return {
    ...projetar(linha, contexto),
    telefone_mascarado: maskPhone(linha.phone),
    email_mascarado: maskEmail(linha.email),
    estadiamento: contexto.diagnostico?.staging ?? null,
    diagnostico_em: contexto.diagnostico?.diagnosed_on ?? null,
    alergias: (contexto.historico ?? [])
      .filter((linha) => linha.kind === "allergy")
      .map((linha) => linha.description),
    reacoes_previas: (contexto.historico ?? [])
      .filter((linha) => linha.kind === "prior_reaction")
      .map((linha) => linha.description),
    observacoes: null,
    convenio: linha.insurance_name,
    protocolo: contexto.plano
      ? {
          id: contexto.plano.protocol_name,
          nome: contexto.plano.protocol_name,
          medicamentos: [],
          ciclos: contexto.plano.cycles_planned,
          via: "intravenosa",
          ativo: !contexto.plano.ended_on,
        }
      : null,
    // Não há coluna de médico responsável em `patients`.
    medico_responsavel_id: null,
    medico_responsavel_nome: null,
    convite_enviado_em: paraIso(contexto.convite?.created_at),
    ultimo_acesso_app_em: null,
    desativado_em: null,
    motivo_desativacao: null,
    atualizado_em: linha.updated_at,
    origem_cadastro: {
      origem: linha.demographics_source,
      sincronizado_em: paraIso(linha.demographics_synced_at),
    },
    origem_clinica: {
      origem: linha.clinical_source,
      sincronizado_em: paraIso(linha.clinical_synced_at),
    },
    origem_plano: contexto.plano
      ? { origem: contexto.plano.source, sincronizado_em: paraIso(contexto.plano.synced_at) }
      : null,
  };
}

/* -------------------------------------------------------------------------
   LISTAGEM — `read_patient_list`
   -------------------------------------------------------------------------
   A função de listagem do banco resolve NO SERVIDOR o que este arquivo antes
   resolvia sobre uma janela de 200 linhas: busca sem acento, filtro por
   protocolo, CID e fase, ordenação e — o que consertou o defeito mais caro — o
   **total do conjunto filtrado**, que vem em cada linha.

   O que a versão anterior fazia, e por que era errado: `read_patients` só aceita
   `p_limit` e `p_offset`, e o servidor para em 200. A lista contava 200 e
   paginava sobre eles, então **a partir do paciente 201 a base ficava
   invisível** — sem erro, sem aviso, com uma paginação que dizia saber quantas
   páginas tinha.

   `read_patients` continua no ar até a migration que a aposenta. Este arquivo
   deixou de usá-la, e é esse o aviso que o responsável pelo banco espera.
   ------------------------------------------------------------------------- */

/** Uma linha de `read_patient_list` — projeção estreita, com CPF já mascarado. */
interface LinhaListaPaciente {
  patient_id: string;
  full_name: string;
  cpf_masked: string | null;
  birth_date: string;
  is_active: boolean;
  has_account: boolean;
  treatment_phase_id: string | null;
  treatment_phase_label: string | null;
  protocol_name: string | null;
  current_cycle_number: number | null;
  primary_cid10_code: string | null;
  primary_cid10_label: string | null;
  /** Total do conjunto FILTRADO, repetido em cada linha. */
  total_count: number;
}

/**
 * Campos de ordenação que a função aceita. Qualquer outro é **recusado** pelo
 * servidor — não há SQL dinâmico do outro lado —, então o que a tela pedir fora
 * desta lista cai no padrão em vez de virar erro na cara de quem clicou.
 */
const ORDENACAO: Record<string, "full_name" | "birth_date" | "created_at"> = {
  nome: "full_name",
  nascimento: "birth_date",
  criado_em: "created_at",
};

/** O primeiro valor de um filtro, como texto — ou `null` quando não há filtro. */
function primeiro(valor: FilterValue): string | null {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto === undefined || texto === null || texto === "" ? null : String(texto);
}

/**
 * `"ativo"`/`"inativo"` → `p_is_active`.
 *
 * `null` traz ativos e arquivados, que é o comportamento certo para "Status:
 * todos" — e o único jeito de a recepção encontrar uma ficha desativada para
 * reativá-la em vez de cadastrar a pessoa de novo.
 */
function situacaoFiltrada(valor: FilterValue): boolean | null {
  const status = primeiro(valor);
  if (status === STATUS_PACIENTE.ATIVO) return true;
  if (status === STATUS_PACIENTE.INATIVO) return false;
  return null;
}

function projetarLinha(linha: LinhaListaPaciente, fases: Fases): PacienteListItem {
  return {
    id: linha.patient_id,
    codigo: codigoExibidoDoPaciente(linha.patient_id),
    nome: linha.full_name,
    // Vem mascarado do banco: o documento inteiro não sai da clínica para a
    // lista. O completo continua em `read_patient`, um paciente por vez.
    cpf_mascarado: linha.cpf_masked ?? "—",
    nascimento: linha.birth_date,
    // `patients` não tem coluna de sexo. `null` mantém a ficha honesta: o campo
    // aparece vazio em vez de exibir um valor que ninguém informou.
    sexo: null,
    cid: linha.primary_cid10_code ?? "",
    cid_descricao: linha.primary_cid10_label ?? "",
    // `treatment_plans.protocol_name` é texto livre, não chave estrangeira: não
    // existe id de protocolo para referenciar. O nome serve aos dois.
    protocolo_id: linha.protocol_name ?? "",
    protocolo_nome: linha.protocol_name ?? "—",
    fase: paraFase(linha.treatment_phase_id ? fases.porId.get(linha.treatment_phase_id) : null),
    status: linha.is_active ? STATUS_PACIENTE.ATIVO : STATUS_PACIENTE.INATIVO,
    // Não há classificação de risco no banco, e não vai haver nesta fase:
    // "risco" são as etiquetas da sistematização de enfermagem do Gemed, fora
    // do escopo de leitura contratado. Calcular no painel seria inferência
    // clínica no front-end.
    risco: null,
    // Sai `has_account`, não `account_id`: é o que a lista precisa saber. O
    // convite pendente vive em `patient_invitations`, que é outra leitura.
    convite_status: linha.has_account ? "aceito" : "nao_enviado",
    // A projeção da lista não traz `created_at` — a ordenação por ele existe no
    // servidor, a coluna não. Aparece na ficha, onde `read_patient` devolve a
    // linha inteira.
    criado_em: null,
  };
}

/** Uma página de `read_patient_list`, com os filtros da tela já traduzidos. */
async function paginaDaLista(
  params: ListParams,
  fases: Fases,
  limite: number,
  deslocamento: number,
): Promise<LinhaListaPaciente[] | ReturnType<typeof falhaDe>> {
  const filtros = params.filters ?? {};
  const ordem = params.sort ?? PATIENT_DEFAULT_SORT;

  /*
   * A tela filtra por CÓDIGO de fase; a função recebe o ID.
   *
   * > [!] Fase que o catálogo não tem devolve lista vazia, e não a base inteira.
   * `manutencao` é fase do painel e não existe em `treatment_phases`; outras
   * estão na tabela desativadas. Nos dois casos o id sai `null` — e `null` é o
   * argumento de "sem filtro nenhum". Deixar assim fazia a tela responder
   * "todos os pacientes" a uma pergunta sobre uma fase específica, sem erro e
   * sem aviso, que é a pior forma de errar uma listagem.
   *
   * Zero é a resposta correta: se a fase não existe no catálogo, ninguém está
   * nela.
   */
  const fasePedida = primeiro(filtros.fase);
  const codigoDaFase = paraCodigoDeFase(fasePedida);
  const idDaFase = codigoDaFase ? (fases.idPorCodigo.get(codigoDaFase) ?? null) : null;

  if (fasePedida && !idDaFase) return [];

  const { data, error } = await getSupabaseClient().rpc("read_patient_list", {
    p_search: normalizePatientSearch(params.search) || null,
    p_protocol: primeiro(filtros.protocolo_id),
    p_cid10_code: primeiro(filtros.cid),
    p_treatment_phase_id: idDaFase,
    p_is_active: situacaoFiltrada(filtros.status),
    // Coluna que a tela ordena e o servidor não conhece cai no padrão da tela,
    // em vez de virar `undefined` — que faria o PostgREST usar o DEFAULT da
    // função e ordenar por nome sem ninguém ter pedido.
    p_order_by: ORDENACAO[ordem.field] ?? "created_at",
    p_order_desc: ordem.direction === "desc",
    p_limit: limite,
    p_offset: deslocamento,
  });

  if (error) return falhaDe(error);
  return (data ?? []) as LinhaListaPaciente[];
}

/**
 * Listagem paginada no servidor.
 *
 * O total vem em `total_count`, repetido em cada linha — e some quando a página
 * está vazia, porque não há linha para carregá-lo. Página vazia com deslocamento
 * é quase sempre um recorte que encolheu debaixo de uma paginação que ficou
 * parada numa página que não existe mais; nesse caso a função refaz a consulta
 * do começo **só para saber o total**, para que a tela ofereça a volta em vez de
 * dizer "nenhum paciente" sobre uma base cheia.
 */
export async function list(params: ListParams = {}): Promise<ListResult<PacienteListItem>> {
  return executar(async () => {
    const fases = await carregarFases();
    if (!("porId" in fases)) return fases;

    const pageSize = Math.min(params.pageSize ?? 20, TETO_READ);
    const deslocamento = Math.max(0, ((params.page ?? 1) - 1) * pageSize);

    const linhas = await paginaDaLista(params, fases, pageSize, deslocamento);
    if (!Array.isArray(linhas)) return linhas;

    if (linhas.length > 0) {
      return ok(
        linhas.map((linha) => projetarLinha(linha, fases)),
        linhas[0]?.total_count ?? linhas.length,
      );
    }

    if (deslocamento === 0) return ok([], 0);

    const sonda = await paginaDaLista(params, fases, 1, 0);
    if (!Array.isArray(sonda)) return sonda;

    return ok([], sonda[0]?.total_count ?? 0);
  });
}

/**
 * O convite mais recente da ficha.
 *
 * Leitura direta, sem pedágio: `patient_invitations` não é tabela clínica e o
 * administrador tem política de `SELECT` nela. O "mais recente" basta porque
 * emitir um convite cancela o pendente anterior — só existe um de pé por vez.
 */
async function carregarConvite(id: string): Promise<LinhaConvite | null | ReturnType<typeof falhaDe>> {
  const { data, error } = await getSupabaseClient()
    .from("patient_invitations")
    .select("id, destination, status, expires_at, created_at, accepted_at")
    .eq("patient_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return falhaDe(error);

  return (data as unknown as LinhaConvite | null) ?? null;
}

/** Ficha completa. Quatro chamadas auditadas, mais a fila de convites. */
export async function getById({ id }: { id: string }): Promise<SingleResult<PacienteDetalhe>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const catalogos = await carregarCatalogos();
    if (!("cidPorId" in catalogos)) return catalogos;

    const [paciente, diagnosticos, planos, historico, convite] = await Promise.all([
      supabase.rpc("read_patient", { p_patient_id: id }),
      supabase.rpc("read_patient_diagnoses", { p_patient_id: id }),
      supabase.rpc("read_treatment_plans", { p_patient_id: id }),
      supabase.rpc("read_patient_clinical_history", { p_patient_id: id }),
      carregarConvite(id),
    ]);

    if (paciente.error) return falhaDe(paciente.error);
    if (diagnosticos.error) return falhaDe(diagnosticos.error);
    if (planos.error) return falhaDe(planos.error);
    if (historico.error) return falhaDe(historico.error);
    if (convite && "error" in convite) return convite;

    const linha = ((paciente.data ?? []) as LinhaPaciente[])[0];
    if (!linha) return fail(ERROR_CODE.NOT_FOUND, "Paciente não encontrado.");

    const listaDiagnosticos = (diagnosticos.data ?? []) as LinhaDiagnostico[];
    const listaPlanos = (planos.data ?? []) as LinhaPlano[];

    return okOne(
      detalhar(linha, {
        catalogos,
        diagnostico: listaDiagnosticos.find((item) => item.is_primary) ?? listaDiagnosticos[0] ?? null,
        // Plano vigente é a linha com `ended_on` nulo.
        plano: listaPlanos.find((item) => !item.ended_on) ?? listaPlanos[0] ?? null,
        historico: (historico.data ?? []) as LinhaHistorico[],
        convite,
      }),
    );
  });
}

/**
 * Revelação de dado pessoal.
 *
 * A leitura é a mesma `read_patient` da ficha, e é por isso que a chamada
 * continua valendo a pena: ela grava mais uma linha em `audit_log`, com o
 * mesmo ator e o mesmo paciente. É o rastro que a LGPD exige do ato de
 * revelar — ainda que, sem view mascarada no banco, o valor já estivesse no
 * navegador.
 */
export async function revealPii({
  id,
  campos,
}: {
  id: string;
  campos: CampoPii[];
}): Promise<SingleResult<PiiRevelada>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient().rpc("read_patient", { p_patient_id: id });

    if (error) return falhaDe(error);

    const linha = ((data ?? []) as LinhaPaciente[])[0];
    if (!linha) return fail(ERROR_CODE.NOT_FOUND, "Paciente não encontrado.");

    const revelado: PiiRevelada = {};
    if (campos.includes("cpf")) revelado.cpf = linha.cpf;
    if (campos.includes("telefone") && linha.phone) revelado.telefone = linha.phone;
    if (campos.includes("email") && linha.email) revelado.email = linha.email;

    return okOne(revelado);
  });
}

/* -------------------------------------------------------------------------
   EXPORTAÇÃO
   ------------------------------------------------------------------------- */

/**
 * Linhas da exportação, com os MESMOS filtros da tela e sem paginação.
 *
 * As colunas são decididas aqui, não pela tela: a lista de campos que pode
 * deixar a clínica é regra de negócio, e regra de negócio não fica em botão.
 * Nenhuma coluna carrega PII em claro.
 */
/**
 * Varredura da listagem inteira, em páginas de 200.
 *
 * Existe para a exportação e para os relatórios que contam a base — os dois
 * casos em que a pergunta é sobre o conjunto, não sobre uma página. **Cada
 * página é uma leitura registrada em `audit_log`**, e é por isso que nenhuma
 * tela chama isto: varredura é ato, não render.
 *
 * Devolve o que couber até o teto, mais o total real e se ficou parcial — quem
 * chama decide entre recusar e declarar. Um número parcial apresentado como
 * total é o modo de errar que este projeto mais evita.
 */
export interface Varredura {
  itens: PacienteListItem[];
  total: number;
  parcial: boolean;
}

export async function varrerLista(
  params: ListParams,
  teto: number,
): Promise<Varredura | ReturnType<typeof falhaDe>> {
  const fases = await carregarFases();
  if (!("porId" in fases)) return fases;

  const itens: PacienteListItem[] = [];
  let total = 0;

  for (let deslocamento = 0; deslocamento < teto; deslocamento += TETO_READ) {
    const pagina = await paginaDaLista(params, fases, TETO_READ, deslocamento);
    if (!Array.isArray(pagina)) return pagina;

    total = pagina[0]?.total_count ?? total;
    itens.push(...pagina.map((linha) => projetarLinha(linha, fases)));

    if (pagina.length < TETO_READ) break;
  }

  return { itens, total, parcial: total > itens.length };
}

/**
 * Teto da exportação.
 *
 * A função do banco devolve no máximo 200 linhas por chamada, então exportar a
 * base é um laço de chamadas — e **cada chamada grava uma leitura em
 * `audit_log`**. Dez é o limite em que a trilha ainda descreve o ato ("exportou
 * a base filtrada") em vez de virar ruído.
 *
 * Acima disso a exportação é **recusada com o motivo**, em vez de entregar um
 * arquivo truncado: uma planilha com 2.000 das 5.000 fichas, sem nada no arquivo
 * dizendo que faltam 3.000, é o tipo de recorte que vira decisão errada — e
 * ninguém confere a contagem de um CSV que abriu certo.
 */
const TETO_EXPORTACAO = TETO_READ * 10;

export async function exportar(
  params: ListParams = {},
): Promise<ListResult<Record<string, string>>> {
  return executar(async () => {
    const varredura = await varrerLista(params, TETO_EXPORTACAO);
    if (!("itens" in varredura)) return varredura;

    // Recusar é mais honesto do que truncar: uma planilha com 2.000 das 5.000
    // fichas, sem nada NO ARQUIVO dizendo que faltam 3.000, vira decisão errada
    // — e ninguém confere a contagem de um CSV que abriu certo.
    if (varredura.parcial) {
      return fail(
        ERROR_CODE.VALIDATION,
        `O recorte tem ${varredura.total} fichas e a exportação vai até ${TETO_EXPORTACAO}. Estreite a busca ou os filtros antes de exportar.`,
      );
    }

    // Sexo, risco e data de cadastro NÃO viram coluna: a projeção da listagem
    // não os traz. Uma coluna inteira em branco numa planilha se lê como
    // cadastro incompleto e manda a equipe procurar um dado que nunca esteve
    // ali — o mesmo motivo pelo qual a tela omite indicador sem fonte.
    const linhas = varredura.itens.map((item) => ({
      Código: item.codigo,
      Paciente: item.nome,
      CPF: item.cpf_mascarado,
      Idade: String(ageInYears(item.nascimento) ?? ""),
      CID: item.cid,
      Diagnóstico: item.cid_descricao,
      Protocolo: item.protocolo_nome,
      Fase: item.fase ? FASE_TRATAMENTO_LABEL[item.fase] : "",
      Status: STATUS_PACIENTE_LABEL[item.status],
      "Acesso ao app": STATUS_CONVITE_LABEL[item.convite_status],
    }));

    return ok(linhas, linhas.length);
  });
}

// `export` é palavra reservada: a função nasce como `exportar` e é publicada
// com o nome do contrato.
export { exportar as export };

/* -------------------------------------------------------------------------
   ESCRITA
   -------------------------------------------------------------------------
   Toda escrita de ficha é RPC. `patients` não tem política de INSERT nem de
   UPDATE para `authenticated`: as funções são `SECURITY DEFINER`, exigem
   administrador ativo e deixam a autoria em `audit_log` por gatilho — não há
   coluna `created_by`, e não deve haver.

   Três regras do banco que moldam o que está abaixo:

   1. **Argumento nulo em `update_patient` significa "não mexer".** A função
      usa `coalesce`, então ela troca valor e não apaga contato. Mandar `null`
      para limpar um telefone não limpa nada — e é por isso que o formulário de
      edição trata campo vazio como "manter", e não como "apagar".
   2. **Histórico clínico só cresce.** `add_patient_clinical_history` é a única
      operação que existe sobre `patient_clinical_history`: não há editar nem
      apagar, porque registro clínico é imutável. A edição acrescenta o que é
      novo e ignora o resto.
   3. **O token do convite sai uma vez.** A tabela guarda o hash. Se a resposta
      se perder, não há como reemitir o mesmo código — só emitir outro, o que
      cancela o anterior.
   ------------------------------------------------------------------------- */

/** Um termo do histórico, na forma que a RPC recebe. */
type TipoHistorico = "allergy" | "prior_reaction";

/**
 * Acrescenta ao histórico clínico o que ainda não está lá.
 *
 * Sequencial, e não `Promise.all`: são escritas auditadas na mesma ficha, e um
 * lote paralelo embaralharia a ordem das linhas na trilha sem ganhar nada
 * perceptível — a lista tem unidades, não centenas.
 *
 * A primeira falha interrompe e é devolvida. Seguir adiante deixaria a ficha
 * com metade das alergias gravadas e a tela dizendo que salvou.
 */
async function acrescentarHistorico(
  id: string,
  termos: string[] | undefined,
  tipo: TipoHistorico,
  jaRegistrados: Set<string>,
): Promise<ReturnType<typeof falhaDe> | null> {
  const supabase = getSupabaseClient();

  for (const termo of termos ?? []) {
    const limpo = termo.trim();
    if (!limpo || jaRegistrados.has(limpo.toLowerCase())) continue;

    const { error } = await supabase.rpc("add_patient_clinical_history", {
      p_patient_id: id,
      p_kind: tipo,
      p_description: limpo,
    });

    if (error) return falhaDe(error);
    jaRegistrados.add(limpo.toLowerCase());
  }

  return null;
}

/** O que a ficha já tem de histórico, em minúsculas, para não duplicar linha. */
async function historicoRegistrado(
  id: string,
  tipo: TipoHistorico,
): Promise<Set<string> | ReturnType<typeof falhaDe>> {
  const { data, error } = await getSupabaseClient().rpc("read_patient_clinical_history", {
    p_patient_id: id,
  });

  if (error) return falhaDe(error);

  return new Set(
    ((data ?? []) as LinhaHistorico[])
      .filter((linha) => linha.kind === tipo)
      .map((linha) => linha.description.trim().toLowerCase()),
  );
}

/**
 * Cadastro da ficha.
 *
 * A ficha nasce SEM CONTA: `create_patient` não cria acesso, e a ativação do
 * app é outro ato — o convite. Isso é do desenho, não uma etapa que faltou:
 * quem cria a conta é a própria pessoa, no aplicativo, e o convite é o que liga
 * uma coisa à outra.
 *
 * Diagnóstico, estadiamento, protocolo e fase não entram aqui. Ver
 * `PacienteEntrada`.
 */
export async function create(entrada: PacienteEntrada): Promise<SingleResult<PacienteDetalhe>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("create_patient", {
      p_full_name: entrada.nome,
      // A RPC normaliza a máscara, mas mandar os dígitos economiza a dúvida.
      p_cpf: entrada.cpf,
      p_birth_date: entrada.nascimento,
      p_phone: entrada.telefone || null,
      p_email: entrada.email || null,
      p_insurance_name: entrada.convenio ?? null,
    });

    if (error) return falhaDe(error);

    const id = data as string | null;
    if (!id) return fail(ERROR_CODE.UNKNOWN, "O cadastro não devolveu o identificador da ficha.");

    // A ficha já existe. Daqui para a frente, uma falha não desfaz o cadastro —
    // devolvê-la como erro do cadastro faria alguém tentar de novo e esbarrar
    // em "já existe ficha com este CPF". Por isso o que falha aqui é reportado
    // com a ficha JÁ CRIADA: a tela abre a ficha e mostra o que faltou.
    const vazio = new Set<string>();
    const erroAlergia = await acrescentarHistorico(id, entrada.alergias, "allergy", vazio);
    if (erroAlergia) return erroAlergia;

    const erroReacao = await acrescentarHistorico(
      id,
      entrada.reacoes_previas,
      "prior_reaction",
      new Set<string>(),
    );
    if (erroReacao) return erroReacao;

    // `enviar_convite` NÃO é tratado aqui, de propósito: o convite devolve um
    // código que só existe uma vez, e ele precisa chegar à tela. Emiti-lo aqui
    // dentro o descartaria — quem encadeia cadastro e convite é o hook, que
    // sabe para onde levar a resposta.

    return getById({ id });
  });
}

/**
 * Correção da ficha.
 *
 * Só vai ao banco o que veio no payload: `update_patient` entende ausente como
 * "manter", e a tela de edição manda contato apenas quando ele foi digitado —
 * o campo chega mascarado, e reenviá-lo gravaria a máscara por cima do número.
 */
export async function update({
  id,
  dados,
}: {
  id: string;
  dados: Partial<PacienteEntrada>;
}): Promise<SingleResult<PacienteDetalhe>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { error } = await supabase.rpc("update_patient", {
      p_patient_id: id,
      p_full_name: dados.nome ?? null,
      // CPF não entra na edição: é a chave do cadastro, e o banco o congela
      // assim que a ficha tem conta vinculada.
      p_birth_date: dados.nascimento ?? null,
      p_phone: dados.telefone ?? null,
      p_email: dados.email ?? null,
      p_insurance_name: dados.convenio ?? null,
    });

    if (error) return falhaDe(error);

    if (dados.alergias?.length) {
      const registradas = await historicoRegistrado(id, "allergy");
      if (!(registradas instanceof Set)) return registradas;

      const erro = await acrescentarHistorico(id, dados.alergias, "allergy", registradas);
      if (erro) return erro;
    }

    if (dados.reacoes_previas?.length) {
      const registradas = await historicoRegistrado(id, "prior_reaction");
      if (!(registradas instanceof Set)) return registradas;

      const erro = await acrescentarHistorico(id, dados.reacoes_previas, "prior_reaction", registradas);
      if (erro) return erro;
    }

    return getById({ id });
  });
}

/**
 * Desativação lógica.
 *
 * `set_patient_active(false)` nunca apaga: dado clínico é imutável, e o
 * histórico precisa continuar auditável depois do desligamento.
 *
 * > [!] O motivo NÃO chega ao banco.
 * `audit_log` guarda o ato e o ator, e não tem coluna de justificativa. O
 * motivo digitado fica na trilha do painel — a tela continua exigindo-o porque
 * é ele que dá sentido à linha, mas quem reler o banco verá a desativação sem
 * ele. Pedido registrado com o responsável pelo banco.
 */
export async function deactivate({
  id,
  motivo,
}: {
  id: string;
  motivo: string;
}): Promise<SingleResult<PacienteDetalhe>> {
  return executar(async () => {
    if (!motivo.trim()) {
      return fail(ERROR_CODE.VALIDATION, "Informe o motivo da desativação.");
    }

    const { error } = await getSupabaseClient().rpc("set_patient_active", {
      p_patient_id: id,
      p_is_active: false,
    });

    if (error) return falhaDe(error);

    return getById({ id });
  });
}

/**
 * Emite o convite de acesso ao app.
 *
 * Devolve o token em texto puro — **uma vez**, e não há como reemiti-lo: o
 * banco guarda só o hash. Enquanto não houver provedor de envio, é o painel que
 * o exibe para alguém passar ao paciente, e é isso que torna a ativação
 * testável em vez de bloqueada por uma credencial de terceiro.
 *
 * Emitir cancela o convite pendente anterior. Não é cortesia: quem reemite
 * costuma estar corrigindo o telefone, e manter o token antigo vivo manteria
 * válido exatamente o convite que foi para o número errado.
 */
export async function sendInvite({ id }: { id: string }): Promise<SingleResult<ResultadoConvite>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("invite_patient", { p_patient_id: id });
    if (error) return falhaDe(error);

    const emitido = ((data ?? []) as { invitation_id: string; token: string }[])[0];
    if (!emitido) return fail(ERROR_CODE.UNKNOWN, "O convite não devolveu o código de ativação.");

    // Destino e validade saem da fila, não da RPC: `invite_patient` devolve só
    // o par (id, token). Se esta leitura falhar, o convite continua emitido —
    // por isso ela não derruba a resposta, apenas deixa os dois campos vazios.
    const convite = await carregarConvite(id);
    const linha = convite && !("error" in convite) ? convite : null;

    return okOne<ResultadoConvite>({
      paciente_id: id,
      destino: maskPhone(linha?.destination ?? null),
      enviado_em: paraIso(linha?.created_at) ?? new Date().toISOString(),
      token: emitido.token,
      expira_em: paraIso(linha?.expires_at),
    });
  });
}

/* -------------------------------------------------------------------------
   ACOMPANHANTES
   -------------------------------------------------------------------------
   Leitura direta, sem pedágio: `patient_caregivers` e `caregivers` têm
   política de SELECT para o administrador, fora do papel `clinical_reader`
   que barra as tabelas clínicas.

   O NOME E O CONTATO SÃO DE OUTRA PESSOA, e é o que decide a forma desta
   leitura. Vêm de `accounts`, e saem mascarados — sem operação de revelação,
   ao contrário do que acontece com o paciente. O painel precisa saber que o
   vínculo existe e quem é; quem precisa do contato do acompanhante é o
   titular, no aplicativo dele.

   > [!] O convite de acompanhante PENDENTE é invisível aqui.
   `caregiver_invitations` só tem política para o titular — convidar é ato dele,
   e o painel não participa. A tela diz isso, porque a ausência do convite
   pendente numa lista de vínculos parece dado faltando.
   ------------------------------------------------------------------------- */

interface LinhaVinculo {
  id: string;
  status: "active" | "revoked";
  granted_at: string;
  revoked_at: string | null;
  caregivers: {
    accounts: { full_name: string | null; email: string; phone: string | null } | null;
  } | null;
}

export async function listCuidadores({
  id,
}: {
  id: string;
}): Promise<ListResult<CuidadorVinculado>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("patient_caregivers")
      .select(
        "id, status, granted_at, revoked_at, caregivers:caregiver_id ( accounts:account_id ( full_name, email, phone ) )",
      )
      .eq("patient_id", id)
      .order("granted_at", { ascending: false });

    if (error) return falhaDe(error);

    return ok(
      (data as unknown as LinhaVinculo[]).map((linha) => {
        const conta = umDe(umDe(linha.caregivers)?.accounts);

        return {
          id: linha.id,
          // Sem nome na conta, o e-mail identifica; sem os dois, dizer que não
          // se alcançou é melhor do que uma linha em branco que parece defeito.
          nome: conta?.full_name?.trim() || conta?.email || "Acompanhante não identificado",
          email_mascarado: maskEmail(conta?.email ?? null),
          telefone_mascarado: conta?.phone ? maskPhone(conta.phone) : null,
          status: linha.status === "revoked" ? "revogado" : "ativo",
          vinculado_em: paraIso(linha.granted_at) ?? linha.granted_at,
          revogado_em: paraIso(linha.revoked_at),
        };
      }),
    );
  });
}

/* -------------------------------------------------------------------------
   VÍNCULO COM A CONTA DO APLICATIVO
   ------------------------------------------------------------------------- */

/**
 * Cancela o convite pendente sem emitir outro.
 *
 * A RPC recebe o id do CONVITE, e a tela conhece o id da ficha — a tradução
 * acontece aqui. Sem convite de pé, o backend recusa com `invitation_not_pending`,
 * e a recusa é correta: cancelar o que não existe não é operação silenciosa.
 */
export async function cancelInvite({ id }: { id: string }): Promise<SingleResult<PacienteDetalhe>> {
  return executar(async () => {
    const convite = await carregarConvite(id);
    if (convite && "error" in convite) return convite;

    if (!convite || convite.status !== "pending") {
      return fail(ERROR_CODE.VALIDATION, "Não há convite pendente para cancelar.");
    }

    const { error } = await getSupabaseClient().rpc("cancel_patient_invitation", {
      p_invitation_id: convite.id,
    });

    if (error) return falhaDe(error);

    return getById({ id });
  });
}

/**
 * Desfaz o vínculo entre a ficha e a conta do aplicativo.
 *
 * A ficha, o histórico e a conta ficam — desfaz-se a ligação. É o caminho para
 * corrigir uma ativação feita na ficha errada, e o pré-requisito para trocar o
 * CPF de quem já ativou: um gatilho do banco congela o CPF depois da ativação.
 */
export async function unlinkAccount({ id }: { id: string }): Promise<SingleResult<PacienteDetalhe>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("unlink_patient_account", {
      p_patient_id: id,
    });

    if (error) return falhaDe(error);

    return getById({ id });
  });
}
