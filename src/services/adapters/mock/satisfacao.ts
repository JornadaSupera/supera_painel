import { buildSummary, categoryOf, NPS_SCORE_RANGE, windowStart } from "@/lib/nps";
import { marcosNps, pesquisasNps } from "@/mocks/satisfacao";
import { normalizeListParams, ok, okOne, type ListParams, type ListResult, type SingleResult } from "@/services/contracts";
import type { NpsCategory, SatisfactionResponse, SatisfactionSummary } from "@/types/satisfaction";
import { simulate } from "./_helpers";

/** Satisfação dos pacientes — modo mock. Dados em `mocks/satisfacao.ts`. */

function codigoDoPaciente(id: string): string {
  return `PAC-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

const rotuloDoMarco = new Map(marcosNps.map((marco) => [marco.code, marco.label]));

export async function getSummary(params: { days: number | null }): Promise<SingleResult<SatisfactionSummary>> {
  return simulate(() => {
    const desde = windowStart(params.days);

    return okOne(
      buildSummary({
        surveys: pesquisasNps
          .filter((pesquisa) => desde === null || pesquisa.aberta_em >= desde)
          .map((pesquisa) => ({ milestone_code: pesquisa.marco, answered: pesquisa.resposta !== null })),
        responses: pesquisasNps.flatMap((pesquisa) =>
          pesquisa.resposta && (desde === null || pesquisa.resposta.respondida_em >= desde)
            ? [{ score: pesquisa.resposta.nota, answered_at: pesquisa.resposta.respondida_em, milestone_code: pesquisa.marco }]
            : [],
        ),
        milestones: marcosNps,
        days: params.days,
        partial: false,
      }),
    );
  });
}

export async function list(params: ListParams = {}): Promise<ListResult<SatisfactionResponse>> {
  return simulate(() => {
    const { filters, range, sort, page, pageSize } = normalizeListParams(params);
    const categoria = typeof filters.category === "string" ? (filters.category as NpsCategory) : null;

    const linhas = pesquisasNps
      .flatMap((pesquisa) =>
        pesquisa.resposta
          ? [
              {
                id: `${pesquisa.id}-resposta`,
                score: pesquisa.resposta.nota,
                category: categoryOf(pesquisa.resposta.nota),
                comment: pesquisa.resposta.comentario,
                answered_at: pesquisa.resposta.respondida_em,
                milestone_code: pesquisa.marco,
                milestone_label: rotuloDoMarco.get(pesquisa.marco) ?? "Momento não identificado",
                patient_id: pesquisa.paciente_id,
                patient_code: codigoDoPaciente(pesquisa.paciente_id),
              } satisfies SatisfactionResponse,
            ]
          : [],
      )
      .filter((linha) => {
        if (categoria && NPS_SCORE_RANGE[categoria]) {
          const faixa = NPS_SCORE_RANGE[categoria];
          if (linha.score < faixa.min || linha.score > faixa.max) return false;
        }
        if (typeof filters.milestone === "string" && filters.milestone && linha.milestone_code !== filters.milestone) return false;
        if (filters.with_comment === "yes" && !linha.comment) return false;
        if (range && (linha.answered_at < range.from || linha.answered_at > range.to)) return false;
        return true;
      })
      .sort((a, b) => {
        const ordem = sort?.field === "score" ? a.score - b.score : a.answered_at.localeCompare(b.answered_at);
        return sort?.direction === "asc" ? ordem : -ordem;
      });

    return ok(linhas.slice((page - 1) * pageSize, page * pageSize), linhas.length);
  });
}
