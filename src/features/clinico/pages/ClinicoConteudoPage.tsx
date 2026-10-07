import { ArrowRight, Eye, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  Can,
  EmptyState,
  ErrorState,
  FilterChip,
  FilterChipGroup,
  PageHeader,
  SkeletonCards,
  StatusBadge,
  TONE_CONTENT_STATUS,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  ESPECIALIDADE_LABEL,
  STATUS_CONTEUDO,
  STATUS_CONTEUDO_LABEL,
  TIPO_CONTEUDO_LABEL,
  type StatusConteudo,
} from "@/lib/enums";
import { formatNumber, relativeTime } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import { CONTENT_KIND_ICON } from "../content-kind-icons";
import { useMinhasOrientacoes } from "../hooks/useOrientacoes";

/**
 * Minhas orientações — o que a própria pessoa escreveu, e onde cada texto está
 * no caminho até o paciente.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/psicologo/conteudo/
 *
 * O fluxo é o do protótipo: você escreve → em revisão → o administrador aprova →
 * publicado e visível aos pacientes. Uma versão devolvida volta aqui com o
 * comentário do revisor, e uma rejeitada fica no histórico.
 *
 * O olho de cada cartão conta os pacientes que marcaram a orientação como lida
 * (`summarize_content_reads`), somado desde sempre — só o número, nunca quem.
 * Formatos são os do banco: texto, vídeo e PDF; o "infográfico" do protótipo
 * não existe nele.
 */

type Filtro = StatusConteudo | "todas";

/** The path a text takes to the patient, as the prototype draws it above the cards. */
function FaixaDoFluxo() {
  const passo = <ArrowRight size={12} aria-hidden="true" className="text-muted-foreground shrink-0" />;

  return (
    <p className="bg-card text-muted-foreground flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-3 text-xs">
      <span className="text-foreground font-semibold">Fluxo:</span>
      Você escreve
      {passo}
      <StatusBadge tone={TONE_CONTENT_STATUS[STATUS_CONTEUDO.EM_REVISAO]} size="sm" pill>
        {STATUS_CONTEUDO_LABEL.em_revisao}
      </StatusBadge>
      {passo}
      Administrador aprova
      {passo}
      <StatusBadge tone={TONE_CONTENT_STATUS[STATUS_CONTEUDO.PUBLICADO]} size="sm" pill>
        {STATUS_CONTEUDO_LABEL.publicado}
      </StatusBadge>
      e fica visível aos pacientes
    </p>
  );
}

export function ClinicoConteudoPage() {
  const { user } = useAuth();
  const { especialidade } = useParams<{ especialidade: string }>();
  const navigate = useNavigate();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  const base = `/clinico/${especialidade}/conteudo`;
  const orientacoes = useMinhasOrientacoes();
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const todas = orientacoes.data ?? [];
  const visiveis = filtro === "todas" ? todas : todas.filter((item) => item.status === filtro);

  // Só oferece o filtro do que existe: um chip com zero é um clique sem resultado.
  const contagem = new Map<StatusConteudo, number>();
  for (const item of todas) contagem.set(item.status, (contagem.get(item.status) ?? 0) + 1);

  const vazio = !orientacoes.isLoading && !orientacoes.isError && todas.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area ? `${area} · Produção de conteúdo` : "Produção de conteúdo"}
        title="Minhas orientações"
        subtitle="Conteúdos passam por revisão antes de chegar ao paciente"
        actions={
          <Can permission={PERMISSAO.CONTEUDO_WRITE}>
            <Button onClick={() => navigate(`${base}/nova`)}>
              <Plus />
              Nova orientação
            </Button>
          </Can>
        }
      />

      <FaixaDoFluxo />

      {orientacoes.isLoading && <SkeletonCards count={4} className="md:grid-cols-2" />}

      {orientacoes.isError && (
        <ErrorState error={orientacoes.error} onRetry={() => void orientacoes.refetch()} />
      )}

      {vazio && (
        <EmptyState
          title="Você ainda não escreveu nenhuma orientação"
          description="Escreva a primeira e envie para revisão: depois de aprovada, ela chega aos pacientes elegíveis."
          action={
            <Button onClick={() => navigate(`${base}/nova`)}>
              <Plus />
              Nova orientação
            </Button>
          }
        />
      )}

      {todas.length > 0 && (
        <>
          {contagem.size > 1 && (
            <FilterChipGroup label="Filtrar por situação">
              <FilterChip active={filtro === "todas"} onClick={() => setFiltro("todas")}>
                Todas ({todas.length})
              </FilterChip>
              {[...contagem.entries()].map(([status, total]) => (
                <FilterChip key={status} active={filtro === status} onClick={() => setFiltro(status)}>
                  {STATUS_CONTEUDO_LABEL[status]} ({total})
                </FilterChip>
              ))}
            </FilterChipGroup>
          )}

          <ul className="grid gap-3 md:grid-cols-2">
            {visiveis.map((item) => {
              const Icone = CONTENT_KIND_ICON[item.tipo];

              return (
                <li key={item.id}>
                  <Link
                    to={`${base}/${item.id}`}
                    className="bg-card hover:bg-muted/50 focus-visible:ring-ring flex h-full items-start gap-3 rounded-2xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-muted text-primary-ink flex size-9 shrink-0 items-center justify-center rounded-lg"
                    >
                      <Icone size={18} />
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-foreground text-sm font-semibold">{item.titulo}</span>
                      <span className="text-muted-foreground line-clamp-2 text-xs">{item.resumo}</span>

                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <StatusBadge tone={TONE_CONTENT_STATUS[item.status]} size="sm" pill>
                          {STATUS_CONTEUDO_LABEL[item.status]}
                        </StatusBadge>
                        <StatusBadge tone="neutral" size="sm" pill className="bg-card">
                          {TIPO_CONTEUDO_LABEL[item.tipo]}
                        </StatusBadge>
                        <span
                          className="text-muted-foreground inline-flex items-center gap-1 tabular-nums"
                          title="Pacientes que marcaram como lida"
                        >
                          <Eye size={13} aria-hidden="true" />
                          {item.visualizacoes === null ? "—" : formatNumber(item.visualizacoes)}
                          <span className="sr-only">
                            {item.visualizacoes === null
                              ? "leituras indisponíveis"
                              : item.visualizacoes === 1
                                ? "leitura"
                                : "leituras"}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          · versão {item.versao} · {relativeTime(item.atualizado_em)}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export default ClinicoConteudoPage;
