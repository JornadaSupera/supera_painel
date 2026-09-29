import type { StatusTone } from "@/components/shared";
import { ok, type ListResult } from "@/services/contracts";
import type { CompromissoAgenda } from "@/types/clinico";
import { executar, falhaDe, umDe } from "./_helpers";
import { getSupabaseClient } from "./client";

/**
 * Painel clínico — leitura recortada pelo profissional da sessão.
 *
 * `read_my_agenda` já devolve só os compromissos do professional_id logado
 * (resolvido no banco, via `private.my_professional_id()`) — nenhum filtro de
 * "quem sou eu" precisa ser passado ou é possível de forjar daqui.
 *
 * A função devolve a linha crua de `appointments`: sem nome de paciente, sem
 * rótulo de tipo ou status. As três hidratações abaixo são chamadas à parte —
 * `read_patient` por paciente distinto no recorte (a janela é um dia ou uma
 * semana; N é pequeno) e uma leitura direta dos dois catálogos, que são
 * SELECT-only para qualquer `authenticated` (mesmo padrão de
 * `appointment_types`/`appointment_statuses` já usado em Configurações).
 */

interface LinhaAppointment {
  id: string;
  patient_id: string;
  appointment_type_id: string | null;
  status_id: string | null;
  starts_at: string;
  ends_at: string;
  location_label: string | null;
  confirmed_at: string | null;
}

const TOM_POR_CODIGO_STATUS: Record<string, StatusTone> = {
  scheduled: "info",
  completed: "success",
  no_show: "warning",
  cancelled: "neutral",
  rescheduled: "neutral",
};

export async function getMinhaAgenda(params: {
  de: string;
  ate: string;
}): Promise<ListResult<CompromissoAgenda>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("read_my_agenda", {
      p_from: params.de,
      p_to: params.ate,
    });
    if (error) return falhaDe(error);

    const linhas = (data ?? []) as LinhaAppointment[];
    if (linhas.length === 0) return ok([]);

    const idsPacientes = [...new Set(linhas.map((linha) => linha.patient_id))];
    const idsTipos = [
      ...new Set(linhas.map((linha) => linha.appointment_type_id).filter((id): id is string => Boolean(id))),
    ];
    const idsStatus = [
      ...new Set(linhas.map((linha) => linha.status_id).filter((id): id is string => Boolean(id))),
    ];

    const [pacientesRes, tiposRes, statusRes] = await Promise.all([
      Promise.all(idsPacientes.map((id) => supabase.rpc("read_patient", { p_patient_id: id }))),
      idsTipos.length
        ? supabase.from("appointment_types").select("id, label").in("id", idsTipos)
        : Promise.resolve({ data: [] as { id: string; label: string }[], error: null }),
      idsStatus.length
        ? supabase.from("appointment_statuses").select("id, code, label").in("id", idsStatus)
        : Promise.resolve({ data: [] as { id: string; code: string; label: string }[], error: null }),
    ]);

    const nomePorPaciente = new Map<string, string>();
    for (const resultado of pacientesRes) {
      if (resultado.error) return falhaDe(resultado.error);
      const linha = umDe(resultado.data as { id: string; full_name: string }[] | null);
      if (linha) nomePorPaciente.set(linha.id, linha.full_name);
    }

    if (tiposRes.error) return falhaDe(tiposRes.error);
    if (statusRes.error) return falhaDe(statusRes.error);

    const labelPorTipo = new Map((tiposRes.data ?? []).map((tipo) => [tipo.id, tipo.label]));
    const statusPorId = new Map((statusRes.data ?? []).map((status) => [status.id, status]));

    const compromissos: CompromissoAgenda[] = linhas.map((linha) => {
      const status = linha.status_id ? statusPorId.get(linha.status_id) : undefined;

      return {
        id: linha.id,
        paciente_id: linha.patient_id,
        paciente_nome: nomePorPaciente.get(linha.patient_id) ?? "Paciente",
        tipo_label: (linha.appointment_type_id && labelPorTipo.get(linha.appointment_type_id)) || "Compromisso",
        status_label: status?.label ?? "—",
        status_tom: (status && TOM_POR_CODIGO_STATUS[status.code]) || "neutral",
        inicio: linha.starts_at,
        fim: linha.ends_at,
        local: linha.location_label,
        confirmado_em: linha.confirmed_at,
      };
    });

    return ok(compromissos);
  });
}
