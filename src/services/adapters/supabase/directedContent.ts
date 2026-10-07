import type { Especialidade } from "@/lib/enums";
import { ok, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type { DirectedSend, SendableContent } from "@/types/directed-content";
import { executar, falhaDe, TETO_READ, umDe } from "./_helpers";
import { namesById, NO_NAME, professionalNamesQuery, type ProfessionalNameRow } from "./_professionalNames";
import { specialtyIdOf } from "./_specialtyId";
import { getSupabaseClient } from "./client";
import { paraCodigoDeEspecialidade, paraEspecialidade, toContentKind } from "./mapping";

/**
 * Orientations sent straight to one patient, and the library they come from.
 *
 * `send_directed_content` writes the send and notifies the patient — and the
 * caregiver, unless the area is confidential. `read_content_directed_sends`
 * hands the team the sends it may see, with `opened_at`, and records the read.
 * Which sends a confidential area keeps to itself is the database's call:
 * nothing here filters for secrecy.
 *
 * A send names the orientation, not a version: the patient opens whatever
 * version is published today, so that is the title read here.
 */

interface SendRow {
  id: string;
  content_item_id: string;
  origin_specialty_id: string;
  sent_by_professional_id: string;
  sent_at: string;
  opened_at: string | null;
}

interface SpecialtyCodeRow {
  code: string;
}

interface CategoryRow {
  label: string;
  specialties: SpecialtyCodeRow | SpecialtyCodeRow[] | null;
}

interface CidRow {
  code: string;
}

interface VersionRow {
  content_item_id: string;
  title: string;
  media_kind: string;
  estimated_reading_minutes: number | null;
  status: string;
  updated_at: string;
}

interface LibraryRow extends VersionRow {
  content_items: {
    content_categories: CategoryRow | CategoryRow[] | null;
    content_cid10: { cid10: CidRow | CidRow[] | null }[] | null;
  } | null;
}

const VERSION_FIELDS = "content_item_id, title, media_kind, estimated_reading_minutes, status, updated_at";

const PUBLISHED = "published";

/**
 * The version that stands for an orientation: the published one, or else the
 * latest the session can read — an orientation taken off the library still
 * needs a name in the list of what was sent.
 */
function versionByItem(rows: VersionRow[]): Map<string, VersionRow> {
  const byItem = new Map<string, VersionRow>();
  for (const row of rows) {
    const current = byItem.get(row.content_item_id);
    const better =
      !current ||
      (row.status === PUBLISHED && current.status !== PUBLISHED) ||
      (current.status !== PUBLISHED && row.updated_at > current.updated_at);
    if (better) byItem.set(row.content_item_id, row);
  }
  return byItem;
}

export async function listDirectedSends(params: { patientId: string }): Promise<ListResult<DirectedSend>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("read_content_directed_sends", {
      p_patient_id: params.patientId,
      p_limit: TETO_READ,
      p_before: null,
    });
    if (error) return falhaDe(error);

    const sends = (data ?? []) as SendRow[];
    if (sends.length === 0) return ok([]);

    const itemIds = [...new Set(sends.map((row) => row.content_item_id))];
    const professionalIds = [...new Set(sends.map((row) => row.sent_by_professional_id))];

    const [versionsRes, specialtiesRes, professionalsRes] = await Promise.all([
      supabase.from("content_versions").select(VERSION_FIELDS).in("content_item_id", itemIds),
      supabase.from("specialties").select("id, code"),
      professionalNamesQuery(supabase, professionalIds),
    ]);
    if (versionsRes.error) return falhaDe(versionsRes.error);
    if (specialtiesRes.error) return falhaDe(specialtiesRes.error);
    if (professionalsRes.error) return falhaDe(professionalsRes.error);

    const versions = versionByItem((versionsRes.data ?? []) as VersionRow[]);
    const specialtyById = new Map(
      ((specialtiesRes.data ?? []) as { id: string; code: string }[]).map((row) => [
        row.id,
        paraEspecialidade(row.code),
      ]),
    );
    const names = namesById((professionalsRes.data ?? []) as ProfessionalNameRow[]);

    return ok(
      sends.map<DirectedSend>((row) => {
        const version = versions.get(row.content_item_id);
        return {
          id: row.id,
          content_item_id: row.content_item_id,
          title: version?.title ?? null,
          kind: version ? toContentKind(version.media_kind) : null,
          minutes: version?.estimated_reading_minutes ?? null,
          specialty: specialtyById.get(row.origin_specialty_id) ?? null,
          sent_by_name: names.get(row.sent_by_professional_id) ?? NO_NAME,
          sent_at: row.sent_at,
          opened_at: row.opened_at,
          published: version?.status === PUBLISHED,
        };
      }),
    );
  });
}

/**
 * The published orientations filed under one area's categories. The library is
 * the size of one clinic, so the area is picked here rather than through a
 * three-level filter on the join.
 */
export async function listSendableContent(params: {
  specialty: Especialidade;
}): Promise<ListResult<SendableContent>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("content_versions")
      .select(
        `${VERSION_FIELDS},
         content_items (
           content_categories ( label, specialties ( code ) ),
           content_cid10 ( cid10 ( code ) )
         )`,
      )
      .eq("status", PUBLISHED);
    if (error) return falhaDe(error);

    const code = paraCodigoDeEspecialidade(params.specialty);

    return ok(
      ((data ?? []) as unknown as LibraryRow[])
        .map<SendableContent | null>((row) => {
          const item = umDe(row.content_items);
          const category = umDe(item?.content_categories);
          const categoryCode = umDe(category?.specialties)?.code;
          if (categoryCode !== code) return null;

          return {
            content_item_id: row.content_item_id,
            title: row.title,
            kind: toContentKind(row.media_kind),
            minutes: row.estimated_reading_minutes,
            category: category?.label ?? "Sem categoria",
            specialty: paraEspecialidade(categoryCode),
            cids: (item?.content_cid10 ?? [])
              .map((link) => umDe(link.cid10)?.code)
              .filter((cid): cid is string => Boolean(cid)),
          };
        })
        .filter((content): content is SendableContent => content !== null)
        .sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
    );
  });
}

export async function sendDirectedContent(params: {
  patientId: string;
  contentItemId: string;
  specialty: Especialidade;
}): Promise<SingleResult<{ send_id: string }>> {
  return executar(async () => {
    const specialty = await specialtyIdOf(params.specialty);
    if ("error" in specialty) return specialty;

    const { data, error } = await getSupabaseClient().rpc("send_directed_content", {
      p_patient_id: params.patientId,
      p_content_item_id: params.contentItemId,
      p_origin_specialty_id: specialty.id,
    });
    if (error) return falhaDe(error);

    return okOne({ send_id: data as string });
  });
}
