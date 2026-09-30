import type { Especialidade } from "@/lib/enums";
import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type { ConversationAssignment, TransferTarget } from "@/types/conversation-transfer";
import { executar, falhaDe, profissionalDaSessao } from "./_helpers";
import { namesById, professionalNamesQuery, type ProfessionalNameRow } from "./_professionalNames";
import { getSupabaseClient } from "./client";
import { paraEspecialidade } from "./mapping";

/**
 * Handing a conversation to a colleague.
 *
 * `transfer_conversation` does the whole handover in one transaction: closes the
 * current assignment, opens the new one, moves the conversation to the
 * destination's area and writes the message that tells the patient. The panel
 * chooses who and shows the result — it writes none of those four things.
 */

interface ProfessionalRow {
  id: string;
  accounts: { full_name: string | null; is_active: boolean } | { full_name: string | null; is_active: boolean }[] | null;
}

interface ProfessionalSpecialtyRow {
  professional_id: string;
  specialty_id: string;
  ended_at: string | null;
}

interface SpecialtyRow {
  id: string;
  code: string;
}

interface AssignmentRow {
  id: string;
  professional_id: string;
  specialty_id: string;
  assigned_at: string;
  released_at: string | null;
}

/** A specialty record still counts until its end date passes. */
function isCurrent(row: ProfessionalSpecialtyRow, now: number): boolean {
  return row.ended_at === null || new Date(row.ended_at).getTime() > now;
}

export async function listTransferTargets(): Promise<ListResult<TransferTarget>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const me = await profissionalDaSessao();
    if ("error" in me) return me;

    const [professionalsRes, linksRes, specialtiesRes] = await Promise.all([
      supabase.from("professionals").select("id, accounts ( full_name, is_active )").eq("is_active", true),
      supabase.from("professional_specialties").select("professional_id, specialty_id, ended_at"),
      supabase.from("specialties").select("id, code"),
    ]);
    for (const source of [professionalsRes, linksRes, specialtiesRes]) {
      if (source.error) return falhaDe(source.error);
    }

    const codeById = new Map(((specialtiesRes.data ?? []) as SpecialtyRow[]).map((row) => [row.id, row.code]));
    const links = (linksRes.data ?? []) as ProfessionalSpecialtyRow[];
    const now = Date.now();

    const targets: TransferTarget[] = [];

    for (const professional of (professionalsRes.data ?? []) as ProfessionalRow[]) {
      if (professional.id === me.profissionalId) continue;

      const account = Array.isArray(professional.accounts) ? professional.accounts[0] : professional.accounts;
      // The database refuses an inactive account too, so it is not offered.
      if (!account?.is_active) continue;

      const own = links.filter((link) => link.professional_id === professional.id);
      // No specialty record at all: the database refuses ("sem especialidade").
      if (own.length === 0) continue;

      const current = new Set<Especialidade>();
      for (const link of own.filter((row) => isCurrent(row, now))) {
        const specialty = paraEspecialidade(codeById.get(link.specialty_id));
        if (specialty) current.add(specialty);
      }

      const left = own
        .filter((row) => !isCurrent(row, now))
        .map((row) => paraEspecialidade(codeById.get(row.specialty_id)))
        .filter((specialty): specialty is Especialidade => specialty !== null);

      targets.push({
        professional_id: professional.id,
        name: account.full_name?.trim() || "Profissional",
        specialties: [...current],
        changed_area: left.some((specialty) => !current.has(specialty)),
      });
    }

    return ok(targets.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
  });
}

/**
 * `transfer_conversation` answers `insufficient_privilege` for four reasons the
 * person can act on differently — not in the conversation's area, conversation
 * closed, colleague inactive, colleague without an area — and gives no way to
 * tell them apart. The sentence lists them instead of pointing at one.
 */
export async function transferConversation(params: {
  conversationId: string;
  toProfessionalId: string;
}): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("transfer_conversation", {
      p_conversation_id: params.conversationId,
      p_to_professional_id: params.toProfessionalId,
    });

    if (error) {
      if (error.code === "42501") {
        return fail(
          ERROR_CODE.FORBIDDEN,
          "Não foi possível encaminhar: a conversa precisa estar aberta e na sua área, e o colega precisa estar ativo e ter uma área de atuação.",
          { code: error.code, message: error.message },
        );
      }
      return falhaDe(error);
    }

    return okOne(null);
  });
}

export async function listConversationAssignments(params: {
  conversationId: string;
}): Promise<ListResult<ConversationAssignment>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("read_conversation_assignments", {
      p_conversation_id: params.conversationId,
    });
    if (error) return falhaDe(error);

    const rows = (data ?? []) as AssignmentRow[];
    if (rows.length === 0) return ok([]);

    const professionalIds = [...new Set(rows.map((row) => row.professional_id))];

    const [namesRes, specialtiesRes] = await Promise.all([
      professionalNamesQuery(supabase, professionalIds),
      supabase.from("specialties").select("id, code"),
    ]);
    if (namesRes.error) return falhaDe(namesRes.error);
    if (specialtiesRes.error) return falhaDe(specialtiesRes.error);

    const names = namesById((namesRes.data ?? []) as ProfessionalNameRow[]);
    const codeById = new Map(((specialtiesRes.data ?? []) as SpecialtyRow[]).map((row) => [row.id, row.code]));

    return ok(
      rows.map<ConversationAssignment>((row) => ({
        id: row.id,
        professional_id: row.professional_id,
        professional_name: names.get(row.professional_id) ?? "Profissional",
        specialty: paraEspecialidade(codeById.get(row.specialty_id)),
        assigned_at: row.assigned_at,
        released_at: row.released_at,
      })),
    );
  });
}
