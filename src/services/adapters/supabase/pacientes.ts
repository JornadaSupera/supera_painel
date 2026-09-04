import { FASE_TRATAMENTO_LABEL, RISCO_LABEL, STATUS_PACIENTE, STATUS_PACIENTE_LABEL } from "@/lib/enums";
import { ageInYears, formatDate } from "@/lib/format";
import { digitsOnly, maskCpf, maskEmail, maskPhone } from "@/lib/mask";
import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type ListParams,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import { STATUS_CONVITE_LABEL } from "@/types/paciente";
import type {
  CampoPii,
  PacienteDetalhe,
  PacienteListItem,
  PiiRevelada,
  StatusConvite,
} from "@/types/paciente";
import { paginate } from "../_list";
import { TETO_READ, executar, falhaDe } from "./_helpers";
import { getSupabaseClient } from "./client";
import { codigoExibidoDoPaciente, paraFase } from "./mapping";

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
 * 2. **`read_patients` aceita só `p_limit` e `p_offset`.** Não há busca, filtro,
 *    ordenação nem total. O que a tela pede além disso é resolvido sobre a
 *    janela que a função devolveu — e o teto do servidor é de 200 linhas.
 *
 * 3. **O cadastro é de duas metades, e só uma é gravável.** Nome, CPF,
 *    nascimento, telefone e e-mail vivem em `patients`, que tem GRANT de
 *    INSERT e UPDATE mas nenhuma política de RLS para esses verbos — logo, são
 *    somente leitura. Já diagnóstico, alergias, protocolo e fase têm RPC
 *    própria (`upsert_patient_diagnosis`, `add_patient_clinical_history`,
 *    `set_treatment_plan`, `set_treatment_phase`) e são graváveis hoje.
 *
 * > [!] O mascaramento acontece aqui, no cliente.
 * O desenho original previa uma view mascarada no Postgres — `read_patient`
 * devolve `SETOF patients`, com CPF, telefone e e-mail em claro. Enquanto a
 * view não existir, `revealPii` não é uma barreira, é uma convenção de
 * interface: o valor completo já chegou ao navegador. Está registrado no resumo
 * da entrega como pendência para o responsável pelo banco.
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
  treatment_phase_id: string | null;
  created_at: string;
  updated_at: string;
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
}

/** Catálogos usados para traduzir id em rótulo. São curtos e mudam por migração. */
interface Catalogos {
  cidPorId: Map<string, { code: string; label: string }>;
  fasePorId: Map<string, string>;
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
 * Situação do convite, derivada do vínculo com a conta.
 *
 * O banco não guarda o envio: não há RPC que ligue `patients.account_id` a uma
 * conta, e a ativação do app depende exatamente dela. O que dá para afirmar é
 * se a pessoa já tem conta ou não — "enviado" é estado que ninguém observa.
 */
function statusDoConvite(linha: LinhaPaciente): StatusConvite {
  return linha.account_id ? "aceito" : "nao_enviado";
}

interface ContextoProjecao {
  catalogos: Catalogos;
  diagnostico?: LinhaDiagnostico | null;
  plano?: LinhaPlano | null;
  historico?: LinhaHistorico[];
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
    convite_status: statusDoConvite(linha),
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
    convite_enviado_em: null,
    ultimo_acesso_app_em: null,
    desativado_em: null,
    motivo_desativacao: null,
    atualizado_em: linha.updated_at,
  };
}

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

const CAMPOS_BUSCA = ["nome", "codigo", "cpf_mascarado"];
const ORDENACAO_PADRAO = { field: "criado_em", direction: "desc" } as const;

/**
 * Busca por documento tem que funcionar com o que a pessoa digita. Como o CPF
 * chega mascarado na projeção, um termo puramente numérico casa apenas com os
 * dígitos visíveis — e é só isso que a listagem consegue oferecer sem trazer o
 * documento inteiro de todo mundo para o navegador.
 */
function normalizarBusca(search?: string): string {
  const termo = (search ?? "").trim();
  return /^[\d.\-\s/]+$/.test(termo) && termo.length > 0 ? digitsOnly(termo) : termo;
}

async function carregarPagina(): Promise<
  { linhas: LinhaPaciente[]; catalogos: Catalogos } | ReturnType<typeof falhaDe>
> {
  const catalogos = await carregarCatalogos();
  if (!("cidPorId" in catalogos)) return catalogos;

  const { data, error } = await getSupabaseClient().rpc("read_patients", {
    p_limit: TETO_READ,
    p_offset: 0,
  });

  if (error) return falhaDe(error);

  return { linhas: (data ?? []) as LinhaPaciente[], catalogos };
}

/**
 * Listagem.
 *
 * Uma consulta traz a janela inteira permitida pelo servidor; busca, filtro,
 * ordenação e paginação são resolvidos sobre ela. Não é preferência: a função
 * do banco não aceita nenhuma dessas coisas, e paginar por `p_offset` sem saber
 * o total daria uma paginação que não sabe quantas páginas tem.
 *
 * Os diagnósticos vêm por paciente, e cada chamada é auditada — por isso a
 * listagem NÃO os busca. CID e protocolo aparecem preenchidos na ficha, onde a
 * leitura individual já é um evento registrado de qualquer forma.
 */
export async function list(params: ListParams = {}): Promise<ListResult<PacienteListItem>> {
  return executar(async () => {
    const pagina = await carregarPagina();
    if (!("linhas" in pagina)) return pagina;

    const itens = pagina.linhas.map((linha) => projetar(linha, { catalogos: pagina.catalogos }));

    return paginate(
      itens,
      { ...params, search: normalizarBusca(params.search), sort: params.sort ?? ORDENACAO_PADRAO },
      { searchFields: CAMPOS_BUSCA },
    );
  });
}

/** Ficha completa. Três chamadas auditadas: paciente, diagnósticos e plano. */
export async function getById({ id }: { id: string }): Promise<SingleResult<PacienteDetalhe>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const catalogos = await carregarCatalogos();
    if (!("cidPorId" in catalogos)) return catalogos;

    const [paciente, diagnosticos, planos, historico] = await Promise.all([
      supabase.rpc("read_patient", { p_patient_id: id }),
      supabase.rpc("read_patient_diagnoses", { p_patient_id: id }),
      supabase.rpc("read_treatment_plans", { p_patient_id: id }),
      supabase.rpc("read_patient_clinical_history", { p_patient_id: id }),
    ]);

    if (paciente.error) return falhaDe(paciente.error);
    if (diagnosticos.error) return falhaDe(diagnosticos.error);
    if (planos.error) return falhaDe(planos.error);
    if (historico.error) return falhaDe(historico.error);

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
export async function exportar(
  params: ListParams = {},
): Promise<ListResult<Record<string, string>>> {
  return executar(async () => {
    const pagina = await carregarPagina();
    if (!("linhas" in pagina)) return pagina;

    const itens = pagina.linhas.map((linha) => projetar(linha, { catalogos: pagina.catalogos }));

    const filtrados = paginate(
      itens,
      {
        ...params,
        search: normalizarBusca(params.search),
        sort: params.sort ?? ORDENACAO_PADRAO,
        page: 1,
        pageSize: Math.max(1, itens.length),
      },
      { searchFields: CAMPOS_BUSCA },
    );

    const linhas = filtrados.data.map((item) => ({
      Código: item.codigo,
      Paciente: item.nome,
      CPF: item.cpf_mascarado,
      Idade: String(ageInYears(item.nascimento) ?? ""),
      Sexo: item.sexo ?? "",
      CID: item.cid,
      Diagnóstico: item.cid_descricao,
      Protocolo: item.protocolo_nome,
      Fase: item.fase ? FASE_TRATAMENTO_LABEL[item.fase] : "",
      Risco: item.risco ? RISCO_LABEL[item.risco] : "",
      Status: STATUS_PACIENTE_LABEL[item.status],
      Convite: STATUS_CONVITE_LABEL[item.convite_status],
      "Cadastrado em": formatDate(item.criado_em),
    }));

    return ok(linhas, linhas.length);
  });
}

// `export` é palavra reservada: a função nasce como `exportar` e é publicada
// com o nome do contrato.
export { exportar as export };

/* -------------------------------------------------------------------------
   O QUE O BACKEND AINDA NÃO OFERECE
   -------------------------------------------------------------------------
   `patients` tem apenas política de SELECT. Não há INSERT para `authenticated`
   e não há RPC de cadastro, de desativação nem de convite — a própria ativação
   do app do paciente depende de um vínculo `patients.account_id` que ainda não
   tem função no banco.

   Estas recusas são explícitas, e não stubs genéricos, porque a tela usa a
   mensagem para desabilitar a ação antes do formulário.
   ------------------------------------------------------------------------- */

const EM_DESENVOLVIMENTO =
  "Ainda em desenvolvimento: o backend não expõe esta operação. Fale com o responsável pelo banco.";

export async function create(): Promise<SingleResult<PacienteDetalhe>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, `Cadastro de paciente. ${EM_DESENVOLVIMENTO}`);
}

export async function update(): Promise<SingleResult<PacienteDetalhe>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, `Edição de ficha. ${EM_DESENVOLVIMENTO}`);
}

export async function deactivate(): Promise<SingleResult<PacienteDetalhe>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, `Desativação de paciente. ${EM_DESENVOLVIMENTO}`);
}

export async function sendInvite(): Promise<SingleResult<never>> {
  return fail(
    ERROR_CODE.NOT_IMPLEMENTED,
    `Convite de acesso ao app. ${EM_DESENVOLVIMENTO}`,
  );
}
