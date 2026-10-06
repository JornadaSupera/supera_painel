import { ExternalLink, MessageSquareText } from "lucide-react";
import { Link } from "react-router-dom";

import {
  Can,
  EmptyState,
  ErrorState,
  FilterSelect,
  Pagination,
  SkeletonCards,
  StatusBadge,
  type StatusTone,
} from "@/components/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { NPS_CATEGORY_LABEL } from "@/lib/nps";
import { PERMISSAO } from "@/lib/rbac";
import type { NpsCategory, SatisfactionMilestone, SatisfactionResponse } from "@/types/satisfaction";
import { useSatisfactionAnswers, type AnswerFilters } from "../hooks/useSatisfaction";

/**
 * The answers, one by one: score, moment, comment and who to open.
 *
 * A patient is shown by the short code, not by name. The answer is attributable,
 * but the name is a personal datum, and reading it is what the patient record is
 * for — where the access is recorded. The link opens that record.
 */

const CATEGORY_TONE: Record<NpsCategory, StatusTone> = {
  promoter: "success",
  passive: "neutral",
  detractor: "danger",
};

const CATEGORY_OPTIONS = (Object.keys(NPS_CATEGORY_LABEL) as NpsCategory[]).map((value) => ({
  value,
  label: NPS_CATEGORY_LABEL[value],
}));

function AnswerCard({ answer }: { answer: SatisfactionResponse }) {
  return (
    <article className="bg-card flex flex-col gap-2 rounded-2xl border p-4">
      <header className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={CATEGORY_TONE[answer.category]} size="sm">
          Nota {answer.score} · {NPS_CATEGORY_LABEL[answer.category]}
        </StatusBadge>
        <span className="text-muted-foreground text-xs">{answer.milestone_label}</span>
        <time dateTime={answer.answered_at} className="text-muted-foreground ml-auto text-xs tabular-nums">
          {formatDateTime(answer.answered_at)}
        </time>
      </header>

      {answer.comment ? (
        <p className="text-sm whitespace-pre-wrap">{answer.comment}</p>
      ) : (
        <p className="text-muted-foreground text-sm italic">Sem comentário.</p>
      )}

      <footer className="text-muted-foreground flex items-center gap-2 text-xs">
        <span className="tabular-nums">{answer.patient_code}</span>
        <Can permission={PERMISSAO.PACIENTES_READ}>
          <Link
            to={`/pacientes/${answer.patient_id}`}
            className="text-primary-ink inline-flex items-center gap-1 underline-offset-2 hover:underline"
          >
            Abrir ficha
            <ExternalLink size={12} aria-hidden="true" />
          </Link>
        </Can>
      </footer>
    </article>
  );
}

export function SatisfactionAnswers({
  days,
  milestones,
  filters,
  onFiltersChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  days: number | null;
  milestones: SatisfactionMilestone[];
  filters: AnswerFilters;
  onFiltersChange: (filters: AnswerFilters) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const answers = useSatisfactionAnswers({ days, filters, page, pageSize });

  const items = answers.data?.data ?? [];
  const total = answers.data?.count ?? 0;
  const filtered = Boolean(filters.category || filters.milestone || filters.withComment);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="satisfaction-answers">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="satisfaction-answers" className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquareText size={15} aria-hidden="true" className="text-primary-ink" />
          Avaliações e comentários
          {answers.data && <span className="text-muted-foreground font-normal">· {total}</span>}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Categoria"
            value={filters.category}
            onChange={(value) => onFiltersChange({ ...filters, category: value as AnswerFilters["category"] })}
            options={CATEGORY_OPTIONS}
            allLabel="Categoria: todas"
            className="w-44"
          />
          <FilterSelect
            label="Momento"
            value={filters.milestone}
            onChange={(value) => onFiltersChange({ ...filters, milestone: value })}
            options={milestones.map((milestone) => ({ value: milestone.code, label: milestone.label }))}
            allLabel="Momento: todos"
            className="w-52"
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id="satisfaction-with-comment"
              checked={filters.withComment}
              onCheckedChange={(checked) => onFiltersChange({ ...filters, withComment: checked === true })}
            />
            <Label htmlFor="satisfaction-with-comment" className="text-sm font-normal">
              Só com comentário
            </Label>
          </div>
        </div>
      </div>

      {answers.isLoading && <SkeletonCards count={3} />}

      {answers.isError && <ErrorState error={answers.error} onRetry={() => void answers.refetch()} compact />}

      {answers.data && items.length === 0 && (
        <EmptyState
          compact
          variant={filtered ? "search" : "empty"}
          title={filtered ? "Nenhuma avaliação neste recorte" : "Nenhuma avaliação neste período"}
          description={
            filtered
              ? "Nenhuma resposta corresponde aos filtros aplicados."
              : "Quando os pacientes responderem à pesquisa, as notas e os comentários aparecem aqui."
          }
        />
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((answer) => (
            <AnswerCard key={answer.id} answer={answer} />
          ))}
        </div>
      )}

      {total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          count={total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          label="avaliações"
          className="rounded-2xl border"
        />
      )}
    </section>
  );
}

export default SatisfactionAnswers;
