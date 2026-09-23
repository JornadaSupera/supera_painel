import { ErrorState, StatusBadge } from "@/components/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import type { CuidadorVinculado } from "@/types/paciente";
import { useCuidadores } from "../hooks/usePacientes";

/**
 * Quem acompanha o paciente no aplicativo.
 *
 * > [!] É dado pessoal de TERCEIRO dentro da ficha de outra pessoa.
 * Nome, e-mail e telefone aqui são de quem o paciente convidou, não dele.
 * Chegam mascarados e **não há revelação nesta tela**: o painel precisa saber
 * que o vínculo existe e quem é: quem precisa do contato do acompanhante é o
 * titular, no aplicativo dele. É a diferença entre registrar um vínculo e
 * manter uma agenda de terceiros.
 *
 * Somente leitura, e por desenho: convidar e revogar são atos do titular. O
 * painel enxerga porque o encarregado de dados pergunta por esses vínculos —
 * não para administrá-los.
 */

function Linha({ cuidador }: { cuidador: CuidadorVinculado }) {
  const revogado = cuidador.status === "revogado";

  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p
          className={
            revogado
              ? "text-muted-foreground truncate text-xs font-medium"
              : "text-foreground truncate text-xs font-medium"
          }
        >
          {cuidador.nome}
        </p>

        <p className="text-muted-foreground truncate text-[11px]">
          {cuidador.email_mascarado}
          {cuidador.telefone_mascarado && ` · ${cuidador.telefone_mascarado}`}
        </p>

        <p className="text-muted-foreground text-[11px]">
          vinculado em {formatDate(cuidador.vinculado_em)}
          {cuidador.revogado_em && ` · revogado em ${formatDate(cuidador.revogado_em)}`}
        </p>
      </div>

      <StatusBadge tone={revogado ? "neutral" : "success"} size="sm" dot className="shrink-0">
        {revogado ? "Revogado" : "Ativo"}
      </StatusBadge>
    </li>
  );
}

export function CuidadoresVinculados({ pacienteId }: { pacienteId: string }) {
  const { cuidadores, isLoading, isError, error, refetch } = useCuidadores(pacienteId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  }

  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="flex flex-col gap-3">
      {cuidadores.length === 0 ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Ninguém acompanha esta ficha pelo aplicativo.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {cuidadores.map((cuidador) => (
            <Linha key={cuidador.id} cuidador={cuidador} />
          ))}
        </ul>
      )}

      {/* A ausência do convite pendente nesta lista parece dado faltando, e não
          é: a fila de convites de acompanhante é legível só pelo titular. */}
      <p className="text-muted-foreground border-border border-t pt-3 text-[11px] leading-relaxed">
        Quem convida e quem revoga é o próprio paciente, no aplicativo. Convite de acompanhante
        ainda não aceito não aparece aqui — essa fila é dele. O contato fica mascarado porque é
        dado de outra pessoa dentro desta ficha.
      </p>
    </div>
  );
}

export default CuidadoresVinculados;
