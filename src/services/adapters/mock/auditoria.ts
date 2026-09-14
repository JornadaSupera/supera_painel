import {
  ACAO_AUDITORIA,
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
  okOne,
  type DateRange,
  type ListParams,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type { AuditoriaListItem, FacetasAuditoria, ResumoAuditoria } from "@/types/auditoria";
import { AUDIT_DEFAULT_SORT, buildFacetOptions, summarizeAudit, toAuditExport } from "../_audit";
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
      { ...params, sort: params.sort ?? AUDIT_DEFAULT_SORT },
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

    return okOne({
      atores: buildFacetOptions(
        naJanela.map((linha) =>
          linha.usuario_id ? { id: linha.usuario_id, nome: linha.usuario_nome } : null,
        ),
      ),
      pacientes: buildFacetOptions(
        naJanela.map((linha) =>
          linha.paciente_id && linha.paciente_nome
            ? { id: linha.paciente_id, nome: linha.paciente_nome }
            : null,
        ),
      ),
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

    return okOne(
      summarizeAudit({
        actions: registros
          .filter((registro) => Date.parse(registro.criado_em) >= desde)
          .map((registro) => registro.acao),
        countable: CONTAVEIS,
        windowHours: janela_horas,
        withoutSource: [],
      }),
    );
  });
}

export async function exportar(
  params: ListParams = {},
): Promise<ListResult<Record<string, string>>> {
  return toAuditExport(await list({ ...params, page: 1, pageSize: registros.length || 1 }));
}

export { exportar as export };
