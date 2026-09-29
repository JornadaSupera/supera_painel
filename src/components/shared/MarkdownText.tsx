import type { ReactNode } from "react";

import { parseMarkdown, type Inline } from "@/lib/markdown";
import { cn } from "@/lib/utils";

/**
 * Text with basic formatting, drawn as React elements.
 *
 * The source is parsed to data (`lib/markdown`) and every node becomes an
 * element here — never a string of HTML. Whatever an author types, the worst it
 * can produce is bold text.
 */

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((node, index) => {
    if (node.kind === "text") return node.text;
    if (node.kind === "strong") return <strong key={index}>{renderInline(node.children)}</strong>;
    return <em key={index}>{renderInline(node.children)}</em>;
  });
}

export function MarkdownText({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);

  return (
    <div className={cn("text-foreground flex flex-col gap-3 text-sm leading-relaxed", className)}>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          const Heading = block.level === 2 ? "h3" : "h4";
          return (
            <Heading
              key={index}
              className={block.level === 2 ? "text-base font-semibold" : "text-sm font-semibold"}
            >
              {renderInline(block.inline)}
            </Heading>
          );
        }

        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={index}
              className={cn("flex flex-col gap-1 pl-5", block.ordered ? "list-decimal" : "list-disc")}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </List>
          );
        }

        // A single line break inside a paragraph is kept: authors type addresses
        // and dosing schedules line by line.
        return (
          <p key={index} className="whitespace-pre-line">
            {renderInline(block.inline)}
          </p>
        );
      })}
    </div>
  );
}

export default MarkdownText;
