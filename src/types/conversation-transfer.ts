import type { Especialidade } from "@/lib/enums";

/**
 * Handing a conversation to a colleague.
 *
 * The destination is a person, not an area: the database routes the conversation
 * to the specialty that person works in, and writes the message that tells the
 * patient. The panel only chooses who.
 */

/** A colleague who can receive a conversation. */
export interface TransferTarget {
  professional_id: string;
  name: string;
  /** Areas the person works in today. */
  specialties: Especialidade[];
  /**
   * The person has an area they left. The database picks the destination area
   * among ALL their records, not only the current ones, so the conversation can
   * land in the area they used to work in — where they no longer see it.
   */
  changed_area: boolean;
}

/** One stretch during which a professional held a conversation. */
export interface ConversationAssignment {
  id: string;
  /** `null` quando a origem dos dados não diz quem é. */
  professional_id: string | null;
  professional_name: string;
  specialty: Especialidade | null;
  /** ISO 8601 UTC. */
  assigned_at: string;
  /** `null` while this person still holds it. */
  released_at: string | null;
}
