import type { StatusTone } from "@/components/shared";
import type { AutorMensagem, CondutaAlerta, Severidade, StatusAlerta, StatusConversa } from "@/lib/enums";

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

/**
 * Um alerta de sintoma grave — fila compartilhada pela equipe (`alerts`).
 *
 * `read_alerts` devolve a fila inteira, não recortada por profissional: é o
 * mesmo modelo de "Triagem priorizada" do protótipo, onde qualquer um da
 * equipe assume um item em aberto. `grau` e `severidade` são a MESMA
 * informação em duas formas — o grau é o valor bruto do sintoma (0–5), a
 * severidade é a faixa que o rótulo usa.
 */
export interface AlertaClinico {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  sintoma_label: string;
  grau: number;
  severidade: Severidade;
  status: StatusAlerta;
  status_tom: StatusTone;
  conduta_tipo: CondutaAlerta | null;
  conduta_notas: string | null;
  criado_em: string;
  assumido_em: string | null;
  resolvido_em: string | null;
}

/** Uma conversa da fila de chat — mesma leitura de equipe que `AlertaClinico`. */
export interface ConversaClinico {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  assunto_label: string;
  status: StatusConversa;
  status_tom: StatusTone;
  ultima_mensagem_em: string;
  /** `last_message_at` mais recente que a última leitura da equipe. */
  nao_lida_pela_equipe: boolean;
  /** `null` até alguém da equipe assumir — a fila mostra "não atribuída". */
  atribuida: boolean;
}

/** Uma mensagem dentro de uma conversa — só leitura (ver PA-07: sem RPC de envio). */
export interface MensagemClinico {
  id: string;
  autor: AutorMensagem;
  corpo: string;
  criado_em: string;
}
