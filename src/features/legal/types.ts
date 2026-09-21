import type { LucideIcon } from "lucide-react";

/**
 * Shape of a public legal document — the terms of use and the privacy policy.
 *
 * The text is data, not markup: every block renders through React, so there is
 * no HTML string to sanitise and no way for a stray tag in the copy to reach
 * the DOM.
 */

/** A run of text inside a paragraph. Plain strings, or a marked span. */
export type Inline = string | { strong: string } | { href: string; label: string };

/** A paragraph is one string or a sequence of runs. */
export type RichText = string | Inline[];

export type CalloutTone = "info" | "warning" | "danger" | "success";

export type LegalBlock =
  | { type: "paragraph"; text: RichText }
  | { type: "list"; items: RichText[]; ordered?: boolean }
  | { type: "definitions"; items: { term: string; text: RichText }[] }
  | { type: "callout"; tone: CalloutTone; title: string; text: RichText; icon?: LucideIcon }
  | { type: "table"; caption: string; columns: string[]; rows: RichText[][] };

export interface LegalSection {
  /** Anchor in the address bar — kebab-case, stable across versions. */
  id: string;
  title: string;
  blocks: LegalBlock[];
}


export interface LegalDocument {
  /** Route the document lives at, without the leading slash. */
  slug: "termos" | "privacidade";
  title: string;
  /** Title of the browser tab. */
  documentTitle: string;
  summary: string;
  version: string;
  /** ISO 8601 UTC instant the version takes effect. Formatted only on render. */
  effectiveAt: string;
  sections: LegalSection[];
}
