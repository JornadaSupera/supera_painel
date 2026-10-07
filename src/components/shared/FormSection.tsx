import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One titled group of a long form card — "Identificação", "Papel".
 *
 * Meant to be stacked inside a `divide-y` container: each section pads itself
 * and the first and last ones drop the outer padding, so the card's own padding
 * is the only margin at the edges.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn("flex flex-col gap-4 py-6 first:pt-0 last:pb-0", className)}
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-sm font-semibold">
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export default FormSection;
