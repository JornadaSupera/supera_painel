import { useState } from "react";

import {
  EmptyState,
  ErrorState,
  SectionHeading,
  SkeletonRows,
  StatusBadge,
  TONE_SEVERITY,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeDay } from "@/lib/agenda";
import { formatDate, formatTime, pluralize } from "@/lib/format";
import { DIARY_INTENSITY_LABEL, DIARY_PAGE_SIZE } from "@/lib/patient-record";
import type { PatientDiaryEntry } from "@/types/patient-record";
import { useDiarySymptoms, usePatientDiary } from "../hooks/usePatientRecord";

/**
 * The patient's diary, inside the record: the latest entries, a few at a time.
 *
 * Each entry shows the text and the symptoms the patient marked, with the grade.
 * The label at the top ("Leve", "Moderado"…) is the strongest symptom of the day
 * on the alerts' scale — read from the grades, not judged by the panel.
 */

/** "Hoje · 20:00", "Há 2 dias · 09:10", or the date once it is more than a week away. */
function whenSent(iso: string): string {
  return `${relativeDay(iso) ?? formatDate(iso)} · ${formatTime(iso)}`;
}

function DiaryEntryCard({ entry }: { entry: PatientDiaryEntry }) {
  const symptoms = useDiarySymptoms(entry.id, true);
  // Sorted strongest first by the adapter. Grade 0 is "não senti": no label.
  const strongest = symptoms.data?.[0];
  const intensity = strongest && strongest.grade > 0 ? strongest.severity : null;

  return (
    <li className="bg-card flex flex-col gap-2 rounded-xl border px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {intensity && (
          <StatusBadge tone={TONE_SEVERITY[intensity]} size="sm" pill>
            {DIARY_INTENSITY_LABEL[intensity]}
          </StatusBadge>
        )}
        <time dateTime={entry.occurred_at} className="text-muted-foreground text-xs tabular-nums">
          {whenSent(entry.occurred_at)}
        </time>
        {entry.by_caregiver && (
          <StatusBadge tone="neutral" size="sm" pill>
            Registrado pelo acompanhante
          </StatusBadge>
        )}
      </div>

      {entry.free_text ? (
        <p className="max-w-4xl text-sm leading-relaxed whitespace-pre-line">{entry.free_text}</p>
      ) : (
        <p className="text-muted-foreground text-sm">Sem texto — só os sintomas marcados.</p>
      )}

      {symptoms.isLoading && (
        <div className="flex gap-1.5" role="status" aria-label="Carregando sintomas">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      )}

      {symptoms.isError && (
        <p className="text-destructive text-xs" role="alert">
          Não foi possível carregar os sintomas.{" "}
          <button type="button" className="underline" onClick={() => void symptoms.refetch()}>
            Tentar de novo
          </button>
        </p>
      )}

      {symptoms.data && symptoms.data.length === 0 && (
        <p className="text-muted-foreground text-xs">Nenhum sintoma marcado.</p>
      )}

      {symptoms.data && symptoms.data.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Sintomas e grau (0 a 5)">
          {symptoms.data.map((symptom) => (
            <li key={symptom.id}>
              <StatusBadge tone="neutral" size="sm" pill className="bg-card">
                {symptom.symptom_label} · {symptom.grade}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function PatientDiaryTab({ patientId }: { patientId: string }) {
  const diary = usePatientDiary(patientId);
  const [shown, setShown] = useState(DIARY_PAGE_SIZE);

  if (diary.isLoading) return <SkeletonRows count={DIARY_PAGE_SIZE} />;

  if (diary.isError || !diary.data) {
    return <ErrorState error={diary.error} onRetry={() => void diary.refetch()} compact />;
  }

  const { entries, capped } = diary.data;

  if (entries.length === 0) {
    return (
      <EmptyState
        compact
        title="Nenhum registro no diário"
        description="Quando o paciente, ou quem o acompanha, enviar o diário pelo aplicativo, os registros aparecem aqui."
      />
    );
  }

  const visible = entries.slice(0, shown);
  const remaining = entries.length - visible.length;
  const nextBatch = Math.min(remaining, DIARY_PAGE_SIZE);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="record-diary-heading">
      <SectionHeading id="record-diary-heading">
        {visible.length === 1
          ? "Último registro do paciente"
          : `Últimos ${visible.length} registros do paciente`}
      </SectionHeading>

      <ol className="flex flex-col gap-2.5">
        {visible.map((entry) => (
          <DiaryEntryCard key={entry.id} entry={entry} />
        ))}
      </ol>

      {remaining > 0 && (
        <Button
          type="button"
          variant="outline"
          className="w-fit self-center"
          onClick={() => setShown((count) => count + DIARY_PAGE_SIZE)}
        >
          Ver {pluralize(nextBatch, "registro anterior", "registros anteriores")}
        </Button>
      )}

      {remaining === 0 && capped && (
        <p className="text-muted-foreground text-center text-xs">
          Estes são os {entries.length} registros mais recentes. Os anteriores ficam fora desta leitura.
        </p>
      )}
    </section>
  );
}

export default PatientDiaryTab;
