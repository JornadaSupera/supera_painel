import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CalloutTone, LegalBlock } from "../types";
import { RichTextView } from "./RichTextView";

/* Colour is never the only carrier of meaning: every callout also has an icon
   and a title that says what kind of notice it is. */
const CALLOUT_TONE: Record<CalloutTone, { className: string; icon: LucideIcon }> = {
  info: { className: "bg-info-bg text-info-foreground border-info/30", icon: Info },
  success: {
    className: "bg-success-bg text-success-foreground border-success/30",
    icon: CircleCheck,
  },
  warning: {
    className: "bg-warning-bg text-warning-foreground border-warning/30",
    icon: TriangleAlert,
  },
  danger: {
    className: "bg-destructive/10 text-foreground border-destructive/40",
    icon: CircleAlert,
  },
};

const ICON_TONE: Record<CalloutTone, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

export function LegalBlockView({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p>
          <RichTextView text={block.text} />
        </p>
      );

    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List
          className={cn(
            "marker:text-primary space-y-2 pl-6",
            block.ordered ? "list-decimal" : "list-disc",
          )}
        >
          {block.items.map((item, index) => (
            <li key={index} className="pl-1">
              <RichTextView text={item} />
            </li>
          ))}
        </List>
      );
    }

    case "definitions":
      return (
        <dl className="divide-border border-border bg-muted/40 divide-y rounded-xl border">
          {block.items.map((item) => (
            <div key={item.term} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-foreground font-semibold">{item.term}</dt>
              <dd className="text-muted-foreground">
                <RichTextView text={item.text} />
              </dd>
            </div>
          ))}
        </dl>
      );

    case "callout": {
      const tone = CALLOUT_TONE[block.tone];
      const Icon = block.icon ?? tone.icon;
      return (
        <aside
          className={cn("flex gap-3 rounded-xl border p-4 break-inside-avoid", tone.className)}
        >
          <Icon size={20} className={cn("mt-0.5 shrink-0", ICON_TONE[block.tone])} aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">{block.title}</p>
            <p className="opacity-90">
              <RichTextView text={block.text} />
            </p>
          </div>
        </aside>
      );
    }

    case "table":
      return (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <caption className="bg-muted/60 text-foreground border-border border-b px-4 py-2.5 text-left text-xs font-semibold tracking-wide uppercase">
              {block.caption}
            </caption>
            <thead className="sr-only">
              <tr>
                {block.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="align-top">
                  {row.map((cell, cellIndex) =>
                    cellIndex === 0 ? (
                      <th
                        key={cellIndex}
                        scope="row"
                        className="text-foreground w-[38%] px-4 py-3 font-medium"
                      >
                        <RichTextView text={cell} />
                      </th>
                    ) : (
                      <td key={cellIndex} className="text-muted-foreground px-4 py-3">
                        <RichTextView text={cell} />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
