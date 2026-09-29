/**
 * A small Markdown parser: bold, italic, headings and lists.
 *
 * It exists so orientations can carry basic formatting without HTML. The output
 * is a tree of plain data, and the screen turns it into React elements — there
 * is no string of markup anywhere, so there is nothing to inject and nothing to
 * sanitize. Text without any marks is valid input and comes out as paragraphs,
 * which is what every orientation written before this had.
 *
 * Deliberately not supported: links, images, code, tables, raw HTML. A link in
 * clinical guidance is a place to send a patient, and that is a decision for a
 * person to review, not a syntax to allow.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] };

export type Block =
  | { kind: "paragraph"; inline: Inline[] }
  | { kind: "heading"; level: 2 | 3; inline: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] };

const HEADING = /^(#{1,3})\s+(.+)$/;
const BULLET = /^\s*[-*]\s+(.+)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.+)$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: Inline[][] } | null = null;

  const closeParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", inline: parseInline(paragraph.join("\n")) });
      paragraph = [];
    }
  };

  const closeList = () => {
    if (list) {
      blocks.push({ kind: "list", ...list });
      list = null;
    }
  };

  for (const line of lines) {
    if (line.trim() === "") {
      closeParagraph();
      closeList();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      closeParagraph();
      closeList();
      // "#" and "##" both read as the section title; the page title is elsewhere.
      blocks.push({
        kind: "heading",
        level: heading[1]?.length === 3 ? 3 : 2,
        inline: parseInline(heading[2] ?? ""),
      });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const item = bullet ?? numbered;

    if (item) {
      closeParagraph();
      const ordered = numbered !== null;
      // Switching between bullets and numbers starts a new list.
      if (list && list.ordered !== ordered) closeList();
      list ??= { ordered, items: [] };
      list.items.push(parseInline(item[1] ?? ""));
      continue;
    }

    closeList();
    paragraph.push(line);
  }

  closeParagraph();
  closeList();

  return blocks;
}

/**
 * `**bold**`, `*italic*` and `_italic_`. An unmatched mark is plain text: a
 * stray asterisk in a dose ("2*3 comprimidos") must not swallow the sentence.
 */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  let i = 0;

  const flush = () => {
    if (buffer) {
      out.push({ kind: "text", text: buffer });
      buffer = "";
    }
  };

  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ kind: "strong", children: parseInline(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    const mark = text[i];
    const next = text[i + 1];
    const startsWord = i === 0 || /[\s([]/.test(text[i - 1] ?? "");

    if ((mark === "*" || mark === "_") && next && next !== mark && next !== " " && startsWord) {
      const end = text.indexOf(mark, i + 1);
      if (end > i + 1 && text[end - 1] !== " ") {
        flush();
        out.push({ kind: "em", children: parseInline(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    buffer += mark;
    i += 1;
  }

  flush();
  return out;
}
