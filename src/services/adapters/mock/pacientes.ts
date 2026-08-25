import { FASE_TRATAMENTO_LABEL, RISCO_LABEL, STATUS_PACIENTE, STATUS_PACIENTE_LABEL } from "@/lib/enums";
import { formatDate, ageInYears } from "@/lib/format";
import { maskCpf, maskEmail, maskPhone, digitsOnly } from "@/lib/mask";
import { cids } from "@/mocks/cids";
import { pacientes, type PacienteMock } from "@/mocks/pacientes";
import { protocolos } from "@/mocks/protocolos";
import { usuarios } from "@/mocks/usuarios";
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
  PacienteEntrada,
  PacienteListItem,
  PiiRevelada,
  ResultadoConvite,
} from "@/types/paciente";
import { now, paginate, simulate, uuid } from "./_helpers";

/**
 * Pacientes — a primeira tela do painel com dado pessoal de verdade.
 *
 * Duas regras estruturam este arquivo:
 *
 * 1. **A projeção é do backend.** `list` e `getById` devolvem CPF, telefone e
 *    e-mail já mascarados. O valor completo só sai por `revealPii`. Enquanto o
 *    dado inteiro não deixa esta camada, não há o que vazar em cache de
 *    navegador, captura de tela ou log do DevTools.
 * 2. **Nada de agregar ou decidir na tela.** Os joins com `cids`, `protocolos`
 *    e `usuarios` acontecem aqui, como acontecerão no `select` do PostgREST.
 *
 * > [!] A escrita é em memória e some ao recarregar a página. É proposital: o
 * mock não deve fingir persistência que o painel ainda não tem — e PHI em
 * `localStorage` é exatamente o que o projeto proíbe.
 */

/* -------------------------------------------------------------------------
   PROJEÇÕES
   ------------------------------------------------------------------------- */

function descricaoCid(codigo: string): string {
  return cids.find((cid) => cid.codigo === codigo)?.descricao ?? codigo;
}

function protocoloPorId(id: string) {
  return protocolos.find((protocolo) => protocolo.id === id) ?? null;
}

function nomeDoMedico(id: string | null): string | null {
  if (!id) return null;
  return usuarios.find((usuario) => usuario.id === id)?.nome ?? null;
}

/** O que a listagem enxerga. Equivale a um `.select(...)` explícito. */
function toListItem(row: PacienteMock): PacienteListItem {
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    cpf_mascarado: maskCpf(row.cpf),
    nascimento: row.nascimento,
    sexo: row.sexo,
    cid: row.cid,
    cid_descricao: descricaoCid(row.cid),
    protocolo_id: row.protocolo_id,
    protocolo_nome: protocoloPorId(row.protocolo_id)?.nome ?? "—",
    fase: row.fase,
    status: row.status,
    risco: row.risco,
    convite_status: row.convite_status,
    criado_em: row.criado_em,
  };
}

/** Ficha completa — ainda sem PII em claro. */
function toDetalhe(row: PacienteMock): PacienteDetalhe {
  return {
    ...toListItem(row),
    telefone_mascarado: maskPhone(row.telefone),
    email_mascarado: maskEmail(row.email),
    estadiamento: row.estadiamento,
    diagnostico_em: row.diagnostico_em,
    alergias: row.alergias,
    reacoes_previas: row.reacoes_previas,
    observacoes: row.observacoes,
    protocolo: protocoloPorId(row.protocolo_id),
    medico_responsavel_id: row.medico_responsavel_id,
    medico_responsavel_nome: nomeDoMedico(row.medico_responsavel_id),
    convite_enviado_em: row.convite_enviado_em,
    ultimo_acesso_app_em: row.ultimo_acesso_app_em,
    desativado_em: row.desativado_em,
    motivo_desativacao: row.motivo_desativacao,
    atualizado_em: row.atualizado_em,
  };
}

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

const CAMPOS_BUSCA = ["nome", "codigo", "cpf"];

/**
 * Busca por CPF tem que funcionar com o que a pessoa digita — "123.456" ou
 * "123456". Como a coluna guarda só dígitos, o termo é reduzido a dígitos
 * quando é claramente um documento. Na Fase 15 isso vira `regexp_replace` no
 * lado do Postgres, pelo mesmo motivo.
 */
function normalizarBusca(search?: string): string {
  const termo = (search ?? "").trim();
  return /^[\d.\-\s/]+$/.test(termo) && termo.length > 0 ? digitsOnly(termo) : termo;
}

const ORDENACAO_PADRAO = { field: "criado_em", direction: "desc" } as const;

export async function list(params: ListParams = {}): Promise<ListResult<PacienteListItem>> {
  return simulate(() => {
    const resultado = paginate(
      pacientes,
      { ...params, search: normalizarBusca(params.search), sort: params.sort ?? ORDENACAO_PADRAO },
      { searchFields: CAMPOS_BUSCA },
    );

    return ok(resultado.data.map(toListItem), resultado.count);
  });
}

export async function getById({ id }: { id: string }): Promise<SingleResult<PacienteDetalhe>> {
  return simulate(() => {
    const row = pacientes.find((paciente) => paciente.id === id);
    if (!row) return fail(ERROR_CODE.NOT_FOUND, "Paciente não encontrado.");

    return okOne(toDetalhe(row));
  });
}

/* -------------------------------------------------------------------------
   REVELAÇÃO DE DADO PESSOAL
   ------------------------------------------------------------------------- */

/**
 * Devolve os campos pedidos em claro.
 *
 * O mock não checa permissão: quem checa é a tela (`<Can>` + `pode()`) e, na
 * Fase 15, a política RLS. Colocar a checagem aqui daria a falsa sensação de
 * barreira — o adapter roda no navegador de quem estiver pedindo.
 */
export async function revealPii({
  id,
  campos,
}: {
  id: string;
  campos: CampoPii[];
}): Promise<SingleResult<PiiRevelada>> {
  return simulate(() => {
    const row = pacientes.find((paciente) => paciente.id === id);
    if (!row) return fail(ERROR_CODE.NOT_FOUND, "Paciente não encontrado.");

    const revelado: PiiRevelada = {};
    if (campos.includes("cpf")) revelado.cpf = row.cpf;
    if (campos.includes("telefone")) revelado.telefone = row.telefone;
    if (campos.includes("email")) revelado.email = row.email;

    return okOne(revelado);
  });
}

/* -------------------------------------------------------------------------
   ESCRITA
   ------------------------------------------------------------------------- */

/** Próximo código sequencial da clínica: PAC-0082, PAC-0083… */
function proximoCodigo(): string {
  const maior = pacientes.reduce((maximo, paciente) => {
    const numero = Number(paciente.codigo.replace(/\D/g, ""));
    return Number.isFinite(numero) && numero > maximo ? numero : maximo;
  }, 0);

  return `PAC-${String(maior + 1).padStart(4, "0")}`;
}

export async function create(entrada: PacienteEntrada): Promise<SingleResult<PacienteDetalhe>> {
  return simulate(() => {
    const cpf = digitsOnly(entrada.cpf);

    // CPF é a chave natural do paciente: duplicá-lo cria duas fichas para a
    // mesma pessoa, e o app do paciente não saberia em qual escrever.
    if (pacientes.some((paciente) => paciente.cpf === cpf)) {
      return fail(ERROR_CODE.CONFLICT, "Já existe um paciente cadastrado com este CPF.");
    }

    const agora = now();

    const row: PacienteMock = {
      id: uuid(),
      codigo: proximoCodigo(),
      nome: entrada.nome.trim(),
      cpf,
      nascimento: entrada.nascimento,
      sexo: entrada.sexo,
      telefone: digitsOnly(entrada.telefone),
      email: entrada.email.trim().toLowerCase(),
      cid: entrada.cid,
      protocolo_id: entrada.protocolo_id,
      fase: entrada.fase,
      status: STATUS_PACIENTE.ATIVO,
      risco: entrada.risco,
      estadiamento: entrada.estadiamento ?? null,
      diagnostico_em: entrada.diagnostico_em ?? null,
      alergias: entrada.alergias ?? [],
      reacoes_previas: entrada.reacoes_previas ?? [],
      observacoes: entrada.observacoes ?? null,
      medico_responsavel_id: entrada.medico_responsavel_id ?? null,
      convite_status: entrada.enviar_convite ? "enviado" : "nao_enviado",
      convite_enviado_em: entrada.enviar_convite ? agora : null,
      ultimo_acesso_app_em: null,
      desativado_em: null,
      motivo_desativacao: null,
      criado_em: agora,
      atualizado_em: agora,
    };

    pacientes.unshift(row);
    return okOne(toDetalhe(row));
  });
}

export async function update({
  id,
  dados,
}: {
  id: string;
  dados: Partial<PacienteEntrada>;
}): Promise<SingleResult<PacienteDetalhe>> {
  return simulate(() => {
    const row = pacientes.find((paciente) => paciente.id === id);
    if (!row) return fail(ERROR_CODE.NOT_FOUND, "Paciente não encontrado.");

    // CPF não entra na edição de propósito: é a chave natural do registro, e
    // trocá-la é uma correção de cadastro, não uma edição de rotina.
    Object.assign(row, {
      nome: dados.nome?.trim() ?? row.nome,
      nascimento: dados.nascimento ?? row.nascimento,
      sexo: dados.sexo ?? row.sexo,
      telefone: dados.telefone ? digitsOnly(dados.telefone) : row.telefone,
      email: dados.email?.trim().toLowerCase() ?? row.email,
      cid: dados.cid ?? row.cid,
      protocolo_id: dados.protocolo_id ?? row.protocolo_id,
      fase: dados.fase ?? row.fase,
      risco: dados.risco ?? row.risco,
      estadiamento: dados.estadiamento ?? row.estadiamento,
      diagnostico_em: dados.diagnostico_em ?? row.diagnostico_em,
      alergias: dados.alergias ?? row.alergias,
      reacoes_previas: dados.reacoes_previas ?? row.reacoes_previas,
      observacoes: dados.observacoes ?? row.observacoes,
      medico_responsavel_id: dados.medico_responsavel_id ?? row.medico_responsavel_id,
      atualizado_em: now(),
    } satisfies Partial<PacienteMock>);

    return okOne(toDetalhe(row));
  });
}

/**
 * Desativação lógica.
 *
 * O registro nunca é apagado: histórico clínico e trilha de auditoria precisam
 * continuar apontando para uma linha existente. O motivo é obrigatório porque
 * é ele que a tela de Auditoria (Fase 10) exibe ao lado do evento.
 */
export async function deactivate({
  id,
  motivo,
}: {
  id: string;
  motivo: string;
}): Promise<SingleResult<PacienteDetalhe>> {
  return simulate(() => {
    const row = pacientes.find((paciente) => paciente.id === id);
    if (!row) return fail(ERROR_CODE.NOT_FOUND, "Paciente não encontrado.");

    if (!motivo.trim()) {
      return fail(ERROR_CODE.VALIDATION, "Informe o motivo da desativação.");
    }

    if (row.status === STATUS_PACIENTE.INATIVO) {
      return fail(ERROR_CODE.CONFLICT, "Este paciente já está inativo.");
    }

    row.status = STATUS_PACIENTE.INATIVO;
    row.desativado_em = now();
    row.motivo_desativacao = motivo.trim();
    row.atualizado_em = row.desativado_em;

    return okOne(toDetalhe(row));
  });
}

/** Reenvio do convite de acesso ao app. Fase 15: Edge Function + gateway SMS. */
export async function sendInvite({ id }: { id: string }): Promise<SingleResult<ResultadoConvite>> {
  return simulate(() => {
    const row = pacientes.find((paciente) => paciente.id === id);
    if (!row) return fail(ERROR_CODE.NOT_FOUND, "Paciente não encontrado.");

    if (row.status === STATUS_PACIENTE.INATIVO) {
      return fail(ERROR_CODE.CONFLICT, "Não é possível convidar um paciente inativo.");
    }

    const enviado = now();
    row.convite_enviado_em = enviado;
    if (row.convite_status !== "aceito") row.convite_status = "enviado";
    row.atualizado_em = enviado;

    return okOne<ResultadoConvite>({
      paciente_id: row.id,
      destino: maskPhone(row.telefone),
      enviado_em: enviado,
    });
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
export async function exportar(params: ListParams = {}): Promise<ListResult<Record<string, string>>> {
  return simulate(() => {
    const filtrados = paginate(
      pacientes,
      {
        ...params,
        search: normalizarBusca(params.search),
        sort: params.sort ?? ORDENACAO_PADRAO,
        page: 1,
        pageSize: pacientes.length || 1,
      },
      { searchFields: CAMPOS_BUSCA },
    );

    const linhas = filtrados.data.map((row) => ({
      Código: row.codigo,
      Paciente: row.nome,
      CPF: maskCpf(row.cpf),
      Idade: String(ageInYears(row.nascimento) ?? ""),
      Sexo: row.sexo,
      CID: row.cid,
      Diagnóstico: descricaoCid(row.cid),
      Estadiamento: row.estadiamento ?? "",
      Protocolo: protocoloPorId(row.protocolo_id)?.nome ?? "",
      Fase: FASE_TRATAMENTO_LABEL[row.fase],
      Risco: RISCO_LABEL[row.risco],
      Status: STATUS_PACIENTE_LABEL[row.status],
      Convite: STATUS_CONVITE_LABEL[row.convite_status],
      "Cadastrado em": formatDate(row.criado_em),
    }));

    return ok(linhas, linhas.length);
  });
}

// `export` é palavra reservada: a função nasce como `exportar` e é publicada
// com o nome do contrato.
export { exportar as export };
