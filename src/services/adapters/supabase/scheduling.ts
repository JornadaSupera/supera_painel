import { ERROR_CODE, fail, ok, okOne, type FailResult, type ListResult, type SingleResult } from "@/services/contracts";
import type { AppointmentInput, AppointmentOutcome, BusyInterval, SchedulingAccess } from "@/types/agenda";
import { executar, falhaDe, mensagemDaSentinela, type ErroPostgrest } from "./_helpers";
import { getSupabaseClient } from "./client";
import { paraCodigoDeEspecialidade } from "./mapping";

/**
 * Booking, moving and closing appointments from the clinical panel.
 *
 * Every write here needs the grant that makes someone run the schedule, and the
 * database checks it on each call. The panel never decides who may: it draws the
 * buttons for whoever the one call that needs the grant lets through
 * (`getSchedulingAccess`), and relays what the database answers — including the
 * refusals that have a reason a person can act on:
 *
 *  - `slot_blocked`: the professional blocked that time. The database does not
 *    say why, on purpose, and neither does the screen.
 *  - `appointment_not_found`: no such appointment, OR one the caller cannot see.
 *    The two answer the same, so nobody learns an id exists by trying it.
 *  - `origin_specialty_not_allowed`: a session of a confidential area is booked
 *    only by someone from that area.
 */

/**
 * The refusal for someone without the grant arrives as a free-text exception
 * ("apenas profissional ativo marca compromisso"), not as a sentinel: nothing in
 * it tells the screen what to do. It is recognised by its shape and answered with
 * what to ask for.
 */
function failureOf(error: ErroPostgrest): FailResult {
  // The database explains a blocked time with a hint that names the function to
  // call to avoid it — a note for whoever writes the client, not for the person
  // booking. The sentence here says only what they can act on: pick another time.
  if (error.message === "slot_blocked") {
    return fail(ERROR_CODE.CONFLICT, mensagemDaSentinela("slot_blocked"), {
      code: error.code,
      message: error.message,
    });
  }

  if (error.message?.startsWith("apenas profissional ativo")) {
    return fail(
      ERROR_CODE.FORBIDDEN,
      "Você não gere a agenda da clínica. Peça a um administrador a permissão “Marcar, remarcar e alterar compromisso na agenda”.",
      { code: error.code, message: error.message },
    );
  }

  return falhaDe(error);
}

export async function getSchedulingAccess(): Promise<SingleResult<SchedulingAccess>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data: session } = await supabase.auth.getSession();
    const accountId = session.session?.user.id;
    if (!accountId) return fail(ERROR_CODE.UNAUTHORIZED, "Sua sessão expirou. Entre de novo para continuar.");

    const { data: profile, error: profileError } = await supabase
      .from("professionals")
      .select("id")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .maybeSingle();
    if (profileError) return falhaDe(profileError);

    const professionalId = (profile as { id: string } | null)?.id ?? null;
    if (!professionalId) return okOne<SchedulingAccess>({ allowed: false, professional_id: null });

    // The cheapest call that asks for the grant: an hour of busy intervals.
    // `forbidden` is the database saying no; anything else is a real failure and
    // must not read as "no".
    const from = new Date();
    const { error } = await supabase.rpc("read_professional_busy_intervals", {
      p_from: from.toISOString(),
      p_to: new Date(from.getTime() + 60 * 60_000).toISOString(),
    });

    if (error) {
      if (error.code === "42501") return okOne<SchedulingAccess>({ allowed: false, professional_id: professionalId });
      return falhaDe(error);
    }

    return okOne<SchedulingAccess>({ allowed: true, professional_id: professionalId });
  });
}

export async function listBusyIntervals(params: { from: string; to: string }): Promise<ListResult<BusyInterval>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient().rpc("read_professional_busy_intervals", {
      p_from: params.from,
      p_to: params.to,
    });
    if (error) return failureOf(error);

    return ok((data ?? []) as BusyInterval[]);
  });
}

export async function scheduleAppointment(params: AppointmentInput): Promise<SingleResult<{ id: string }>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    if (!params.title.trim()) return fail(ERROR_CODE.VALIDATION, "Informe o título do compromisso.");
    if (!params.location_label.trim()) return fail(ERROR_CODE.VALIDATION, "Informe o local.");
    if (new Date(params.ends_at) <= new Date(params.starts_at)) {
      return fail(ERROR_CODE.VALIDATION, "O fim precisa ser depois do início.");
    }

    let professionalId: string;
    if (params.professional === "me") {
      const access = await getSchedulingAccess();
      if (access.error) return access as FailResult;
      if (!access.data?.professional_id) {
        return fail(ERROR_CODE.FORBIDDEN, "Só quem tem perfil de profissional ativo marca compromisso.");
      }
      professionalId = access.data.professional_id;
    } else {
      professionalId = params.professional;
    }

    let originSpecialtyId: string | null = null;
    if (params.origin_specialty) {
      const { data: specialty, error: specialtyError } = await supabase
        .from("specialties")
        .select("id")
        .eq("code", paraCodigoDeEspecialidade(params.origin_specialty))
        .maybeSingle();
      if (specialtyError) return falhaDe(specialtyError);
      originSpecialtyId = (specialty as { id: string } | null)?.id ?? null;
    }

    const { data, error } = await supabase.rpc("schedule_appointment", {
      p_patient_id: params.patient_id,
      p_appointment_type_id: params.appointment_type_id,
      p_title: params.title.trim(),
      p_starts_at: params.starts_at,
      p_ends_at: params.ends_at,
      p_location_label: params.location_label.trim(),
      p_professional_id: professionalId,
      p_origin_specialty_id: originSpecialtyId,
      p_patient_notes: params.patient_notes?.trim() || null,
    });
    if (error) return failureOf(error);

    return okOne({ id: data as string });
  });
}

export async function rescheduleAppointment(params: {
  id: string;
  starts_at: string;
  ends_at: string;
}): Promise<SingleResult<{ id: string }>> {
  return executar(async () => {
    if (new Date(params.ends_at) <= new Date(params.starts_at)) {
      return fail(ERROR_CODE.VALIDATION, "O fim precisa ser depois do início.");
    }

    const { data, error } = await getSupabaseClient().rpc("reschedule_appointment", {
      p_appointment_id: params.id,
      p_starts_at: params.starts_at,
      p_ends_at: params.ends_at,
    });
    if (error) return failureOf(error);

    return okOne({ id: data as string });
  });
}

export async function setAppointmentStatus(params: {
  id: string;
  outcome: AppointmentOutcome;
}): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_appointment_status", {
      p_appointment_id: params.id,
      p_status_code: params.outcome,
    });
    if (error) return failureOf(error);

    return okOne(null);
  });
}
