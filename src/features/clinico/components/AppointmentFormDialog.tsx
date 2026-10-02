import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarX2, LoaderCircle, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, type FieldErrors, type UseFormRegisterReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addDays, dayStart, instantParts, overlapsBusy, timeOfMinutes } from "@/lib/agenda";
import { ESPECIALIDADE_LABEL, type Especialidade } from "@/lib/enums";
import type { SchedulingAccess } from "@/types/agenda";
import type { CompromissoAgenda } from "@/types/clinico";
import { useTransferTargets } from "../hooks/useConversationTransfer";
import { useAppointmentTypes } from "../hooks/usePersonalAgenda";
import {
  useBusyIntervals,
  usePatientSearch,
  useRescheduleAppointment,
  useScheduleAppointment,
} from "../hooks/useScheduling";
import {
  appointmentSchema,
  appointmentWindow,
  rescheduleSchema,
  type AppointmentForm,
  type RescheduleForm,
} from "../schemas";

/**
 * Book a new appointment, or move one that is already booked.
 *
 * Booking asks who, what, when and where. Moving asks only when: the database
 * copies everything else into the new appointment and marks the old one as
 * rescheduled, so the dialog has nothing else to ask.
 *
 * > [!] The busy warning is a courtesy, not the rule.
 * Whoever the appointment is for may have blocked that time, and the database
 * refuses it (`slot_blocked`) without saying why. The form reads the same
 * unavailable intervals the team can see — times only, no label — and says
 * "unavailable" before the click, so the refusal is the exception. A stale list
 * can only fail to warn; the database still decides.
 */

const MOMENT_DEFAULTS = { startTime: "09:00", endTime: "10:00" };

/** Times as the form wants them, from the appointment being moved. */
function momentOf(appointment: CompromissoAgenda) {
  const start = instantParts(appointment.inicio);
  const end = instantParts(appointment.fim);
  return { date: start.key, startTime: timeOfMinutes(start.minutes), endTime: timeOfMinutes(end.minutes) };
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  appointment,
  defaultDay,
  access,
  area,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The appointment to move; `null` books a new one. */
  appointment: CompromissoAgenda | null;
  /** The day a new appointment starts on. */
  defaultDay: string;
  access: SchedulingAccess | null;
  /** The booker\x27s own area: it decides who sees a session, so Psychology stays in Psychology. */
  area: Especialidade | null;
}) {
  const moving = appointment !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Each form mounts fresh on open, so what was typed for one appointment
            never survives into the next. */}
        {open &&
          (moving ? (
            <RescheduleBody appointment={appointment} onClose={() => onOpenChange(false)} access={access} />
          ) : (
            <BookBody defaultDay={defaultDay} onClose={() => onOpenChange(false)} access={access} area={area} />
          ))}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------
   UNAVAILABLE
   ------------------------------------------------------------------------- */

/** The day\x27s unavailable intervals, and whether the chosen window touches the professional\x27s. */
function useBusyWarning(date: string, startsAt: string, endsAt: string, professionalId: string | null) {
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const busy = useBusyIntervals(
    validDate ? { from: dayStart(date), to: dayStart(addDays(date, 1)) } : { from: "", to: "" },
    validDate && professionalId !== null,
  );

  return Boolean(busy.data && overlapsBusy(busy.data, professionalId, startsAt, endsAt));
}

function BusyNotice() {
  return (
    <p role="alert" className="text-destructive flex items-center gap-2 text-sm">
      <CalendarX2 size={16} aria-hidden="true" />
      O profissional não está disponível neste horário. Escolha outro.
    </p>
  );
}

/* -------------------------------------------------------------------------
   MOVE
   ------------------------------------------------------------------------- */

function RescheduleBody({
  appointment,
  onClose,
  access,
}: {
  appointment: CompromissoAgenda;
  onClose: () => void;
  access: SchedulingAccess | null;
}) {
  const reschedule = useRescheduleAppointment();

  const { register, handleSubmit, watch, formState } = useForm<RescheduleForm>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: momentOf(appointment),
  });

  const values = watch();
  const window = useMemo(() => {
    try {
      return appointmentWindow(values);
    } catch {
      return { starts_at: "", ends_at: "" };
    }
  }, [values]);

  // The personal agenda only holds the caller\x27s own appointments.
  const unavailable = useBusyWarning(values.date, window.starts_at, window.ends_at, access?.professional_id ?? null);

  const submit = handleSubmit((form) => {
    reschedule.mutate({ id: appointment.id, ...appointmentWindow(form) }, { onSuccess: onClose });
  });

  const errors = formState.errors;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Remarcar · {appointment.paciente_nome}</DialogTitle>
        <DialogDescription>
          {appointment.tipo_label}. O horário atual fica como remarcado e nasce um compromisso novo; o paciente é
          avisado.
        </DialogDescription>
      </DialogHeader>

      <MomentFields
        fields={{ date: register("date"), startTime: register("startTime"), endTime: register("endTime") }}
        errors={errors}
        idPrefix="move"
      />

      {unavailable && <BusyNotice />}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={reschedule.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={reschedule.isPending || unavailable}>
          {reschedule.isPending && <LoaderCircle className="animate-spin" />}
          {reschedule.isPending ? "Remarcando…" : "Remarcar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* -------------------------------------------------------------------------
   BOOK
   ------------------------------------------------------------------------- */

function BookBody({
  defaultDay,
  onClose,
  access,
  area,
}: {
  defaultDay: string;
  onClose: () => void;
  access: SchedulingAccess | null;
  area: Especialidade | null;
}) {
  const schedule = useScheduleAppointment();
  const types = useAppointmentTypes();
  const targets = useTransferTargets(true);

  const [patientName, setPatientName] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const patients = usePatientSearch(patientName ? "" : term);

  const { register, handleSubmit, setValue, watch, formState } = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: "",
      typeId: "",
      title: "",
      date: defaultDay,
      ...MOMENT_DEFAULTS,
      location: "",
      professional: "me",
      notes: "",
    },
  });

  const values = watch();
  const window = useMemo(() => {
    try {
      return appointmentWindow(values);
    } catch {
      return { starts_at: "", ends_at: "" };
    }
  }, [values]);

  const target = targets.data?.find((item) => item.professional_id === values.professional) ?? null;
  const professionalId = values.professional === "me" ? (access?.professional_id ?? null) : values.professional;

  const unavailable = useBusyWarning(values.date, window.starts_at, window.ends_at, professionalId);

  // The area the session belongs to follows who it is for: the caller\x27s own, or
  // the colleague\x27s main one. A session of a confidential area booked by someone
  // outside it is refused by the database, and says so.
  const originSpecialty: Especialidade | null = values.professional === "me" ? area : (target?.specialties[0] ?? null);

  const errors = formState.errors;

  const pickType = (typeId: string) => {
    setValue("typeId", typeId, { shouldValidate: true });
    // A title is required and almost always the kind itself: offer it, keep it editable.
    if (!values.title.trim()) {
      const label = types.data?.find((type) => type.id === typeId)?.label;
      if (label) setValue("title", label, { shouldValidate: true });
    }
  };

  const submit = handleSubmit((form) => {
    schedule.mutate(
      {
        patient_id: form.patientId,
        appointment_type_id: form.typeId,
        title: form.title,
        ...appointmentWindow(form),
        location_label: form.location,
        professional: form.professional,
        origin_specialty: originSpecialty,
        patient_notes: form.notes || null,
      },
      { onSuccess: onClose },
    );
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Nova consulta</DialogTitle>
        <DialogDescription>
          O paciente é avisado pelo aplicativo. O horário não pode coincidir com um bloqueio de quem vai atender.
        </DialogDescription>
      </DialogHeader>

      {/* Patient */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="appt-patient">Paciente</Label>

        {patientName ? (
          <div className="bg-muted flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm">
            <span className="font-medium">{patientName}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Trocar paciente"
              onClick={() => {
                setPatientName(null);
                setTerm("");
                setValue("patientId", "", { shouldValidate: false });
              }}
            >
              <X />
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search
                size={15}
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              />
              <Input
                id="appt-patient"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Nome, código ou CPF"
                autoComplete="off"
                className="pl-9"
                aria-invalid={Boolean(errors.patientId)}
              />
            </div>

            {term.trim().length >= 2 && (
              <ul className="border-border max-h-44 overflow-y-auto rounded-md border" aria-label="Pacientes encontrados">
                {patients.isLoading && <li className="text-muted-foreground px-3 py-2 text-sm">Buscando…</li>}
                {patients.isError && (
                  <li className="text-destructive px-3 py-2 text-sm">Não foi possível buscar agora.</li>
                )}
                {patients.data?.length === 0 && (
                  <li className="text-muted-foreground px-3 py-2 text-sm">Nenhum paciente ativo encontrado.</li>
                )}
                {patients.data?.map((patient) => (
                  <li key={patient.id}>
                    <button
                      type="button"
                      className="hover:bg-muted focus-visible:bg-muted flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm focus-visible:outline-none"
                      onClick={() => {
                        setValue("patientId", patient.id, { shouldValidate: true });
                        setPatientName(patient.nome);
                      }}
                    >
                      <span className="font-medium">{patient.nome}</span>
                      <span className="text-muted-foreground text-xs">{patient.codigo}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {errors.patientId && (
          <p role="alert" className="text-destructive text-xs">
            {errors.patientId.message}
          </p>
        )}
      </div>

      {/* Kind and title */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="appt-type">Tipo</Label>
          <Select value={values.typeId} onValueChange={pickType}>
            <SelectTrigger id="appt-type" aria-invalid={Boolean(errors.typeId)}>
              <SelectValue placeholder={types.isLoading ? "Carregando…" : "Escolha o tipo"} />
            </SelectTrigger>
            <SelectContent>
              {(types.data ?? []).map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.typeId && (
            <p role="alert" className="text-destructive text-xs">
              {errors.typeId.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="appt-title">Título</Label>
          <Input id="appt-title" {...register("title")} aria-invalid={Boolean(errors.title)} />
          {errors.title && (
            <p role="alert" className="text-destructive text-xs">
              {errors.title.message}
            </p>
          )}
        </div>
      </div>

      <MomentFields
        fields={{ date: register("date"), startTime: register("startTime"), endTime: register("endTime") }}
        errors={errors}
        idPrefix="book"
      />

      {/* Where, and who */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="appt-location">Local</Label>
          <Input
            id="appt-location"
            placeholder="Consultório, sala de infusão…"
            {...register("location")}
            aria-invalid={Boolean(errors.location)}
          />
          {errors.location && (
            <p role="alert" className="text-destructive text-xs">
              {errors.location.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="appt-professional">Com quem</Label>
          <Select value={values.professional} onValueChange={(value) => setValue("professional", value)}>
            <SelectTrigger id="appt-professional">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Eu (minha agenda)</SelectItem>
              {(targets.data ?? []).map((item) => (
                <SelectItem key={item.professional_id} value={item.professional_id}>
                  {item.name}
                  {item.specialties[0] ? ` · ${ESPECIALIDADE_LABEL[item.specialties[0]]}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="appt-notes">
          Recado ao paciente <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Textarea
          id="appt-notes"
          rows={2}
          placeholder="Ex.: venha em jejum de 4 horas."
          {...register("notes")}
          aria-invalid={Boolean(errors.notes)}
        />
        <p className="text-muted-foreground text-xs">
          O paciente lê este texto no aplicativo. Não é anotação clínica.
        </p>
        {errors.notes && (
          <p role="alert" className="text-destructive text-xs">
            {errors.notes.message}
          </p>
        )}
      </div>

      {unavailable && <BusyNotice />}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={schedule.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={schedule.isPending || unavailable}>
          {schedule.isPending && <LoaderCircle className="animate-spin" />}
          {schedule.isPending ? "Marcando…" : "Marcar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* -------------------------------------------------------------------------
   SHARED FIELDS
   ------------------------------------------------------------------------- */

function MomentFields({
  fields,
  errors,
  idPrefix,
}: {
  fields: { date: UseFormRegisterReturn; startTime: UseFormRegisterReturn; endTime: UseFormRegisterReturn };
  errors: FieldErrors<RescheduleForm>;
  idPrefix: string;
}) {
  // The three fields share one row on a wide screen, so one message line serves them.
  const message = errors.date?.message ?? errors.startTime?.message ?? errors.endTime?.message;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[1fr_auto_auto] items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-date`}>Dia</Label>
          <Input id={`${idPrefix}-date`} type="date" {...fields.date} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-start`}>Início</Label>
          <Input id={`${idPrefix}-start`} type="time" {...fields.startTime} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-end`}>Fim</Label>
          <Input id={`${idPrefix}-end`} type="time" aria-invalid={Boolean(errors.endTime)} {...fields.endTime} />
        </div>
      </div>
      {message && (
        <p role="alert" className="text-destructive text-xs">
          {message}
        </p>
      )}
    </div>
  );
}

export default AppointmentFormDialog;
