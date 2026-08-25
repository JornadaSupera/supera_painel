import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Clinical and operational status badge.
 *
 * Separate from the shadcn `ui/badge` because the panel needs semantic tones
 * (success, warning, danger, info) the primitive does not have.
 *
 * RULE: colour is never the only carrier of meaning — the text always states
 * the state. Someone who cannot tell green from red reads "Ativo" and
 * "Inativo".
 */

const statusBadge = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-sm border font-medium leading-normal",
  {
    variants: {
      tone: {
        success: "bg-success-bg text-success-foreground border-success/30",
        warning: "bg-warning-bg text-warning-foreground border-warning/30",
        danger: "bg-danger-bg text-danger-foreground border-danger/30",
        info: "bg-info-bg text-info-foreground border-info/30",
        neutral: "bg-neutral-bg text-neutral-foreground border-border",
        primary: "bg-secondary text-secondary-foreground border-primary/30",
      },
      size: {
        sm: "px-2 py-px text-2xs",
        md: "px-2 py-0.5 text-xs",
      },
      pill: {
        true: "rounded-full px-3",
        false: "",
      },
    },
    defaultVariants: { tone: "neutral", size: "md", pill: false },
  },
);

export type StatusTone = NonNullable<VariantProps<typeof statusBadge>["tone"]>;

export interface StatusBadgeProps extends VariantProps<typeof statusBadge> {
  /** Coloured dot before the text. Visual reinforcement, never a substitute. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function StatusBadge({ tone, size, pill, dot = false, className, children }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadge({ tone, size, pill }), className)}>
      {dot && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}
