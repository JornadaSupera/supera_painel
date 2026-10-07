import type { DistressFlag } from "@/types/patient-record";

/**
 * How long a distress flag stays highlighted to the team.
 *
 * The flag has no "resolved" state in the database: it is a dated event. A
 * window keeps the highlight meaningful — a flag from last year in red on every
 * screen would teach people to ignore the red.
 */
export const DISTRESS_HIGHLIGHT_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The flags still inside the highlight window, newest first. */
export function recentDistressFlags(
  flags: DistressFlag[] | undefined,
  now: number,
): DistressFlag[] {
  return (flags ?? []).filter(
    (flag) => now - Date.parse(flag.raised_at) <= DISTRESS_HIGHLIGHT_DAYS * DAY_MS,
  );
}
