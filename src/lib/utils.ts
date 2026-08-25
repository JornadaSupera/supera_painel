import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind classes, resolving conflicts.
 *
 * `clsx` builds the conditional list; `twMerge` makes the last conflicting
 * class win — without it, `cn("p-2", "p-4")` would leave both in the DOM and
 * the CSS order would decide, not the caller's intent.
 *
 * This is the helper shadcn/ui expects at `@/lib/utils`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
