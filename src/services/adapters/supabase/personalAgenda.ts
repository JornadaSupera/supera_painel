import { blockError } from "@/lib/agenda";
import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type {
  AppointmentTypeOption,
  BusinessHour,
  PersonalBlock,
  PersonalBlockInput,
  SavedBlock,
} from "@/types/agenda";
import { executar, falhaDe } from "./_helpers";
import { getSupabaseClient } from "./client";

/**
 * The professional's own calendar, beyond the appointments: what they blocked
 * and when the clinic works.
 *
 * Blocks are READ straight from `professional_blocks`, whose row policies are
 * "the owner and nobody else". So there is no filter for "mine" to forge and none
 * to forget. Creating and moving go through `save_professional_block`, which also
 * says which appointments the professional already had in that stretch; removing
 * is a plain delete, and a delete the policy refuses touches zero rows and raises
 * no error, which is why it asks for the row back.
 */

interface BlockRow {
  id: string;
  label: string | null;
  starts_at: string;
  ends_at: string;
}

const BLOCK_COLUMNS = "id, label, starts_at, ends_at";

function toBlock(row: BlockRow): PersonalBlock {
  return { id: row.id, label: row.label, starts_at: row.starts_at, ends_at: row.ends_at };
}

/** `"08:00:00"` → `"08:00"`. */
function hhmm(time: string): string {
  return time.slice(0, 5);
}

export async function listAppointmentTypes(): Promise<ListResult<AppointmentTypeOption>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("appointment_types")
      .select("id, label")
      .eq("is_active", true)
      .order("sort_order");
    if (error) return falhaDe(error);
    return ok((data ?? []) as AppointmentTypeOption[]);
  });
}

export async function listBusinessHours(): Promise<ListResult<BusinessHour>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("clinic_business_hours")
      .select("weekday, opens_at, closes_at")
      .order("weekday")
      .order("opens_at");
    if (error) return falhaDe(error);

    return ok(
      ((data ?? []) as { weekday: number; opens_at: string; closes_at: string }[]).map<BusinessHour>((row) => ({
        weekday: row.weekday,
        opens_at: hhmm(row.opens_at),
        closes_at: hhmm(row.closes_at),
      })),
    );
  });
}

export async function listMyBlocks(params: { from: string; to: string }): Promise<ListResult<PersonalBlock>> {
  return executar(async () => {
    // A block touches the window when it starts before the window ends and ends
    // after it starts — so one that began last week and runs through this one shows.
    const { data, error } = await getSupabaseClient()
      .from("professional_blocks")
      .select(BLOCK_COLUMNS)
      .lt("starts_at", params.to)
      .gt("ends_at", params.from)
      .order("starts_at");
    if (error) return falhaDe(error);
    return ok(((data ?? []) as BlockRow[]).map(toBlock));
  });
}

/**
 * Creates or moves a block through `save_professional_block`.
 *
 * The database accepts the block even where appointments already are, and
 * answers with the times of those that were there. Nothing is cancelled: moving
 * or cancelling an appointment is a decision for whoever runs the schedule, so
 * the conflicts go back as a warning.
 */
async function saveBlock(params: PersonalBlockInput & { id?: string }): Promise<SingleResult<SavedBlock>> {
  return executar(async () => {
    const invalid = blockError(params);
    if (invalid) return fail(ERROR_CODE.VALIDATION, invalid);

    const { data, error } = await getSupabaseClient().rpc("save_professional_block", {
      p_starts_at: params.starts_at,
      p_ends_at: params.ends_at,
      p_label: params.label?.trim() || null,
      p_block_id: params.id ?? null,
    });
    if (error) return falhaDe(error);

    const saved = data as { block_id: string; conflicts: { starts_at: string; ends_at: string }[] | null };

    return okOne<SavedBlock>({ id: saved.block_id, conflicts: saved.conflicts ?? [] });
  });
}

export async function createBlock(params: PersonalBlockInput): Promise<SingleResult<SavedBlock>> {
  return saveBlock(params);
}

export async function updateBlock(params: PersonalBlockInput & { id: string }): Promise<SingleResult<SavedBlock>> {
  return saveBlock(params);
}

export async function deleteBlock(params: { id: string }): Promise<SingleResult<null>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("professional_blocks")
      .delete()
      .eq("id", params.id)
      .select("id");
    if (error) return falhaDe(error);

    if (!data || data.length === 0) {
      return fail(ERROR_CODE.NOT_FOUND, "Este bloqueio não existe mais ou não é seu.");
    }
    return okOne(null);
  });
}
