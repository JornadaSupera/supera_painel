import { KeyRound } from "lucide-react";

import { ErrorState, StatusBadge } from "@/components/shared";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import type { PermissaoRestrita } from "@/types/usuario";
import { useAlterarPermissaoRestrita, usePermissoesRestritas } from "../hooks/useUsuarios";

/**
 * As permissões que o backend RESTRINGE, concedidas por pessoa.
 *
 * > [!] Esta lista se lê ao contrário do que o nome sugere, e dizer isso na
 * > tela é metade do trabalho.
 * O catálogo do backend tem semântica invertida: o que **não** está nele todo
 * profissional ativo já pode fazer. Entrar no catálogo é o ato que **tira** a
 * ação de todos e passa a exigir concessão individual.
 *
 * Então duas linhas aqui não querem dizer "esta pessoa só pode duas coisas".
 * Querem dizer "estas duas são as únicas que alguém precisa receber". Uma tela
 * que não dissesse isso levaria quem opera à conclusão oposta.
 *
 * Não há como editar o catálogo por aqui, e é deliberado: um botão de "remover
 * permissão" teria o efeito de liberar a ação para a clínica inteira.
 */

function Linha({
  permissao,
  onAlternar,
  salvando,
}: {
  permissao: PermissaoRestrita;
  onAlternar: (conceder: boolean) => void;
  salvando: boolean;
}) {
  const id = `permissao-${permissao.codigo}`;

  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <label htmlFor={id} className="text-foreground text-xs font-medium">
          {permissao.label}
        </label>

        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <code className="text-muted-foreground font-mono text-[11px] break-all">{permissao.codigo}</code>

          {permissao.concedida && permissao.concedida_em && (
            <span className="text-muted-foreground text-[11px]">
              desde {formatDate(permissao.concedida_em)}
              {permissao.concedida_por && ` · por ${permissao.concedida_por}`}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {permissao.concedida && (
          <StatusBadge tone="success" size="sm" dot>
            Concedida
          </StatusBadge>
        )}

        <Switch
          id={id}
          checked={permissao.concedida}
          disabled={salvando}
          onCheckedChange={onAlternar}
        />
      </div>
    </li>
  );
}

export function PermissoesRestritas({ usuarioId }: { usuarioId: string }) {
  const { permissoes, isLoading, isError, error, refetch } = usePermissoesRestritas(usuarioId);
  const alterar = useAlterarPermissaoRestrita(usuarioId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  // Administrador não recebe concessão: o catálogo é por profissional.
  if (permissoes.length === 0) {
    return (
      <p className="text-muted-foreground text-xs leading-relaxed">
        A concessão individual é por profissional. O perfil administrativo não recebe permissão por
        esta via — o alcance dele vem do papel.
      </p>
    );
  }

  const concedidas = permissoes.filter((permissao) => permissao.concedida).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-[64ch] text-xs leading-relaxed">
          Ações que só valem para quem recebe.{" "}
          <strong className="text-foreground font-medium">
            O que não está nesta lista, todo profissional ativo já pode fazer
          </strong>{" "}
          — é uma lista de exceções, não o alcance da pessoa.
        </p>

        <StatusBadge tone={concedidas > 0 ? "success" : "neutral"} size="sm" className="shrink-0">
          <KeyRound size={10} aria-hidden="true" className="mr-1" />
          {concedidas} de {permissoes.length}
        </StatusBadge>
      </div>

      <ul className="divide-border divide-y border-t">
        {permissoes.map((permissao) => (
          <Linha
            key={permissao.codigo}
            permissao={permissao}
            salvando={alterar.isPending}
            onAlternar={(conceder) => alterar.mutate({ codigo: permissao.codigo, conceder })}
          />
        ))}
      </ul>

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Revogar encerra a concessão e mantém a linha, com data e autor — revogar é auditável, e
        nunca ter concedido não deixa rastro nenhum.
      </p>
    </div>
  );
}

export default PermissoesRestritas;
