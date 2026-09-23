import { EmptyState, ErrorState, SkeletonCards, StatusBadge } from "@/components/shared";
import { formatDateTime } from "@/lib/format";
import { useConsentimentos } from "../hooks/useConfiguracoes";

/**
 * Quem aceitou qual versão do documento legal.
 *
 * É a contrapartida da publicação, e por isso vive na mesma aba: publicar cria
 * a obrigação, isto é a prova de que ela foi cumprida. O aceite é **por
 * versão** — quem aceitou a v1 não aceitou a v2 —, e é exatamente isso que faz
 * do histórico de versões uma prova, e não um registro de alterações.
 *
 * Somente leitura, sem exceção: aceitar é ato do titular no aplicativo, e
 * revogar também. Um botão aqui seria o painel consentindo em nome de alguém.
 */

export function ConsentimentosAceitos() {
  const { consentimentos, isLoading, isError, error, refetch } = useConsentimentos();

  if (isLoading) return <SkeletonCards count={1} />;

  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <section className="bg-card rounded-2xl border p-5">
      <header className="mb-3">
        <h2 className="text-foreground text-sm font-semibold">Aceites registrados</h2>
        <p className="text-muted-foreground text-xs">
          Quem concordou com qual versão, e quando
        </p>
      </header>

      {consentimentos.length === 0 ? (
        <EmptyState
          compact
          title="Nenhum aceite registrado"
          description="Ninguém aceitou uma versão ainda. Enquanto não houver documento publicado, também não há o que aceitar."
        />
      ) : (
        <ul className="divide-border divide-y">
          {consentimentos.map((consentimento) => (
            <li
              key={consentimento.id}
              className="flex items-start justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate text-xs font-medium">
                  {consentimento.pessoa}
                </p>
                <p className="text-muted-foreground truncate text-[11px]">
                  {consentimento.documento}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {formatDateTime(consentimento.aceito_em)}
                </span>

                {consentimento.revogado_em && (
                  <StatusBadge tone="warning" size="sm">
                    Revogado
                  </StatusBadge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ConsentimentosAceitos;
