import { Check, PenLine, X } from "lucide-react";

import { StatusBadge, UserAvatar } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { flashClass } from "@/hooks/useFlashTarget";
import { ACAO_REVISAO, TIPO_CONTEUDO_LABEL, type AcaoRevisao } from "@/lib/enums";
import { relativeTime } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { ConteudoListItem } from "@/types/conteudo";

/**
 * Um item da fila "Aguardando revisão".
 *
 * Layout do protótipo: título com o tipo de mídia e o número da versão ao lado,
 * o resumo abaixo, a autoria numa linha com avatar, área e tempo de espera, e
 * as três ações à direita.
 *
 * > [!] Orientação de Psicologia também é revisada aqui
 * Só a administração decide a publicação (`review_content_version` recusa
 * qualquer outra conta), e o Mapa põe "revisão pelo administrador antes da
 * publicação" para toda orientação. Esconder o texto de Psicologia dela deixava
 * a orientação sem ninguém que pudesse aprová-la, devolvê-la ou recusá-la.
 *
 * O sigilo profissional da Psicologia protege o que é DITO em atendimento: as
 * anotações, as conversas e os compromissos, que o banco esconde por regra. Uma
 * orientação é material educativo que, aprovado, chega a todos os pacientes
 * elegíveis; o rascunho dela não é conteúdo de sessão.
 */

export interface CartaoRevisaoProps {
  conteudo: ConteudoListItem;
  onDecidir: (conteudo: ConteudoListItem, acao: AcaoRevisao) => void;
  onAbrir: (conteudo: ConteudoListItem) => void;
  /** Trava as ações do cartão enquanto uma decisão está sendo enviada. */
  ocupado?: boolean;
  /** Marked for a moment: the item the bell's link pointed to. */
  realcado?: boolean;
}

export function CartaoRevisao({ conteudo, onDecidir, onAbrir, ocupado, realcado = false }: CartaoRevisaoProps) {
  const { can } = useAuth();

  const podeDecidir = can(PERMISSAO.CONTEUDO_APPROVE);

  return (
    <article
      // The DOM id the bell's link scrolls to — see `ConteudoPage`.
      id={`revisao-${conteudo.id}`}
      className={cn(
        "bg-card flex scroll-mt-20 flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-start md:justify-between md:gap-6",
        flashClass(realcado),
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onAbrir(conteudo)}
            className="text-foreground hover:text-primary-ink truncate text-sm font-medium"
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

        <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs leading-relaxed">
          {conteudo.resumo}
        </p>

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
