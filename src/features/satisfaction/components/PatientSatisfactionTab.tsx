import { EmptyState, ErrorState, SkeletonCards } from "@/components/shared";
import { usePatientSatisfaction } from "../hooks/useSatisfaction";
import { AnswerCard } from "./SatisfactionAnswers";

/**
 * The satisfaction tab of the patient record: every answer this patient gave
 * to the survey — score, moment of the journey and comment — newest first.
 *
 * Administration only: the survey is read by the administration, so the
 * clinical record has no such tab.
 */
export function PatientSatisfactionTab({ patientId }: { patientId: string }) {
  const answers = usePatientSatisfaction(patientId);
  const items = answers.data?.data ?? [];

  if (answers.isLoading) return <SkeletonCards count={2} />;

  if (answers.isError) {
    return <ErrorState compact error={answers.error} onRetry={() => void answers.refetch()} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        compact
        title="Nenhuma avaliação"
        description="Este paciente ainda não respondeu à pesquisa de satisfação."
      />
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Avaliações do paciente">
      {items.map((answer) => (
        <AnswerCard key={answer.id} answer={answer} showPatient={false} />
      ))}
    </section>
  );
}

export default PatientSatisfactionTab;
