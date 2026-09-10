import { Check, EyeOff, PenLine, X } from "lucide-react";

import { StatusBadge, UserAvatar } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { ACAO_REVISAO, TIPO_CONTEUDO_LABEL, type AcaoRevisao } from "@/lib/enums";
import { relativeTime } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import type { ConteudoListItem } from "@/types/conteudo";

/**
 * Um item da fila "Aguardando revisão".
 *
 * Layout do protótipo: título com o tipo de mídia e o número da versão ao lado,
 * o resumo abaixo, a autoria numa linha com avatar, área e tempo de espera, e
 * as três ações à direita.
 *
 * > [!] Sigilo profissional
 * Conteúdo de Psicologia não mostra o texto a quem não tem
 * `sigilo:psicologia` — e o administrador NÃO herda esse sigilo pelo papel. O
 * que continua visível é o título, a autoria e o tempo de espera: sem eles não
 * há fila, e o que o sigilo protege é o conteúdo, não a existência do item.
 * Quem não pode ler também não pode decidir — as ações somem junto.
 */

export interface CartaoRevisaoProps {
  conteudo: ConteudoListItem;
  onDecidir: (conteudo: ConteudoListItem, acao: AcaoRevisao) => void;
  onAbrir: (conteudo: ConteudoListItem) => void;
  /** Trava as ações do cartão enquanto uma decisão está sendo enviada. */
  ocupado?: boolean;
}

export function CartaoRevisao({ conteudo, onDecidir, onAbrir, ocupado }: CartaoRevisaoProps) {
  const { can } = useAuth();

  const podeLer = !conteudo.confidencial || can(PERMISSAO.SIGILO_PSICOLOGIA);
  const podeDecidir = can(PERMISSAO.CONTEUDO_APPROVE) && podeLer;

  return (
    <article className="bg-card flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onAbrir(conteudo)}
            disabled={!podeLer}
            className="text-foreground hover:text-primary truncate text-sm font-medium disabled:cursor-not-allowed disabled:hover:text-current"
          >
            {conteudo.titulo}
          </button>

          <StatusBadge tone="neutral" size="sm">
            {TIPO_CONTEUDO_LABEL[conteudo.tipo].toLowerCase()}
          </StatusBadge>

          <span className="text-muted-foreground text-[11px] tabular-nums">
            versão {conteudo.versao}
          </span>
        </div>

        {podeLer ? (
          <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs leading-relaxed">
            {conteudo.resumo}
          </p>
        ) : (
          <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs">
            <EyeOff size={13} aria-hidden="true" />
            Conteúdo de Psicologia — sob sigilo profissional. A revisão é de quem atua na área.
          </p>
        )}

        <div className="text-muted-foreground mt-3 flex items-center gap-2 text-[11px]">
          <UserAvatar name={conteudo.autor_nome} size="xs" colorful />
          <span className="text-foreground font-medium">{conteudo.autor_nome}</span>
          <span aria-hidden="true">·</span>
          <span>{conteudo.categoria}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={conteudo.atualizado_em}>{relativeTime(conteudo.atualizado_em)}</time>
        </div>
      </div>

      {podeDecidir && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button size="sm" disabled={ocupado} onClick={() => onDecidir(conteudo, ACAO_REVISAO.APROVAR)}>
            <Check />
            Aprovar
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={ocupado}
            onClick={() => onDecidir(conteudo, ACAO_REVISAO.DEVOLVER)}
          >
            <PenLine />
            Revisar texto
          </Button>

          <Button
            size="sm"
            variant="ghost"
            disabled={ocupado}
            className="text-destructive hover:text-destructive"
            onClick={() => onDecidir(conteudo, ACAO_REVISAO.REJEITAR)}
          >
            <X />
            Rejeitar
          </Button>
        </div>
      )}
    </article>
  );
}

export default CartaoRevisao;
