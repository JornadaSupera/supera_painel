import { ACAO_AUDITORIA_LABEL, type AcaoAuditoria } from "@/lib/enums";
import { failWith, ok, type ListResult } from "@/services/contracts";
import type {
  AuditoriaListItem,
  OpcaoFiltroAuditoria,
  ResumoAuditoria,
} from "@/types/auditoria";

/**
 * AUDIT TRAIL RULES SHARED BY BOTH ADAPTERS.
 * =============================================================================
 * The mock and Supabase read the trail from different places, but what they
 * answer with has to be the same: the same facet ordering, the same summary
 * shape and the same export columns. Two copies of these rules is how the
 * screen starts telling a different story depending on the backend.
 */

export const AUDIT_DEFAULT_SORT = { field: "criado_em", direction: "desc" } as const;

export interface FacetEntry {
  id: string;
  nome: string;
}

/**
 * Filter options counted from the trail rows. `null` entries are rows that do
 * not belong to this facet (an action with no actor, a row with no patient).
 *
 * Busiest first: whoever has the most rows in the window is who someone came
 * looking for. Ties break by name, so the order does not shift between loads.
 */
export function buildFacetOptions(entries: (FacetEntry | null)[]): OpcaoFiltroAuditoria[] {
  const options = new Map<string, OpcaoFiltroAuditoria>();

  for (const entry of entries) {
    if (!entry) continue;

    const current = options.get(entry.id);
    if (current) current.total += 1;
    else options.set(entry.id, { id: entry.id, nome: entry.nome, total: 1 });
  }

  return [...options.values()].sort(
    (a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

/** Window counters in the prototype order, with the categories that have no source. */
export function summarizeAudit({
  actions,
  countable,
  windowHours,
  withoutSource,
}: {
  actions: Iterable<AcaoAuditoria>;
  countable: AcaoAuditoria[];
  windowHours: number;
  withoutSource: AcaoAuditoria[];
}): ResumoAuditoria {
  const totals = new Map<AcaoAuditoria, number>();
  for (const action of actions) totals.set(action, (totals.get(action) ?? 0) + 1);

  return {
    janela_horas: windowHours,
    contagens: countable.map((acao) => ({
      acao,
      label: ACAO_AUDITORIA_LABEL[acao],
      total: totals.get(acao) ?? 0,
    })),
    sem_origem: withoutSource,
  };
}

/**
 * Flat rows for CSV or JSON — the report the data protection officer asks for.
 *
 * The columns are decided here, not on the screen, so the export does not
 * depend on who clicked or which columns were visible.
 */
export function toAuditExport(
  result: ListResult<AuditoriaListItem>,
): ListResult<Record<string, string>> {
  if (result.error) return failWith(result.error);

  return ok(
    result.data.map((registro) => ({
      data_hora: registro.criado_em,
      acao: ACAO_AUDITORIA_LABEL[registro.acao],
      usuario: registro.usuario_nome,
      recurso: registro.recurso_label,
      registro_id: registro.recurso_id ?? "",
      paciente: registro.paciente_nome ?? "",
      linhas_alcancadas: registro.linhas === null ? "" : String(registro.linhas),
    })),
    result.count,
  );
}
