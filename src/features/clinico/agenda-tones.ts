import type { StatusTone } from "@/components/shared";

/**
 * How an appointment card is painted in the agenda, by the tone of its status.
 * The status is always written on the card too: color is never the only carrier.
 */
export const APPOINTMENT_CARD_TONE: Record<StatusTone, string> = {
  success: "bg-success-bg text-success-foreground border-success/40",
  warning: "bg-warning-bg text-warning-foreground border-warning/40",
  danger: "bg-danger-bg text-danger-foreground border-danger/40",
  info: "bg-info-bg text-info-foreground border-info/40",
  neutral: "bg-neutral-bg text-neutral-foreground border-border",
  primary: "bg-secondary text-secondary-foreground border-primary/40",
};

/** Hatched, so a block never reads as an appointment even in grayscale. */
export const BLOCK_PATTERN =
  "border-border text-muted-foreground bg-[repeating-linear-gradient(135deg,transparent,transparent_5px,var(--color-muted)_5px,var(--color-muted)_10px)]";
