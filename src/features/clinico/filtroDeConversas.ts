import type { Especialidade } from "@/lib/enums";
import type { ConversaClinico } from "@/types/clinico";

/**
 * Busca e filtros da lista de conversas — feitos SOBRE A LISTA JÁ CARREGADA.
 *
 * Não há consulta nova: a lista vem de uma leitura que entrega até
 * `LIMITE_DA_LEITURA` conversas, e estes filtros só escolhem entre elas. Quando a
 * leitura bateu no teto, a tela avisa que está filtrando o que chegou, e não a
 * clínica inteira.
 *
 * "Minhas" são as que a pessoa assumiu; "da minha área", as roteadas à sua
 * especialidade, assumidas ou não.
 */

/** Quantas conversas a leitura da fila entrega, no máximo. */
export const LIMITE_DA_LEITURA = 200;

export type RecorteDeConversas = "todas" | "minhas" | "nao_resolvidas" | "da_minha_area";

export const TODOS_OS_ASSUNTOS = "todos";

export interface FiltroDeConversas {
  busca: string;
  recorte: RecorteDeConversas;
  /** O rótulo do assunto, ou `TODOS_OS_ASSUNTOS`. */
  assunto: string;
  /** Only this patient's conversations — set when the chat is opened from the record. */
  paciente: string | null;
}

/** Sem acento e sem caixa: quem digita "joao" acha "João". */
function semAcentos(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function filtrarConversas(
  conversas: ConversaClinico[],
  filtro: FiltroDeConversas,
  minhaArea: Especialidade | null,
): ConversaClinico[] {
  const busca = semAcentos(filtro.busca.trim());

  return conversas.filter((conversa) => {
    if (filtro.paciente && conversa.paciente_id !== filtro.paciente) return false;
    if (filtro.recorte === "minhas" && !conversa.minha) return false;
    if (filtro.recorte === "nao_resolvidas" && conversa.status !== "aberta") return false;
    if (
      filtro.recorte === "da_minha_area" &&
      (minhaArea === null || conversa.especialidade_origem !== minhaArea)
    ) {
      return false;
    }
    if (filtro.assunto !== TODOS_OS_ASSUNTOS && conversa.assunto_label !== filtro.assunto) return false;
    if (busca && !semAcentos(conversa.paciente_nome).includes(busca)) return false;

    return true;
  });
}

/** Os assuntos que aparecem na lista, sem repetir, em ordem alfabética. */
export function assuntosDaLista(conversas: ConversaClinico[]): string[] {
  return [...new Set(conversas.map((conversa) => conversa.assunto_label))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}
