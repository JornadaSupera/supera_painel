import { buildSummary, categoryOf, NPS_SCORE_RANGE, windowStart } from "@/lib/nps";
import {
  normalizeListParams,
  ok,
  okOne,
  type ListParams,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type {
  NpsCategory,
  SatisfactionMilestone,
  SatisfactionResponse,
  SatisfactionSummary,
} from "@/types/satisfaction";
import { executar, falhaDe, umDe, type ErroPostgrest } from "./_helpers";
import { getSupabaseClient } from "./client";
import { codigoExibidoDoPaciente } from "./mapping";

/**
 * Patient satisfaction — the NPS survey and its answers.
 *
 * Read straight from `nps_surveys` and `nps_responses`, which is the path the
 * database intends: the survey is exempt from the audited-read functions, and the
 * only role with a policy on both tables besides the patient is the
 * administrator. There is no policy for professionals, so nothing here could be
 * opened to them without a change in the database.
 *
 * A survey and its answer are different rows on purpose — a survey can be opened
 * and never answered — so the response rate has a denominator only because they
 * are read apart.
 */

/** PostgREST answers at most a thousand rows per request. */
const PAGE = 1000;
/** How many rows the summary reads before saying it is partial. */
const CEILING = 5000;

interface MilestoneRow {
  id: string;
  code: string;
  label: string;
}

interface SurveyRow {
  milestone_id: string;
  response: { id: string } | { id: string }[] | null;
}

interface ResponseCountRow {
  score: number;
  answered_at: string;
  survey: { milestone_id: string } | { milestone_id: string }[] | null;
}

interface ResponseRow {
  id: string;
  score: number;
  comment: string | null;
  answered_at: string;
  survey: { patient_id: string; milestone_id: string } | { patient_id: string; milestone_id: string }[] | null;
}

/** The moments of the journey, in the order the database keeps them. */
async function readMilestones(): Promise<MilestoneRow[] | ReturnType<typeof falhaDe>> {
  const { data, error } = await getSupabaseClient()
    .from("treatment_phases")
    .select("id, code, label")
    .eq("axis", "nps")
    .order("sort_order");
  if (error) return falhaDe(error);
  return (data ?? []) as MilestoneRow[];
}

function isFailure<T>(value: T | ReturnType<typeof falhaDe>): value is ReturnType<typeof falhaDe> {
  return Boolean(value) && typeof value === "object" && (value as { error?: unknown }).error != null;
}

/** Reads a table page by page up to the ceiling. */
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: ErroPostgrest | null }>,
): Promise<{ rows: T[]; partial: boolean } | ReturnType<typeof falhaDe>> {
  const rows: T[] = [];

  for (let from = 0; from < CEILING; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return falhaDe(error);

    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, partial: false };
  }

  return { rows, partial: true };
}

export async function getSummary(params: { days: number | null }): Promise<SingleResult<SatisfactionSummary>> {
  return executar(async () => {
    const supabase = getSupabaseClient();
    const since = windowStart(params.days);

    const milestones = await readMilestones();
    if (isFailure(milestones)) return milestones;
    const codeById = new Map(milestones.map((row) => [row.id, row.code]));

    const [surveys, responses] = await Promise.all([
      readAll<SurveyRow>((from, to) => {
        const query = supabase
          .from("nps_surveys")
          .select("milestone_id, response:nps_responses ( id )")
          .order("triggered_at", { ascending: false })
          .range(from, to);
        return since ? query.gte("triggered_at", since) : query;
      }),
      readAll<ResponseCountRow>((from, to) => {
        const query = supabase
          .from("nps_responses")
          .select("score, answered_at, survey:nps_surveys!inner ( milestone_id )")
          .order("answered_at", { ascending: false })
          .range(from, to);
        return since ? query.gte("answered_at", since) : query;
      }),
    ]);
    if (isFailure(surveys)) return surveys;
    if (isFailure(responses)) return responses;

    const knownMilestones: SatisfactionMilestone[] = milestones.map(({ code, label }) => ({ code, label }));

    return okOne(
      buildSummary({
        surveys: surveys.rows.map((row) => ({
          milestone_code: codeById.get(row.milestone_id) ?? row.milestone_id,
          answered: umDe(row.response) !== null,
        })),
        responses: responses.rows.map((row) => ({
          score: row.score,
          answered_at: row.answered_at,
          milestone_code: codeById.get(umDe(row.survey)?.milestone_id ?? "") ?? "",
        })),
        milestones: knownMilestones,
        days: params.days,
        partial: surveys.partial || responses.partial,
      }),
    );
  });
}

export async function list(params: ListParams = {}): Promise<ListResult<SatisfactionResponse>> {
  return executar(async () => {
    const supabase = getSupabaseClient();
    const { filters, range, sort, from, to } = normalizeListParams(params);

    const milestones = await readMilestones();
    if (isFailure(milestones)) return milestones;
    const byId = new Map(milestones.map((row) => [row.id, row]));

    let query = supabase
      .from("nps_responses")
      .select("id, score, comment, answered_at, survey:nps_surveys!inner ( patient_id, milestone_id )", {
        count: "exact",
      });

    const category = typeof filters.category === "string" ? (filters.category as NpsCategory) : null;
    if (category && NPS_SCORE_RANGE[category]) {
      query = query.gte("score", NPS_SCORE_RANGE[category].min).lte("score", NPS_SCORE_RANGE[category].max);
    }

    if (typeof filters.milestone === "string" && filters.milestone) {
      const milestone = milestones.find((row) => row.code === filters.milestone);
      // A moment the database does not have has no answers, and asking for it
      // must not turn into "everything".
      if (!milestone) return ok([], 0);
      query = query.eq("survey.milestone_id", milestone.id);
    }

    if (filters.with_comment === "yes") query = query.not("comment", "is", null);
    if (range) query = query.gte("answered_at", range.from).lte("answered_at", range.to);

    const field = sort?.field === "score" ? "score" : "answered_at";
    query = query.order(field, { ascending: sort?.direction === "asc" }).order("id");

    const { data, error, count } = await query.range(from, to);
    if (error) return falhaDe(error);

    const rows = (data ?? []) as unknown as ResponseRow[];

    return ok(
      rows.map<SatisfactionResponse>((row) => {
        const survey = umDe(row.survey);
        const milestone = survey ? byId.get(survey.milestone_id) : undefined;

        return {
          id: row.id,
          score: row.score,
          category: categoryOf(row.score),
          comment: row.comment,
          answered_at: row.answered_at,
          milestone_code: milestone?.code ?? "",
          milestone_label: milestone?.label ?? "Momento não identificado",
          patient_id: survey?.patient_id ?? "",
          patient_code: survey ? codigoExibidoDoPaciente(survey.patient_id) : "—",
        };
      }),
      count ?? rows.length,
    );
  });
}
