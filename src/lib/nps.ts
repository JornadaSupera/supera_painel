import { addDays, dayStart, instantParts, todayKey } from "@/lib/agenda";
import type {
  MilestoneSummary,
  MonthSummary,
  NpsCategory,
  SatisfactionMilestone,
  SatisfactionSummary,
} from "@/types/satisfaction";

/**
 * The NPS arithmetic, in one place for both adapters.
 *
 * Mock and Supabase hand over rows; what a promoter is and how the score is
 * rounded is decided here, so the two can never disagree about the same answers.
 */

export const NPS_CATEGORY_LABEL: Record<NpsCategory, string> = {
  promoter: "Promotor",
  passive: "Neutro",
  detractor: "Detrator",
};

/** The scores of each category — the standard cut: 9–10, 7–8 and 0–6. */
export const NPS_SCORE_RANGE: Record<NpsCategory, { min: number; max: number }> = {
  promoter: { min: 9, max: 10 },
  passive: { min: 7, max: 8 },
  detractor: { min: 0, max: 6 },
};

export function categoryOf(score: number): NpsCategory {
  if (score >= NPS_SCORE_RANGE.promoter.min) return "promoter";
  if (score >= NPS_SCORE_RANGE.passive.min) return "passive";
  return "detractor";
}

/**
 * Where a period of `days` starts: midnight, in the clinic's zone, that many days
 * back — or `null` for "everything". Midnight and not "now minus N days", so the
 * summary and the list count the same answers and the key of a query does not
 * change from one render to the next.
 */
export function windowStart(days: number | null): string | null {
  return days === null ? null : dayStart(addDays(todayKey(), -days));
}

/** The end of today, which is as far as any answer can be. */
export function windowEnd(): string {
  return dayStart(addDays(todayKey(), 1));
}

/** Below this many answers the score swings with a single person — the screen says so. */
export const SMALL_BASE = 10;

/** Promoters minus detractors as a percentage of all answers, rounded, or `null` without answers. */
export function npsOf(promoters: number, detractors: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round(((promoters - detractors) / total) * 100);
}

export interface SurveyRow {
  milestone_code: string;
  answered: boolean;
}

export interface ResponseRow {
  score: number;
  /** ISO 8601 UTC. */
  answered_at: string;
  milestone_code: string;
}

function tally(rows: { score: number }[]) {
  let promoters = 0;
  let detractors = 0;
  for (const row of rows) {
    const category = categoryOf(row.score);
    if (category === "promoter") promoters += 1;
    if (category === "detractor") detractors += 1;
  }
  return { promoters, detractors, passives: rows.length - promoters - detractors };
}

/**
 * The summary of a period.
 *
 * `surveys` are the ones OPENED in the period, `responses` the ones ANSWERED in
 * it. They are different sets on purpose: a survey opened last month and
 * answered today belongs to today's score and to last month's response rate.
 */
export function buildSummary({
  surveys,
  responses,
  milestones,
  days,
  partial,
}: {
  surveys: SurveyRow[];
  responses: ResponseRow[];
  milestones: SatisfactionMilestone[];
  days: number | null;
  partial: boolean;
}): SatisfactionSummary {
  const { promoters, passives, detractors } = tally(responses);

  const distribution = Array.from({ length: 11 }, (_, score) => ({
    score,
    count: responses.filter((row) => row.score === score).length,
  }));

  const byMilestone = milestones.map<MilestoneSummary>((milestone) => {
    const sent = surveys.filter((row) => row.milestone_code === milestone.code);
    const given = responses.filter((row) => row.milestone_code === milestone.code);
    const counted = tally(given);

    return {
      code: milestone.code,
      label: milestone.label,
      sent: sent.length,
      answered: sent.filter((row) => row.answered).length,
      responses: given.length,
      nps: npsOf(counted.promoters, counted.detractors, given.length),
    };
  });

  const months = new Map<string, { score: number }[]>();
  for (const row of responses) {
    const month = instantParts(row.answered_at).key.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), row]);
  }

  const byMonth = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map<MonthSummary>(([month, rows]) => {
      const counted = tally(rows);
      return { month, responses: rows.length, nps: npsOf(counted.promoters, counted.detractors, rows.length) };
    });

  const answered = surveys.filter((row) => row.answered).length;

  return {
    window_days: days,
    surveys_sent: surveys.length,
    surveys_answered: answered,
    response_rate: surveys.length === 0 ? null : Math.round((answered / surveys.length) * 100),
    responses: responses.length,
    nps: npsOf(promoters, detractors, responses.length),
    average:
      responses.length === 0
        ? null
        : Math.round((responses.reduce((sum, row) => sum + row.score, 0) / responses.length) * 10) / 10,
    promoters,
    passives,
    detractors,
    distribution,
    by_milestone: byMilestone,
    by_month: byMonth,
    partial,
  };
}
