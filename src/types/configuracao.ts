/**
 * Domínio de Configurações.
 *
 * A tela tem duas metades, e a diferença entre elas não é "editável vs. não
 * editável" — as duas são, desde `update_vocabulary_term` e
 * `set_vocabulary_term_active` (25/09/2026). A diferença é O QUE cada uma
 * deixa mudar:
 *
 *  - **Vocabulário** — `symptoms`, `notification_types`, `content_categories`,
 *    `conversation_subjects`, `appointment_types`. Rótulo e ordem mudam pelo
 *    painel; retirar e reativar também, pela mesma função nos dois sentidos.
 *    O que **não** muda é o `código`: é ele que o diário do paciente, o eixo
 *    dos relatórios e o alvo do gatilho de alerta usam para apontar para o
 *    mesmo item, e o banco recusa qualquer UPDATE que o altere. Termo novo
 *    também não se cadastra pelo painel — só por migração revisada, porque o
 *    conjunto de códigos válidos é fechado nos três lugares que os leem.
 *  - **Operação** — o documento legal em vigor, o grau que dispara alerta, os
 *    motivos de falta. Isso é decisão da clínica, muda com a rotina dela, e o
 *    banco expõe escrita para cada um, inclusive criação.
 */

/** Um item de catálogo — sintoma, tipo de notificação, categoria, assunto, tipo de compromisso. */
export interface ItemCatalogo {
  id: string;
  codigo: string;
  label: string;
  /** Texto auxiliar da linha: a área dona, a categoria, o grupo. */
  detalhe: string | null;
  /** Posição de exibição — o que `update_vocabulary_term` chama de `sort_order`. */
  ordem: number;
  ativo: boolean;
}

/** Uma versão de termo de uso ou de política de privacidade. */
export interface VersaoLegal {
  id: string;
  tipo: "termos_de_uso" | "politica_de_privacidade";
  tipo_label: string;
  versao: number;
  vigente: boolean;
  publicado_em: string | null;
  corpo: string;
}

/**
 * O grau a partir do qual um sintoma vira alerta para a equipe.
 *
 * Uma regra vigente por sintoma. Trocar o limiar **encerra** a regra anterior e
 * abre outra — o histórico fica, porque um alerta disparado em março foi
 * disparado sob a regra de março, e um relatório que leia a regra de hoje
 * explicaria o passado errado.
 *
 * > [!] Quem define o limiar é a clínica, não o software.
 * Qual sintoma, em qual grau, dispara conduta é decisão assistencial. O painel
 * oferece o cadastro e não sugere valor: sugerir seria o software opinando
 * sobre gravidade, que é exatamente o que o contrato veda a este produto.
 */
export interface RegraAlerta {
  /** `null` enquanto o sintoma não tem regra — a linha existe para ser criada. */
  id: string | null;
  sintoma_id: string;
  sintoma_label: string;
  /** Grau de 1 a 5. `null` quando não há regra vigente para o sintoma. */
  grau_minimo: number | null;
  /** Desde quando o limiar atual vale. `null` sem regra. */
  vigente_desde: string | null;
}

/**
 * Por que um compromisso não aconteceu — o recorte que o relatório de faltas
 * precisa para ser acionável.
 *
 * Só estado **terminal** tem motivo: "agendado" não se explica por um motivo, e
 * o banco recusa o par. A lista nasce vazia porque ninguém a escreveu ainda —
 * não é limitação, é uma conversa de dez minutos com a recepção.
 */
export interface MotivoSituacao {
  id: string;
  /** `completed`, `cancelled`, `no_show`, `rescheduled`. */
  situacao_codigo: string;
  situacao_label: string;
  codigo: string;
  label: string;
  ordem: number;
  ativo: boolean;
}

/** Uma situação de compromisso que aceita motivos. */
export interface SituacaoComMotivo {
  codigo: string;
  label: string;
}

/**
 * O interruptor de segurança que a clínica opera.
 *
 * Com a exigência ligada, o backend deixa de reconhecer como administrador
 * qualquer sessão que tenha entrado só com senha — e não devolve erro: devolve
 * vazio. Por isso o estado dele é dado de tela, e não detalhe de infra.
 */
export interface ConfiguracaoSeguranca {
  /** `null` quando a sessão não consegue ler a configuração de segurança. */
  exige_mfa: boolean | null;
  /** Quando o interruptor foi mexido pela última vez. `null` = nunca. */
  atualizado_em: string | null;
  /** Quem mexeu. `null` no valor de nascimento, ou quando o nome não resolve. */
  atualizado_por: string | null;
}

/**
 * Um vínculo proposto pela integração, esperando conferência humana.
 *
 * > [!] A conferência existe para impedir o pior erro possível deste sistema.
 * Ligar a ficha errada ao paciente errado **mistura prontuários** — e a partir
 * daí o diário de uma pessoa aparece na ficha de outra. Por isso nada do
 * sistema externo entra na ficha enquanto o vínculo não for confirmado por
 * alguém.
 *
 * A fila precisa estar de pé **antes** de a sincronização ligar. Construí-la no
 * dia em que os vínculos começarem a chegar é construí-la com pressa.
 */
export interface VinculoExterno {
  id: string;
  /** O sistema de origem: `gemed`. */
  sistema: string;
  /** Que tipo de registro o vínculo aponta — paciente, plano, diagnóstico. */
  entidade: string;
  /** A chave que o sistema de origem usa, legível. */
  chave_externa: string;
  /** O registro daqui que o vínculo propõe. `null` quando ainda não aponta um. */
  local_id: string | null;
  proposto_em: string;
}

/**
 * Um aceite de termo ou de política, por pessoa e por versão.
 *
 * É a contrapartida da publicação: publicar cria a obrigação, isto é a prova de
 * que ela foi cumprida. O aceite é **por versão** — quem aceitou a v1 não
 * aceitou a v2, e é isso que torna o histórico de versões uma prova e não um
 * changelog.
 */
export interface Consentimento {
  id: string;
  /** Nome de quem aceitou, ou o e-mail quando o nome não está preenchido. */
  pessoa: string;
  /** "Termos de uso · versão 3". */
  documento: string;
  aceito_em: string;
  /** Revogar é direito do titular, e só ele o exerce. */
  revogado_em: string | null;
}

export interface Configuracoes {
  /** Os sintomas marcáveis no diário — a base dos gatilhos de alerta. */
  sintomas: ItemCatalogo[];
  /** Os tipos de notificação e se podem ser silenciados. */
  notificacoes: ItemCatalogo[];
  /** As categorias da biblioteca de orientações. */
  categorias_conteudo: ItemCatalogo[];
  /** Os assuntos que o paciente escolhe ao abrir uma conversa. */
  assuntos_chat: ItemCatalogo[];
  /** Os tipos de compromisso da agenda — infusão, consulta, retorno, exame... */
  tipos_compromisso: ItemCatalogo[];
  /**
   * Chaves de configuração que a tela de referência mostra e o banco não
   * guarda. A interface usa a lista para nomear o que falta em vez de desenhar
   * um campo vazio que ninguém consegue salvar.
   */
  sem_origem: string[];
}

/**
 * Um slide do carrossel de onboarding — a primeira coisa que o paciente vê no
 * app, antes do login. Título até 80 caracteres, corpo até 400 — o mesmo teto
 * que `set_clinic_messages` valida no banco.
 */
export interface SlideOnboarding {
  titulo: string;
  corpo: string;
}

/**
 * Um intervalo de atendimento num dia da semana.
 *
 * `dia_semana`: 0 = domingo, como `set_clinic_business_hours` espera. `abre`
 * e `fecha` em `"HH:MM"`. Mais de um intervalo por dia é aceito (ex.: manhã e
 * tarde, com almoço fora); intervalos sobrepostos no mesmo dia o banco recusa.
 */
export interface IntervaloAtendimento {
  dia_semana: number;
  abre: string;
  fecha: string;
}

/**
 * Identidade visual, mensagens e horário da clínica — `clinic_settings` +
 * `clinic_business_hours`, desde 25/09/2026.
 *
 * > [!] Linha única, criada vazia.
 * Tudo aqui pode vir `null` ou lista vazia até alguém configurar pela
 * primeira vez — não é ausência de leitura, é o estado de fábrica.
 *
 * > [!] `resposta_automatica` depende de horário E mensagem, os dois.
 * O guia do banco é explícito: a resposta automática fora do expediente fica
 * desligada enquanto faltar peça — hoje falta a mensagem. Configurar só o
 * horário não liga a resposta sozinha.
 */
export interface ClinicaConfiguracao {
  cor_primaria: string | null;
  cor_secundaria: string | null;
  /** Caminho no bucket `clinic-branding`. `null` sem logo. */
  logo_path: string | null;
  /** URL pública já resolvida — o bucket é público, de propósito. */
  logo_url: string | null;
  /** Fuso IANA. Vale para o horário de atendimento inteiro. */
  fuso: string;
  slides_onboarding: SlideOnboarding[];
  mensagem_fora_horario: string | null;
  intervalos: IntervaloAtendimento[];
}

/**
 * Um pedido que o titular abriu sobre os próprios dados.
 *
 * > [!] Corre prazo legal a partir da abertura.
 * A LGPD garante ao titular acesso, correção, portabilidade, revogação de
 * consentimento e exclusão. O paciente abre o pedido pelo aplicativo — e até
 * esta tela existir, **ninguém no painel sabia que ele existia**. Um pedido sem
 * resposta não é uma pendência de sistema: é descumprimento com data.
 */
export interface SolicitacaoTitular {
  id: string;
  /** A conta do titular. Serve para cruzar os pedidos da mesma pessoa; não é exibida. */
  conta_id: string;
  /** Quem pediu. Nome da conta, ou o e-mail quando o nome não está preenchido. */
  pessoa: string;
  /** `access`, `rectification`, `portability`, `consent_revocation`, `deletion`. */
  tipo: string;
  tipo_label: string;
  /** `requested`, `under_review`, `granted`, `executed`, `refused`. */
  status: string;
  status_label: string;
  /** Aberto em — é daqui que o prazo conta. */
  criado_em: string;
  decidido_em: string | null;
  decidido_por: string | null;
  /**
   * Quando o pedido foi cumprido. Em acesso e portabilidade é o primeiro
   * download do paciente; em correção, o "marcar como cumprida" do painel.
   */
  executado_em: string | null;
  /** A justificativa da decisão, que o backend guarda junto. */
  observacao: string | null;
  /** `true` enquanto o pedido aceita decisão. */
  aberto: boolean;
  /**
   * `true` para um pedido de correção já deferido, ainda não marcado como
   * cumprido — o único caso em que o painel oferece o botão. Exclusão e
   * revogação de consentimento se executam sozinhas, pela rotina agendada
   * (`execution_error` avisa quando falham); acesso e portabilidade o titular
   * baixa direto pelo app.
   */
  completavel: boolean;
  /** Preenchido quando a execução automática (exclusão/revogação) falhou. */
  execucao_erro: string | null;
}
