import { FilePlus2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  Can,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonCards,
  StatusBadge,
  TONE_CONTENT_STATUS,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  ESPECIALIDADE_LABEL,
  STATUS_CONTEUDO_LABEL,
  TIPO_CONTEUDO_LABEL,
  type StatusConteudo,
} from "@/lib/enums";
import { relativeTime } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { useMinhasOrientacoes } from "../hooks/useOrientacoes";

/**
 * Minhas orientações — o que a própria pessoa escreveu, e onde cada texto está
 * no caminho até o paciente.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/medico/conteudo/
 *
 * O fluxo é o do protótipo: você escreve → em revisão → o administrador aprova →
 * publicado e visível aos pacientes. Uma versão devolvida volta aqui com o
 * comentário do revisor, e uma rejeitada fica no histórico.
 */

type Filtro = StatusConteudo | "todas";

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
        eyebrow={area}
        title="Minhas orientações"
        subtitle="Você escreve → Em revisão → O administrador aprova → Publicado, visível aos pacientes"
        actions={
          <Can permission={PERMISSAO.CONTEUDO_WRITE}>
            <Button onClick={() => navigate(`${base}/nova`)}>
              <FilePlus2 />
              Nova orientação
            </Button>
          </Can>
        }
      />

      {orientacoes.isLoading && <SkeletonCards count={3} />}

      {orientacoes.isError && (
        <ErrorState error={orientacoes.error} onRetry={() => void orientacoes.refetch()} />
      )}

      {vazio && (
        <EmptyState
          title="Você ainda não escreveu nenhuma orientação"
          description="Escreva a primeira e envie para revisão: depois de aprovada, ela chega aos pacientes elegíveis."
          action={
            <Button onClick={() => navigate(`${base}/nova`)}>
              <FilePlus2 />
              Nova orientação
            </Button>
          }
        />
      )}

      {todas.length > 0 && (
        <>
          <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
            <FiltroChip ativo={filtro === "todas"} onClick={() => setFiltro("todas")}>
              Todas ({todas.length})
            </FiltroChip>
            {[...contagem.entries()].map(([status, total]) => (
              <FiltroChip key={status} ativo={filtro === status} onClick={() => setFiltro(status)}>
                {STATUS_CONTEUDO_LABEL[status]} ({total})
              </FiltroChip>
            ))}
          </div>

          <ul className="grid gap-3 md:grid-cols-2">
            {visiveis.map((item) => (
              <li key={item.id}>
                <Link
                  to={`${base}/${item.id}`}
                  className="bg-card hover:bg-muted/50 focus-visible:ring-ring flex h-full flex-col gap-2 rounded-2xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-foreground min-w-0 text-sm font-semibold">{item.titulo}</h2>
                    <StatusBadge tone={TONE_CONTENT_STATUS[item.status]} size="sm" dot className="shrink-0">
                      {STATUS_CONTEUDO_LABEL[item.status]}
                    </StatusBadge>
                  </div>

                  <p className="text-muted-foreground line-clamp-2 text-xs">{item.resumo}</p>

                  <p className="text-muted-foreground mt-auto text-[11px]">
                    {TIPO_CONTEUDO_LABEL[item.tipo]} · {item.categoria} · versão {item.versao} ·{" "}
                    {relativeTime(item.atualizado_em)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function FiltroChip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        ativo ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export default ClinicoConteudoPage;
