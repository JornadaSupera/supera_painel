import type { Severidade } from "@/lib/enums";

/**
 * How an alert's severity is painted outside a badge: the dot in the dashboard
 * queue and the left edge of a card in the alerts page. The severity is always
 * written next to it too — color is never the only carrier.
 */
export const SEVERITY_DOT: Record<Severidade, string> = {
  critica: "bg-destructive",
  alta: "bg-warning",
  media: "bg-info",
  baixa: "bg-muted-foreground",
};

export const SEVERITY_EDGE: Record<Severidade, string> = {
  critica: "border-l-destructive",
  alta: "border-l-warning",
  media: "border-l-info",
  baixa: "border-l-muted-foreground/50",
};

/** Strongest first: the order the queue is read in. */
export const SEVERITY_RANK: Record<Severidade, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};
