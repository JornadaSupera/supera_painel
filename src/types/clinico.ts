import type { StatusTone } from "@/components/shared";

/**
 * Domínio do painel clínico — ver PA-07.
 *
 * Fase 1 (fundação) só tinha rota e layout. Esta é a primeira tela com dado
 * real: a agenda pessoal do profissional, lida direto do professional_id da
 * própria sessão (`private.my_professional_id()`), sem escopo/permissão
 * adicional a checar aqui — quem chama só enxerga os próprios compromissos.
 */

/** Um compromisso da agenda pessoal do profissional logado. */
export interface CompromissoAgenda {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  tipo_label: string;
  status_label: string;
  /** Reaproveita o vocabulário de `StatusBadge` — nenhum tom novo a manter. */
  status_tom: StatusTone;
  inicio: string;
  fim: string;
  local: string | null;
  confirmado_em: string | null;
}
