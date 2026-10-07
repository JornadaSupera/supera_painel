import { useQueryClient } from "@tanstack/react-query";
import { createElement, useEffect, useRef } from "react";
import { toast } from "sonner";

import { lerNaoLidas } from "@/hooks/useNotificacoes";
import { setTitleCount } from "@/lib/documentTitle";
import type { Especialidade } from "@/lib/enums";
import { pluralize } from "@/lib/format";
import type { NotificacaoItem, PendenciasAdmin } from "@/types/notificacao";
import {
  cachedPatientName,
  iconOf,
  useOpenNotification,
  useOpenPending,
  type PendingTarget,
} from "./notification-targets";

/**
 * Says that something arrived, on whatever screen the person is.
 *
 * The bell's counts poll every minute, even with the tab hidden. When the
 * unread count goes up, the newest unread are read (a plain read of the
 * person's own rows) and the ones not announced yet become one toast: the
 * type's title and "Abrir" for one, "N notificações novas" and "Ver" for many.
 * The admin's queues have no rows, only counts, so a count going up is
 * announced as such.
 *
 * Nothing on the first load: what was already waiting is the bell's job. With
 * the tab hidden, what arrives is held and announced once when the person
 * comes back — a toast nobody sees is a toast lost.
 *
 * What was announced is kept in memory only, as notification ids: nothing
 * about a patient is stored in the browser. A patient's name goes in the toast
 * only when a screen already read it.
 */

/** Long enough to be read after looking up from something else. */
const DURACAO_MS = 15_000;
/** A critical alert stays longer: it is the one thing the bell exists for. */
const DURACAO_CRITICO_MS = 30_000;

type Pending = Record<PendingTarget, number>;

const NO_PENDING: Pending = { requests: 0, failedRequests: 0, review: 0 };

/**
 * Per tab, across remounts of the top bar. Reset when another account signs in
 * on the same tab, so its first load is a first load too.
 */
const memory = {
  account: null as string | null,
  announced: new Set<string>(),
  lastUnread: null as number | null,
  lastPending: null as Pending | null,
  heldItems: [] as NotificacaoItem[],
  heldPending: { ...NO_PENDING },
};

function resetFor(account: string | null) {
  memory.account = account;
  memory.announced = new Set();
  memory.lastUnread = null;
  memory.lastPending = null;
  memory.heldItems = [];
  memory.heldPending = { ...NO_PENDING };
}

const PENDING_MESSAGE: Record<PendingTarget, (n: number) => string> = {
  requests: (n) =>
    n === 1 ? "Chegou um pedido do titular" : `Chegaram ${n} pedidos do titular`,
  failedRequests: (n) =>
    pluralize(n, "pedido do titular com execução que falhou", "pedidos do titular com execução que falhou"),
  review: (n) =>
    n === 1 ? "Chegou um conteúdo para revisão" : `Chegaram ${n} conteúdos para revisão`,
};

function pendingOf(p: PendenciasAdmin): Pending {
  return {
    requests: p.pedidos_titular_abertos,
    failedRequests: p.pedidos_titular_com_falha,
    review: p.conteudos_em_revisao,
  };
}

export function useNotificationToasts({
  account,
  unread,
  pending,
  canReview,
  especialidade,
  onOpenInbox,
}: {
  account: string | null;
  /** The unread count, `undefined` until the first answer. */
  unread: number | undefined;
  /** The admin's queues, `undefined` for everyone else or until they answer. */
  pending: PendenciasAdmin | undefined;
  canReview: boolean;
  especialidade: Especialidade | null;
  onOpenInbox: () => void;
}) {
  const queryClient = useQueryClient();
  const openNotification = useOpenNotification(especialidade);
  const openPending = useOpenPending();

  // The latest callbacks, for toasts and listeners created in earlier renders.
  const actions = useRef({ openNotification, openPending, onOpenInbox });
  actions.current = { openNotification, openPending, onOpenInbox };

  if (memory.account !== account) resetFor(account);

  /* ------------------------------------------------------------ the toasts */

  const announceItems = useRef((items: NotificacaoItem[]) => {
    if (items.length === 0) return;
    if (document.visibilityState === "hidden") {
      memory.heldItems.push(...items);
      return;
    }

    if (items.length === 1) {
      const [item] = items as [NotificacaoItem];
      const nome = item.paciente_id ? cachedPatientName(queryClient, item.paciente_id) : null;
      const critico = item.codigo === "critical_alert";
      (critico ? toast.warning : toast)(item.titulo, {
        id: `notification:${item.id}`,
        description: nome ?? undefined,
        icon: createElement(iconOf(item), { size: 16, "aria-hidden": true }),
        duration: critico ? DURACAO_CRITICO_MS : DURACAO_MS,
        action: { label: "Abrir", onClick: () => actions.current.openNotification(item) },
      });
      return;
    }

    const tipos = [...new Set(items.map((item) => item.titulo))];
    const algumCritico = items.some((item) => item.codigo === "critical_alert");
    (algumCritico ? toast.warning : toast)(`${items.length} notificações novas`, {
      id: `notifications:${items.map((item) => item.id).join(",")}`,
      description: tipos.join(" · "),
      duration: algumCritico ? DURACAO_CRITICO_MS : DURACAO_MS,
      action: { label: "Ver", onClick: () => actions.current.onOpenInbox() },
    });
  }).current;

  const announcePending = useRef((rises: Pending) => {
    if (document.visibilityState === "hidden") {
      for (const target of Object.keys(rises) as PendingTarget[]) {
        memory.heldPending[target] += rises[target];
      }
      return;
    }

    for (const target of Object.keys(rises) as PendingTarget[]) {
      const n = rises[target];
      if (n <= 0) continue;
      (target === "failedRequests" ? toast.warning : toast)(PENDING_MESSAGE[target](n), {
        id: `pending:${target}:${Date.now()}`,
        duration: DURACAO_MS,
        action: { label: "Abrir", onClick: () => actions.current.openPending(target) },
      });
    }
  }).current;

  /* ---------------------------------------------------------- unread rows */

  useEffect(() => {
    if (unread === undefined) return;
    const anterior = memory.lastUnread;
    memory.lastUnread = unread;

    // First answer for this account: what is already there is not news. The
    // ids are kept so a later rise does not announce them as new.
    if (anterior === null) {
      if (unread === 0) return;
      void lerNaoLidas(queryClient)
        .then((items) => {
          for (const item of items ?? []) memory.announced.add(item.id);
        })
        .catch(() => undefined);
      return;
    }

    if (unread <= anterior) return;

    void lerNaoLidas(queryClient)
      .then((items) => {
        const novos = (items ?? []).filter((item) => !memory.announced.has(item.id));
        for (const item of novos) memory.announced.add(item.id);
        announceItems(novos);
      })
      // The count already went up and the bell shows it; a failed read only
      // costs the toast.
      .catch(() => undefined);
  }, [unread, queryClient, announceItems]);

  /* ------------------------------------------------------ the admin queues */

  // The raw counts are compared; whether content review is announced is decided
  // apart, so a permission settling late is never read as content arriving.
  useEffect(() => {
    if (!pending) return;
    const atual = pendingOf(pending);
    const anterior = memory.lastPending;
    memory.lastPending = atual;
    if (anterior === null) return;

    announcePending({
      requests: Math.max(0, atual.requests - anterior.requests),
      failedRequests: Math.max(0, atual.failedRequests - anterior.failedRequests),
      review: canReview ? Math.max(0, atual.review - anterior.review) : 0,
    });
  }, [pending, canReview, announcePending]);

  /* ------------------------------------------------- back to a hidden tab */

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const items = memory.heldItems;
      const rises = memory.heldPending;
      memory.heldItems = [];
      memory.heldPending = { ...NO_PENDING };
      announceItems(items);
      announcePending(rises);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [announceItems, announcePending]);

  /* -------------------------------------------------------------- the tab */

  const total =
    (unread ?? 0) +
    (pending ? pending.pedidos_titular_abertos + pending.pedidos_titular_com_falha : 0) +
    (pending && canReview ? pending.conteudos_em_revisao : 0);

  useEffect(() => {
    setTitleCount(total);
  }, [total]);

  useEffect(() => () => setTitleCount(0), []);
}
