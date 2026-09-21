import { cn } from "@/lib/utils";
import type { LegalSection } from "../types";

interface TableOfContentsProps {
  sections: LegalSection[];
  activeId: string | null;
  onNavigate?: () => void;
}

export function TableOfContents({ sections, activeId, onNavigate }: TableOfContentsProps) {
  return (
    <ol className="space-y-0.5 text-sm">
      {sections.map((section, index) => {
        const active = section.id === activeId;
        return (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              onClick={onNavigate}
              aria-current={active ? "location" : undefined}
              className={cn(
                "flex gap-2.5 rounded-lg border-l-2 px-3 py-1.5 leading-snug transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent",
              )}
            >
              <span className="font-mono text-xs tabular-nums opacity-70">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{section.title}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
