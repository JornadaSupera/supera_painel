import { Bold, Heading2, Italic, List, ListOrdered } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MarkdownText } from "./MarkdownText";

/**
 * A text field with a formatting bar and a preview.
 *
 * It writes Markdown — plain text with a few marks — so the value stays
 * readable even where nothing renders it, and there is no HTML to sanitize. The
 * bar only inserts the marks around the selection; it does not hide them.
 */

type Mark = "bold" | "italic" | "heading" | "bullets" | "numbers";

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  rows?: number;
  placeholder?: string;
  "aria-describedby"?: string;
}

const TOOLS: { mark: Mark; label: string; icon: typeof Bold }[] = [
  { mark: "bold", label: "Negrito", icon: Bold },
  { mark: "italic", label: "Itálico", icon: Italic },
  { mark: "heading", label: "Título de seção", icon: Heading2 },
  { mark: "bullets", label: "Lista com marcadores", icon: List },
  { mark: "numbers", label: "Lista numerada", icon: ListOrdered },
];

export function MarkdownEditor({
  id,
  value,
  onChange,
  disabled,
  invalid,
  rows = 12,
  placeholder,
  "aria-describedby": describedBy,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [previewing, setPreviewing] = useState(false);

  const apply = (mark: Mark) => {
    const field = ref.current;
    if (!field) return;

    const start = field.selectionStart;
    const end = field.selectionEnd;
    let next = value;
    let selectFrom = start;
    let selectTo = end;

    if (mark === "bold" || mark === "italic") {
      const wrap = mark === "bold" ? "**" : "*";
      const selected = value.slice(start, end) || "texto";
      next = `${value.slice(0, start)}${wrap}${selected}${wrap}${value.slice(end)}`;
      selectFrom = start + wrap.length;
      selectTo = selectFrom + selected.length;
    } else {
      // Line marks apply to every line the selection touches.
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEndAt = value.indexOf("\n", end);
      const lineEnd = lineEndAt === -1 ? value.length : lineEndAt;
      const lines = value.slice(lineStart, lineEnd).split("\n");

      const marked = lines.map((line, index) => {
        const bare = line.replace(/^(#{1,3}\s+|[-*]\s+|\d+[.)]\s+)/, "");
        if (mark === "heading") return `## ${bare}`;
        if (mark === "bullets") return `- ${bare}`;
        return `${index + 1}. ${bare}`;
      });

      next = `${value.slice(0, lineStart)}${marked.join("\n")}${value.slice(lineEnd)}`;
      selectFrom = lineStart;
      selectTo = lineStart + marked.join("\n").length;
    }

    onChange(next);
    // The state update re-renders the field; the selection is put back after.
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(selectFrom, selectTo);
    });
  };

  return (
    <div className={cn("bg-card rounded-md border", invalid && "border-destructive")}>
      <div className="flex flex-wrap items-center gap-1 border-b p-1.5">
        <div role="tablist" aria-label="Modo do editor" className="flex gap-1">
          <Button
            type="button"
            role="tab"
            aria-selected={!previewing}
            variant={previewing ? "ghost" : "secondary"}
            size="sm"
            onClick={() => setPreviewing(false)}
          >
            Escrever
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={previewing}
            variant={previewing ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPreviewing(true)}
          >
            Pré-visualizar
          </Button>
        </div>

        {!previewing && (
          <div role="toolbar" aria-label="Formatação" className="ml-auto flex gap-0.5">
            {TOOLS.map(({ mark, label, icon: Icon }) => (
              <Button
                key={mark}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={label}
                title={label}
                disabled={disabled}
                onClick={() => apply(mark)}
              >
                <Icon />
              </Button>
            ))}
          </div>
        )}
      </div>

      {previewing ? (
        <div className="min-h-40 p-3">
          {value.trim() ? (
            <MarkdownText source={value} />
          ) : (
            <p className="text-muted-foreground text-sm">Nada para pré-visualizar ainda.</p>
          )}
        </div>
      ) : (
        <Textarea
          ref={ref}
          id={id}
          value={value}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-56 rounded-t-none border-0 shadow-none focus-visible:ring-0"
        />
      )}
    </div>
  );
}

export default MarkdownEditor;
