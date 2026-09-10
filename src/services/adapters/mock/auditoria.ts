import {
  ACAO_AUDITORIA,
  ACAO_AUDITORIA_LABEL,
  ORIGEM_AUDITORIA,
  RECURSO_AUDITORIA_LABEL,
  type AcaoAuditoria,
} from "@/lib/enums";
import { acessos } from "@/mocks/acessos";
import { pacientes } from "@/mocks/pacientes";
import { usuarios } from "@/mocks/usuarios";
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
import { paginate, simulate } from "./_helpers";

/**
 * Auditoria — a mesma trilha que a tela de Usuários lê por profissional, aqui
 * lida inteira.
 *
 * A base é `mocks/acessos`: uma tabela só, duas leituras. Duplicar a trilha
 * daria dois históricos que discordam sobre o mesmo acesso, que é exatamente o
 * defeito que uma auditoria não pode ter.
 *
 * Ao contrário do Supabase, o mock TEM as sete categorias e tem IP — porque
 * `mocks/acessos` os inventa para exercitar a tela. A diferença é real e está
 * declarada nos dois adapters: no backend, `sigiloso`, `exportacao` e o IP não
 * têm origem.
 */

const NOME_POR_USUARIO = new Map(usuarios.map((usuario) => [usuario.id, usuario.nome]));

/**
 * A trilha do mock não guarda paciente. Um recorte estável por posição dá à
 * tela algo para filtrar sem fingir vínculo que o dado não tem — e sem sortear
 * um paciente diferente a cada carregamento.
 */
function pacienteDoRegistro(indice: number): { id: string; nome: string } | null {
  if (indice % 3 !== 0 || pacientes.length === 0) return null;

  const paciente = pacientes[indice % pacientes.length];
  return paciente ? { id: paciente.id, nome: paciente.nome } : null;
}

const registros: AuditoriaListItem[] = acessos.map((acesso, indice) => {
  const paciente = pacienteDoRegistro(indice);

  return {
    id: acesso.id,
    criado_em: acesso.criado_em,
    acao: acesso.acao,
    usuario_id: acesso.usuario_id,
    usuario_nome: NOME_POR_USUARIO.get(acesso.usuario_id) ?? "Sistema",
    recurso: acesso.recurso,
    recurso_label: RECURSO_AUDITORIA_LABEL[acesso.recurso] ?? acesso.recurso,
    recurso_id: null,
    paciente_id: paciente?.id ?? null,
    paciente_nome: paciente?.nome ?? null,
    linhas: acesso.acao === ACAO_AUDITORIA.EXPORTACAO ? 80 + (indice % 40) : 1,
    origem: acesso.origem ?? ORIGEM_AUDITORIA.PAINEL,
    ip: acesso.ip || null,
  };
});

const CAMPOS_BUSCA = ["usuario_nome", "recurso_label", "paciente_nome"];

export async function list(params: ListParams = {}): Promise<ListResult<AuditoriaListItem>> {
  return simulate(() =>
    paginate(
      registros,
      { ...params, sort: params.sort ?? { field: "criado_em", direction: "desc" } },
      { searchFields: CAMPOS_BUSCA, rangeField: "criado_em" },
    ),
  );
}

export async function getById({ id }: { id: string }): Promise<SingleResult<AuditoriaListItem>> {
  return simulate(() => {
    const registro = registros.find((linha) => linha.id === id);
    if (!registro) return fail(ERROR_CODE.NOT_FOUND, "Registro de auditoria não encontrado.");

    return okOne(registro);
  });
}

/**
 * Quem aparece na janela — as opções dos seletores de usuário e de paciente.
 *
 * Sai da própria trilha, e não dos mocks de usuário e paciente, pelo mesmo
 * motivo do adapter real: a opção precisa corresponder a quem TEM linha ali,
 * incluindo quem já foi desativado. Ver `FacetasAuditoria`.
 */
export async function getFacets(
  params: { range?: DateRange | null } = {},
): Promise<SingleResult<FacetasAuditoria>> {
  return simulate(() => {
    const desde = params.range?.from;
    const ate = params.range?.to;

    const naJanela = registros.filter((linha) => {
      if (desde && linha.criado_em < desde) return false;
      if (ate && linha.criado_em > ate) return false;
      return true;
    });

    const atores = new Map<string, OpcaoFiltroAuditoria>();
    const pacientes = new Map<string, OpcaoFiltroAuditoria>();

    function contar(mapa: Map<string, OpcaoFiltroAuditoria>, id: string, nome: string) {
      const atual = mapa.get(id);
      if (atual) atual.total += 1;
      else mapa.set(id, { id, nome, total: 1 });
    }

    for (const linha of naJanela) {
      if (linha.usuario_id) contar(atores, linha.usuario_id, linha.usuario_nome);
      if (linha.paciente_id && linha.paciente_nome) {
        contar(pacientes, linha.paciente_id, linha.paciente_nome);
      }
    }

    const ordenar = (opcoes: OpcaoFiltroAuditoria[]) =>
      opcoes.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));

    return okOne({
      atores: ordenar([...atores.values()]),
      pacientes: ordenar([...pacientes.values()]),
      truncado: false,
    });
  });
}

/** As sete categorias — o mock as tem todas, e por isso `sem_origem` é vazio. */
const CONTAVEIS: AcaoAuditoria[] = [
  ACAO_AUDITORIA.LEITURA,
  ACAO_AUDITORIA.EDICAO,
  ACAO_AUDITORIA.EXCLUSAO,
  ACAO_AUDITORIA.SIGILOSO,
  ACAO_AUDITORIA.EXPORTACAO,
];

export async function getSummary(
  params: { janelaHoras?: number } = {},
): Promise<SingleResult<ResumoAuditoria>> {
  return simulate(() => {
    const janela_horas = params.janelaHoras ?? 24;
    const desde = Date.now() - janela_horas * 3_600_000;

    const total = new Map<AcaoAuditoria, number>();

    for (const registro of registros) {
      if (Date.parse(registro.criado_em) < desde) continue;
      total.set(registro.acao, (total.get(registro.acao) ?? 0) + 1);
    }

    return okOne({
      janela_horas,
      contagens: CONTAVEIS.map((acao) => ({
        acao,
        label: ACAO_AUDITORIA_LABEL[acao],
        total: total.get(acao) ?? 0,
      })),
      sem_origem: [],
    });
  });
}

export async function exportar(
  params: ListParams = {},
): Promise<ListResult<Record<string, string>>> {
  const resultado = await list({ ...params, page: 1, pageSize: registros.length || 1 });

  if (resultado.error) {
    return fail(resultado.error.code, resultado.error.message, resultado.error.details);
  }

  return ok(
    resultado.data.map((registro) => ({
      data_hora: registro.criado_em,
      acao: ACAO_AUDITORIA_LABEL[registro.acao],
      usuario: registro.usuario_nome,
      recurso: registro.recurso_label,
      registro_id: registro.recurso_id ?? "",
      paciente: registro.paciente_nome ?? "",
      linhas_alcancadas: registro.linhas === null ? "" : String(registro.linhas),
    })),
    resultado.count,
  );
}

export { exportar as export };
