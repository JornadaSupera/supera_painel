/**
 * Patient satisfaction: the NPS survey the app opens at milestones of the
 * journey, and what patients answered.
 *
 * An answer is attributable by construction — one per patient and milestone — and
 * only the administration reads it, comment included. Nothing here is offered to
 * professionals.
 */

export type NpsCategory = "promoter" | "passive" | "detractor";

/** A moment of the journey that opens a survey (`first access`, `half of the treatment`…). */
export interface SatisfactionMilestone {
  code: string;
  label: string;
}

export interface ScoreCount {
  score: number;
  count: number;
}

export interface MilestoneSummary {
  code: string;
  label: string;
  /** Surveys opened in the period. */
  sent: number;
  /** Of those, how many have been answered by now. */
  answered: number;
  /** Answers given in the period for this milestone. */
  responses: number;
  nps: number | null;
}

export interface MonthSummary {
  /** `YYYY-MM`, in the clinic's zone. */
  month: string;
  responses: number;
  nps: number | null;
}

export interface SatisfactionSummary {
  /** `null` covers everything the database returned. */
  window_days: number | null;
  /** Surveys opened in the period. */
  surveys_sent: number;
  /** Of those, how many are already answered — a cohort, so it never passes 100%. */
  surveys_answered: number;
  /** `surveys_answered / surveys_sent` in percent, or `null` with nothing sent. */
  response_rate: number | null;
  /** Answers given in the period. */
  responses: number;
  /** Promoters minus detractors in percent, −100 to 100, or `null` with no answers. */
  nps: number | null;
  average: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  /** One entry per score from 0 to 10, zeros included. */
  distribution: ScoreCount[];
  by_milestone: MilestoneSummary[];
  by_month: MonthSummary[];
  /** The read hit its ceiling: there are more answers than these numbers count. */
  partial: boolean;
}

/** One answer, as the list shows it. */
export interface SatisfactionResponse {
  id: string;
  score: number;
  category: NpsCategory;
  comment: string | null;
  /** ISO 8601 UTC. */
  answered_at: string;
  milestone_code: string;
  milestone_label: string;
  patient_id: string;
  /** The short code the panel shows instead of a name. */
  patient_code: string;
}
