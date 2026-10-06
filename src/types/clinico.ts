import type { StatusTone } from "@/components/shared";
import type {
  AutorMensagem,
  FaseTratamento,
  CondutaAlerta,
  Especialidade,
  Severidade,
  StatusAlerta,
  StatusConversa,
} from "@/lib/enums";

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
  /**
   * O código da situação no catálogo (`scheduled`, `completed`, `no_show`,
   * `cancelled`, `rescheduled`). É o que se CONTA; o rótulo é o que se lê, e
   * muda — "Sem desfecho registrado" não é uma situação do catálogo.
   */
  status_codigo?: string | null;
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
  /** Quem cuida do alerta agora: quem o assumiu, ou quem recebeu a designação. */
  atribuido_a: string | null;
  criado_em: string;
  assumido_em: string | null;
  resolvido_em: string | null;
}

/**
 * A carteira de quem está logado: os pacientes que atendeu no período e o que
 * aconteceu com eles.
 *
 * "Carteira" aqui é uma definição que a leitura sustenta: os pacientes com
 * compromisso na agenda DESTA pessoa, nos últimos N dias. O banco não guarda um
 * vínculo profissional ↔ paciente, e inventar um (a base toda, ou "quem me
 * escreveu") daria números que parecem da pessoa e não são.
 *
 * Só contagem, e a lista de quem pede atenção — com o motivo dito, sem escore.
 */
export type MotivoDeAtencao = "alerta_ativo" | "faltou";

export interface CarteiraResumo {
  dias: number;
  pacientes: number;
  /** Dos pacientes da carteira, quantos estão com a ficha ativa hoje. */
  pacientes_ativos: number;
  /** Na ordem das fases. `fase: null` = sem fase registrada, ou fora do alcance da leitura. */
  por_fase: { fase: FaseTratamento | null; total: number }[];
  compromissos: {
    total: number;
    realizados: number;
    faltas: number;
    reagendados: number;
    cancelados: number;
    /** Já passaram e continuam marcados como agendados: ninguém registrou o desfecho. */
    sem_desfecho: number;
  };
  /** Alertas que esta pessoa resolveu no período. `limitado`: a leitura bateu no teto. */
  alertas_tratados: { total: number; limitado: boolean };
  atencao: { paciente_id: string; paciente_nome: string; motivos: MotivoDeAtencao[] }[];
  /** A varredura da lista de pacientes parou no teto: parte da carteira pode estar sem fase. */
  lista_limitada: boolean;
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
  /** Última leitura da equipe (ISO 8601 UTC). `null` se ninguém abriu a conversa. */
  equipe_lida_em: string | null;
  /** `false` até alguém assumir: a conversa está na fila. */
  atribuida: boolean;
  /** Quem assumiu é a pessoa logada. Só ela responde, resolve e encaminha. */
  minha: boolean;
  /**
   * The specialty the conversation was routed to when claimed. Only that
   * specialty can resolve it, so the screen offers "resolve" by comparing it
   * with the viewer's own. `null` while unassigned.
   */
  especialidade_origem: Especialidade | null;
}

/** Um arquivo anexado a uma mensagem. O conteúdo se baixa à parte, por `baixarAnexo`. */
export interface AnexoMensagem {
  id: string;
  /** Caminho no bucket: `<id da mensagem>/<nome>`. É o que `baixarAnexo` recebe. */
  caminho: string;
  nome: string;
  mime_type: string;
  tamanho: number;
}

/** Uma mensagem dentro de uma conversa. */
export interface MensagemClinico {
  id: string;
  autor: AutorMensagem;
  /**
   * Quem da equipe escreveu. `null` quando a mensagem não é da equipe ou a
   * origem dos dados não informa.
   */
  autor_nome?: string | null;
  corpo: string;
  criado_em: string;
  anexos: AnexoMensagem[];
}
