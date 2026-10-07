import { useQuery } from "@tanstack/react-query";

import { windowEnd, windowStart } from "@/lib/nps";
import { queryKeys } from "@/lib/queryKeys";
import { call, satisfacaoApi } from "@/services/apiClient";
import type { NpsCategory } from "@/types/satisfaction";

/**
 * The satisfaction survey: the summary of a period and the answers themselves.
 *
 * Reads are plain `select`s on tables only the administration can see, so there
 * is no per-read audit row to worry about: refreshing on an interval costs nothing
 * in the trail. Still, answers arrive slowly — a patient answers once per
 * milestone — so nothing here polls.
 */

export interface AnswerFilters {
  category: NpsCategory | "";
  milestone: string;
  withComment: boolean;
}

export const EMPTY_FILTERS: AnswerFilters = { category: "", milestone: "", withComment: false };

export function useSatisfactionSummary(days: number | null) {
  return useQuery({
    queryKey: queryKeys.satisfaction.summary(days),
    queryFn: async () => (await call(() => satisfacaoApi.getSummary({ days }))).data,
  });
}

/** How many answers the record tab shows: a patient answers once per milestone. */
const PATIENT_ANSWERS_LIMIT = 50;

/** One patient's answers, newest first, for the satisfaction tab of the record. */
export function usePatientSatisfaction(patientId: string) {
  return useQuery({
    queryKey: queryKeys.satisfaction.list({ patientId }),
    queryFn: () =>
      call(() =>
        satisfacaoApi.list({
          page: 1,
          pageSize: PATIENT_ANSWERS_LIMIT,
          sort: { field: "answered_at", direction: "desc" },
          filters: { patient_id: patientId },
        }),
      ),
    enabled: Boolean(patientId),
  });
}

export function useSatisfactionAnswers(params: {
  days: number | null;
  filters: AnswerFilters;
  page: number;
  pageSize: number;
}) {
  const from = windowStart(params.days);

  const query = {
    page: params.page,
    pageSize: params.pageSize,
    sort: { field: "answered_at", direction: "desc" as const },
    filters: {
      category: params.filters.category || undefined,
      milestone: params.filters.milestone || undefined,
      with_comment: params.filters.withComment ? "yes" : undefined,
    },
    range: from ? { from, to: windowEnd() } : null,
  };

  return useQuery({
    // The key carries what the person chose, flat, not the request built from it.
    queryKey: queryKeys.satisfaction.list({
      days: params.days,
      page: params.page,
      pageSize: params.pageSize,
      category: params.filters.category || null,
      milestone: params.filters.milestone || null,
      withComment: params.filters.withComment,
    }),
    queryFn: () => call(() => satisfacaoApi.list(query)),
    // Keeps the page on screen while the next one loads.
    placeholderData: (previous) => previous,
  });
}
