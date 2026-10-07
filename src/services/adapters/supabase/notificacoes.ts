import { ok, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import {
  PRAZO_PEDIDO_TITULAR_DIAS,
  type NotificacaoItem,
  type PendenciasAdmin,
} from "@/types/notificacao";
import { executar, falhaDe, umDe } from "./_helpers";
import { nomesDePacientes } from "./_patientNames";
import { getSupabaseClient } from "./client";

/**
 * Notifications — the inbox the database fills for each person.
 *
 * Row policies give each account its own rows only, and the only columns it may
 * change are `read_at` and `archived_at`. So reading and marking are plain
 * table calls, with no audited read: a notification names a table and a row,
 * never a patient.
 *
 * The admin's pending queues are counted apart (`getPendenciasAdmin`): the
 * database creates no notification for a data-subject request or for content
 * sent to review, so the count is the only signal there is.
 *
 * Whose each notification is comes apart too (`nomesDosPacientes`): the name
 * is an audited read, so it is not part of the list the bell rereads.
 */

/** How many notifications the inbox shows. Older ones are still in the database. */
const LIMITE = 30;

interface LinhaNotificacao {
  id: string;
  created_at: string;
  read_at: string | null;
  target_table: string | null;
  target_id: string | null;
  patient_id: string | null;
  notification_types: { code: string; label: string } | { code: string; label: string }[] | null;
}

export async function list(params?: { naoLidas?: boolean }): Promise<ListResult<NotificacaoItem>> {
  return executar(async () => {
    let consulta = getSupabaseClient()
      .from("notifications")
      .select(
        "id, created_at, read_at, target_table, target_id, patient_id, notification_types ( code, label )",
      )
      .is("archived_at", null);
    if (params?.naoLidas) consulta = consulta.is("read_at", null);

    const { data, error } = await consulta.order("created_at", { ascending: false }).limit(LIMITE);
    if (error) return falhaDe(error);

    return ok(
      ((data ?? []) as unknown as LinhaNotificacao[]).map((linha) => {
        const tipo = umDe(linha.notification_types);
        return {
          id: linha.id,
          codigo: tipo?.code ?? "",
          titulo: tipo?.label ?? "Notificação",
          criada_em: linha.created_at,
          lida: linha.read_at !== null,
          alvo_tabela: linha.target_table,
          alvo_id: linha.target_id,
          paciente_id: linha.patient_id,
        };
      }),
    );
  });
}

/** Unread and not archived — all of them, not only the ones the inbox lists. */
export async function contarNaoLidas(): Promise<SingleResult<{ total: number }>> {
  return executar(async () => {
    const { count, error } = await getSupabaseClient()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .is("archived_at", null);
    if (error) return falhaDe(error);

    return okOne({ total: count ?? 0 });
  });
}

export async function marcarLida({ id }: { id: string }): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);
    if (error) return falhaDe(error);

    return okOne(null);
  });
}

/**
 * Every unread one of this account that points to one row — an alert taken or
 * resolved, a conversation opened from its own screen. Acting on the item is
 * reading what announced it; the bell should not keep calling it new.
 */
export async function marcarLidasDoAlvo({
  tabela,
  id,
}: {
  tabela: string;
  id: string;
}): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("target_table", tabela)
      .eq("target_id", id)
      .is("read_at", null);
    if (error) return falhaDe(error);

    return okOne(null);
  });
}

/** Every unread one of this account — the row policies keep it to their own. */
export async function marcarTodasLidas(): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null)
      .is("archived_at", null);
    if (error) return falhaDe(error);

    return okOne(null);
  });
}

/**
 * The admin's queues, counted with `head: true`: no rows travel, and nothing
 * here is clinical, so nothing goes to the audit trail.
 */
export async function getPendenciasAdmin(): Promise<SingleResult<PendenciasAdmin>> {
  return executar(async () => {
    const supabase = getSupabaseClient();
    const contar = () =>
      supabase.from("data_subject_requests").select("id", { count: "exact", head: true });
    const limite = new Date(
      Date.now() - PRAZO_PEDIDO_TITULAR_DIAS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [abertos, atrasados, comFalha, emRevisao] = await Promise.all([
      contar().in("status", ["requested", "under_review"]),
      contar().in("status", ["requested", "under_review"]).lt("created_at", limite),
      contar().eq("status", "granted").not("execution_error", "is", null),
      supabase
        .from("content_versions")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_review"),
    ]);

    for (const resposta of [abertos, atrasados, comFalha, emRevisao]) {
      if (resposta.error) return falhaDe(resposta.error);
    }

    return okOne<PendenciasAdmin>({
      pedidos_titular_abertos: abertos.count ?? 0,
      pedidos_titular_atrasados: atrasados.count ?? 0,
      pedidos_titular_com_falha: comFalha.count ?? 0,
      conteudos_em_revisao: emRevisao.count ?? 0,
    });
  });
}

/**
 * Whose each notification is, for the open inbox.
 *
 * `read_patient` per patient, the same read the agenda and the alert queue make,
 * shared with them for a few seconds: each one is a line on the audit trail,
 * which is why the bell asks only when it opens, and keeps the answer.
 */
export async function nomesDosPacientes({
  ids,
}: {
  ids: string[];
}): Promise<SingleResult<Record<string, string>>> {
  return executar(async () => {
    if (ids.length === 0) return okOne({});

    const nomes = await nomesDePacientes(getSupabaseClient(), ids);
    if (!(nomes instanceof Map)) return nomes;

    return okOne(Object.fromEntries(nomes));
  });
}
