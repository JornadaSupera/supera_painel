import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Says why the control inside is disabled, on hover and on keyboard focus.
 *
 * A disabled button takes no pointer events, so a `title` on it never shows.
 * The reason hangs on a wrapper that can be hovered and focused instead. With
 * no reason, the child renders as is.
 */
export function DisabledReason({
  reason,
  children,
}: {
  reason: string | null;
  children: ReactNode;
}) {
  if (!reason) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{reason}</TooltipContent>
    </Tooltip>
  );
}

export default DisabledReason;
