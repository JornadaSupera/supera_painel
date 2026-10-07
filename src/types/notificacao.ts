/**
 * The signed-in person's notifications, and the admin's pending queues.
 *
 * A notification carries no text of its own: the title is the label of its
 * type, and what it points to is a table and a row. The patient's name is not
 * in it: the bell asks for the names apart, only when it opens
 * (`nomesDosPacientes`), because each name is an audited read.
 */

export interface NotificacaoItem {
  id: string;
  /** The type's code. Used to choose where the click goes, never shown. */
  codigo: string;
  /** The type's label, as the clinic wrote it — "Alerta designado a você". */
  titulo: string;
  criada_em: string;
  lida: boolean;
  /** What it points to: `alerts`, `conversations`, `report_runs`… */
  alvo_tabela: string | null;
  alvo_id: string | null;
  paciente_id: string | null;
}

/** What waits for the administration, counted — no notification is created for these. */
export interface PendenciasAdmin {
  /** Data-subject requests not yet decided. */
  pedidos_titular_abertos: number;
  /** Of those, the ones open for more than `PRAZO_PEDIDO_TITULAR_DIAS` days. */
  pedidos_titular_atrasados: number;
  /** Granted requests whose execution failed and needs another try. */
  pedidos_titular_com_falha: number;
  /** Content versions waiting for review. */
  conteudos_em_revisao: number;
}

/** The deadline the data-subject requests screen already highlights. */
export const PRAZO_PEDIDO_TITULAR_DIAS = 15;
