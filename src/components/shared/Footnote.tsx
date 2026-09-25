import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The small explanatory paragraph under a table, a chart or a form section —
 * what a number leaves out, why a control is missing, what an action does not
 * undo.
 *
 * It used to be the same four classes pasted a dozen times, with no width
 * limit. On a 1920px or 2560px monitor that stretched to more than 2000px per
 * line, which nobody reads. The measure is capped here, once.
 */
export function Footnote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-muted-foreground max-w-3xl text-[11px] leading-relaxed", className)}>
      {children}
    </p>
  );
}

export default Footnote;
