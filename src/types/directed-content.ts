import type { Especialidade, TipoConteudo } from "@/lib/enums";

/**
 * Library orientations a professional sends straight to one patient.
 *
 * The send is clinical metadata, not editorial content: "Nutrition sent this to
 * that patient" says the patient is followed by Nutrition. So it carries the
 * specialty it came from, and the database keeps a confidential area's sends to
 * that area.
 */

/** One orientation sent to the patient. */
export interface DirectedSend {
  id: string;
  content_item_id: string;
  /** Title of the version the patient opens today. `null` when no version is readable. */
  title: string | null;
  kind: TipoConteudo | null;
  /** Estimated minutes to read or watch, when the author gave one. */
  minutes: number | null;
  /** The area it was sent from. */
  specialty: Especialidade | null;
  sent_by_name: string;
  /** ISO 8601 UTC. */
  sent_at: string;
  /** When the patient opened it in the app. `null` = not opened yet. */
  opened_at: string | null;
  /** Still published: an orientation taken off the library leaves the patient's app too. */
  published: boolean;
}

/** A published orientation of the library, ready to be sent. */
export interface SendableContent {
  content_item_id: string;
  title: string;
  kind: TipoConteudo;
  minutes: number | null;
  category: string;
  /** The area whose category holds it. */
  specialty: Especialidade | null;
  /** ICD-10 codes the author tagged it with ("C50.9"). */
  cids: string[];
}
