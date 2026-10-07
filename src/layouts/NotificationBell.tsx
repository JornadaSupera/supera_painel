import {
  Bell,
  CheckCheck,
  FileText,
  MessageCircle,
  Scale,
  SquarePen,
  TriangleAlert,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useMarcarNotificacaoLida,
  useMarcarTodasLidas,
  useNaoLidas,
  useNomesDasNotificacoes,
  useNotificacoes,
  usePendenciasAdmin,
} from "@/hooks/useNotificacoes";
import type { Especialidade } from "@/lib/enums";
import { pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PRAZO_PEDIDO_TITULAR_DIAS, type NotificacaoItem } from "@/types/notificacao";

/**
 * The bell in the top bar: what is waiting for the signed-in person.
 *
 * Two sources. The inbox the database fills — a critical alert, an alert or a
 * conversation handed to you, a scheduled report ready — read and marked by each
 * account for itself. And, for the administration, the queues no notification
 * announces: data-subject requests to decide and content waiting for review.
 * The number on the bell is the sum of both.
 *
 * Each notification about a patient says whose it is: "Alerta de sintoma
 * crítico" alone does not tell anyone what to open first. The names are read
 * only when the bell opens, one audited read per patient, and kept for minutes.
 */

function iconeDe(item: NotificacaoItem) {
  if (item.alvo_tabela === "alerts") return TriangleAlert;
  if (item.alvo_tabela === "conversations") return MessageCircle;
  if (item.alvo_tabela === "report_runs") return FileText;
  return Bell;
}

/** Where the click goes. `null` when the panel has no screen for it. */
function destinoDe(item: NotificacaoItem, especialidade: Especialidade | null): string | null {
  const base = especialidade ? `/clinico/${especialidade}` : null;
  if (item.alvo_tabela === "alerts") return base ? `${base}/alertas` : null;
  if (item.alvo_tabela === "conversations") {
    if (!base) return null;
    return item.paciente_id ? `${base}/chat?paciente=${item.paciente_id}` : `${base}/chat`;
  }
  if (item.alvo_tabela === "report_runs") return "/relatorios";
  return null;
}

function LinhaPendencia({
  to,
  icone,
  children,
  onNavigate,
}: {
  to: string;
  icone: ReactNode;
  children: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        to={to}
        onClick={onNavigate}
        className="hover:bg-muted/60 focus-visible:ring-ring flex items-start gap-2.5 px-4 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        <span aria-hidden="true" className="text-primary-ink mt-0.5 shrink-0">
          {icone}
        </span>
        <span className="min-w-0">{children}</span>
      </Link>
    </li>
  );
}

export function NotificationBell({
  admin,
  podeAprovarConteudo,
  especialidade,
}: {
  admin: boolean;
  podeAprovarConteudo: boolean;
  especialidade: Especialidade | null;
}) {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);

  const naoLidas = useNaoLidas();
  const pendencias = usePendenciasAdmin(admin);
  const lista = useNotificacoes(aberto);
  const idsPacientes = [
    ...new Set(
      (lista.data ?? []).map((item) => item.paciente_id).filter((id): id is string => Boolean(id)),
    ),
  ].sort();
  const nomes = useNomesDasNotificacoes(idsPacientes, aberto);
  const marcarLida = useMarcarNotificacaoLida();
  const marcarTodas = useMarcarTodasLidas();

  const p = pendencias.data;
  const pendentes =
    admin && p
      ? p.pedidos_titular_abertos +
        p.pedidos_titular_com_falha +
        (podeAprovarConteudo ? p.conteudos_em_revisao : 0)
      : 0;
  const naoLidasTotal = naoLidas.data?.total ?? 0;
  const total = naoLidasTotal + pendentes;

  const fechar = () => setAberto(false);

  const abrir = (item: NotificacaoItem) => {
    if (!item.lida) marcarLida.mutate(item.id);
    const destino = destinoDe(item, especialidade);
    if (destino) {
      fechar();
      navigate(destino);
    }
  };

  const rotulo =
    total === 0
      ? "Notificações: nada novo"
      : `Notificações: ${[
          naoLidasTotal > 0 && pluralize(naoLidasTotal, "não lida", "não lidas"),
          pendentes > 0 && pluralize(pendentes, "pendência", "pendências"),
        ]
          .filter(Boolean)
          .join(" e ")}`;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={rotulo} className="relative">
          <Bell />
          {total > 0 && (
            <span
              aria-hidden="true"
              className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums"
            >
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          {naoLidasTotal > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-ink h-7 gap-1 px-2 text-xs"
              disabled={marcarTodas.isPending}
              onClick={() => marcarTodas.mutate()}
            >
              <CheckCheck size={14} aria-hidden="true" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {admin && (
            <section aria-label="Pendências da administração" className="border-b">
              <p className="text-muted-foreground px-4 pt-3 pb-1 text-[11px] font-medium tracking-wider uppercase">
                Pendências
              </p>
              {pendencias.isError ? (
                <p className="text-muted-foreground px-4 pb-3 text-xs">
                  Não foi possível contar as pendências agora.
                </p>
              ) : pendentes === 0 ? (
                <p className="text-muted-foreground px-4 pb-3 text-xs">
                  {pendencias.isLoading ? "Contando…" : "Nada pendente na administração."}
                </p>
              ) : (
                <ul className="pb-1">
                  {p && p.pedidos_titular_abertos > 0 && (
                    <LinhaPendencia
                      to="/configuracoes?aba=lgpd"
                      icone={<Scale size={16} />}
                      onNavigate={fechar}
                    >
                      {pluralize(
                        p.pedidos_titular_abertos,
                        "pedido do titular aguardando decisão",
                        "pedidos do titular aguardando decisão",
                      )}
                      {p.pedidos_titular_atrasados > 0 && (
                        <span className="text-destructive block text-xs font-medium">
                          {pluralize(p.pedidos_titular_atrasados, "aberto", "abertos")} há mais de{" "}
                          {PRAZO_PEDIDO_TITULAR_DIAS} dias
                        </span>
                      )}
                    </LinhaPendencia>
                  )}
                  {p && p.pedidos_titular_com_falha > 0 && (
                    <LinhaPendencia
                      to="/configuracoes?aba=lgpd"
                      icone={<Scale size={16} />}
                      onNavigate={fechar}
                    >
                      {pluralize(
                        p.pedidos_titular_com_falha,
                        "pedido do titular com execução que falhou",
                        "pedidos do titular com execução que falhou",
                      )}
                    </LinhaPendencia>
                  )}
                  {p && podeAprovarConteudo && p.conteudos_em_revisao > 0 && (
                    <LinhaPendencia
                      to="/conteudo"
                      icone={<SquarePen size={16} />}
                      onNavigate={fechar}
                    >
                      {pluralize(
                        p.conteudos_em_revisao,
                        "conteúdo aguardando revisão",
                        "conteúdos aguardando revisão",
                      )}
                    </LinhaPendencia>
                  )}
                </ul>
              )}
            </section>
          )}

          <section aria-label="Notificações recebidas">
            {admin && (
              <p className="text-muted-foreground px-4 pt-3 pb-1 text-[11px] font-medium tracking-wider uppercase">
                Recebidas
              </p>
            )}
            {lista.isLoading ? (
              <p className="text-muted-foreground px-4 py-3 text-xs">Carregando…</p>
            ) : lista.isError ? (
              <p className="text-muted-foreground px-4 py-3 text-xs">
                Não foi possível ler as notificações agora.
              </p>
            ) : (lista.data ?? []).length === 0 ? (
              <p className="text-muted-foreground px-4 py-3 text-xs">Nenhuma notificação.</p>
            ) : (
              <ul className="divide-y">
                {(lista.data ?? []).map((item) => {
                  const Icone = iconeDe(item);
                  const paciente = item.paciente_id ? nomes.data?.[item.paciente_id] : undefined;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => abrir(item)}
                        className={cn(
                          "hover:bg-muted/60 focus-visible:ring-ring flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                          !item.lida && "bg-primary/5",
                        )}
                      >
                        <Icone
                          size={16}
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 shrink-0",
                            item.lida ? "text-muted-foreground" : "text-primary-ink",
                          )}
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className={cn("text-sm", !item.lida && "font-semibold")}>
                            {item.titulo}
                          </span>
                          {paciente && <span className="text-foreground text-xs">{paciente}</span>}
                          <span className="text-muted-foreground text-xs">
                            {relativeTime(item.criada_em)}
                            {!item.lida && <span className="sr-only">, não lida</span>}
                          </span>
                        </span>
                        {!item.lida && (
                          <span
                            aria-hidden="true"
                            className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
