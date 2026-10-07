import { HeartCrack } from "lucide-react";

import { StatusBadge } from "@/components/shared";
import { useNow } from "@/hooks/useNow";
import { ESPECIALIDADE_LABEL } from "@/lib/enums";
import { pluralize, relativeTime } from "@/lib/format";
import { DISTRESS_HIGHLIGHT_DAYS, recentDistressFlags } from "../distress";
import { useDistressFlags } from "../hooks/usePatientRecord";

/**
 * Distress raised to the team, where the patient is looked at.
 *
 * A professional flags distress from their area's note, and the note itself
 * stays with that area. What the team gets is the fact: who, from which area,
 * when. Highlighted for `DISTRESS_HIGHLIGHT_DAYS` days, then the flag lives on
 * in the record's timeline only.
 */

/** The band at the top of the patient record. */
export function DistressFlagBanner({ patientId }: { patientId: string }) {
  const flags = useDistressFlags(patientId);
  const now = useNow().getTime();
  const recent = recentDistressFlags(flags.data, now);
  const latest = recent[0];

  if (!latest) return null;

  const area = latest.specialty ? ESPECIALIDADE_LABEL[latest.specialty] : null;

  return (
    <section
      role="status"
      aria-label="Sofrimento sinalizado à equipe"
      className="border-destructive/40 bg-destructive/10 flex items-start gap-3 rounded-2xl border p-4"
    >
      <span
        aria-hidden="true"
        className="bg-destructive text-destructive-foreground flex size-9 shrink-0 items-center justify-center rounded-full"
      >
        <HeartCrack size={18} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-foreground text-sm font-semibold">Sofrimento sinalizado à equipe</p>
        <p className="text-sm">
          Por {latest.raised_by_name}
          {area ? ` (${area})` : ""}, {relativeTime(latest.raised_at)}.
          {recent.length > 1 &&
            ` ${pluralize(recent.length, "sinalização", "sinalizações")} nos últimos ${DISTRESS_HIGHLIGHT_DAYS} dias.`}
        </p>
        <p className="text-muted-foreground text-xs">
          A anotação que originou o sinal fica com a área que a escreveu. O histórico está na linha
          do tempo da ficha.
        </p>
      </div>
    </section>
  );
}

/** The short mark next to a patient's name on a list. */
export function DistressFlagBadge({ patientId }: { patientId: string }) {
  const flags = useDistressFlags(patientId);
  const now = useNow().getTime();

  if (recentDistressFlags(flags.data, now).length === 0) return null;

  return (
    <StatusBadge tone="danger" size="sm" pill>
      <HeartCrack size={11} aria-hidden="true" />
      Sofrimento sinalizado
    </StatusBadge>
  );
}
