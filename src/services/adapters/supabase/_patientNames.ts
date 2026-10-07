import { compartilharLeitura, falhaDe, umDe } from "./_helpers";
import type { getSupabaseClient } from "./client";

/**
 * Nomes de pacientes por id, para as telas que listam pessoas sem abrir a ficha:
 * a agenda, a fila de alertas, o chat e o sino.
 */

type SupabaseClientLike = ReturnType<typeof getSupabaseClient>;

/** Quanto tempo uma segunda consulta da mesma tela ainda aproveita o nome já lido. */
const NOME_DE_PACIENTE_VALIDADE_MS = 30_000;

/** `read_patient` por id distinto — N é sempre pequeno (uma janela, uma fila). */
export async function nomesDePacientes(
  supabase: SupabaseClientLike,
  ids: string[],
): Promise<Map<string, string> | ReturnType<typeof falhaDe>> {
  const nomes = new Map<string, string>();

  /*
   * `read_patient` grava uma leitura na trilha por paciente, e a agenda e a fila
   * de alertas da mesma tela pedem os mesmos pacientes. A segunda leitura pega
   * carona na primeira (ver `compartilharLeitura`): um gesto, uma leitura.
   */
  const resultados = await Promise.all(
    ids.map((id) =>
      compartilharLeitura(
        `read_patient:${id}`,
        NOME_DE_PACIENTE_VALIDADE_MS,
        async () => supabase.rpc("read_patient", { p_patient_id: id }),
        (resposta) => !resposta.error,
      ),
    ),
  );

  for (const resultado of resultados) {
    if (resultado.error) return falhaDe(resultado.error);
    const linha = umDe(resultado.data as { id: string; full_name: string }[] | null);
    if (linha) nomes.set(linha.id, linha.full_name);
  }

  return nomes;
}
