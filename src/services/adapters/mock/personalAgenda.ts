import { blockError } from "@/lib/agenda";
import { agendaClinica } from "@/mocks/agendaClinica";
import { businessHours, personalBlocks } from "@/mocks/personalAgenda";
import { ERROR_CODE, fail, ok, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type {
  AppointmentTypeOption,
  BusinessHour,
  PersonalBlock,
  PersonalBlockInput,
} from "@/types/agenda";
import { simulate } from "./_helpers";

/** The professional's own calendar — mock mode. Data in `mocks/personalAgenda.ts`. */

export async function listAppointmentTypes(): Promise<ListResult<AppointmentTypeOption>> {
  return simulate(() => {
    // The mock has no catalog: the kinds are the ones its appointments use.
    const labels = [...new Set(agendaClinica.map((appointment) => appointment.tipo_label))].sort();
    return ok(labels.map((label) => ({ id: label, label })));
  });
}

export async function listBusinessHours(): Promise<ListResult<BusinessHour>> {
  return simulate(() => ok(businessHours));
}

export async function listMyBlocks(params: { from: string; to: string }): Promise<ListResult<PersonalBlock>> {
  return simulate(() =>
    ok(
      personalBlocks
        .filter((block) => block.starts_at < params.to && block.ends_at > params.from)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    ),
  );
}

export async function createBlock(params: PersonalBlockInput): Promise<SingleResult<PersonalBlock>> {
  return simulate(() => {
    const invalid = blockError(params);
    if (invalid) return fail(ERROR_CODE.VALIDATION, invalid);

    const block: PersonalBlock = {
      id: crypto.randomUUID(),
      label: params.label?.trim() || null,
      starts_at: params.starts_at,
      ends_at: params.ends_at,
    };
    personalBlocks.push(block);
    return okOne(block);
  });
}

export async function updateBlock(
  params: PersonalBlockInput & { id: string },
): Promise<SingleResult<PersonalBlock>> {
  return simulate(() => {
    const invalid = blockError(params);
    if (invalid) return fail(ERROR_CODE.VALIDATION, invalid);

    const block = personalBlocks.find((item) => item.id === params.id);
    if (!block) return fail(ERROR_CODE.NOT_FOUND, "Este bloqueio não existe mais ou não é seu.");

    block.label = params.label?.trim() || null;
    block.starts_at = params.starts_at;
    block.ends_at = params.ends_at;
    return okOne({ ...block });
  });
}

export async function deleteBlock(params: { id: string }): Promise<SingleResult<null>> {
  return simulate(() => {
    const index = personalBlocks.findIndex((item) => item.id === params.id);
    if (index < 0) return fail(ERROR_CODE.NOT_FOUND, "Este bloqueio não existe mais ou não é seu.");

    personalBlocks.splice(index, 1);
    return okOne(null);
  });
}
