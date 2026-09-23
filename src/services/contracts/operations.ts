import type { FaseTratamento, Papel, Periodo, StatusUsuario } from "@/lib/enums";
import type { Permissao } from "@/lib/rbac";
import type { KpisResposta, SeriesResposta } from "@/types/dashboard";
import type { DesafioMfa, GarantiaDaSessao, ResultadoLogin, Sessao } from "@/types/auth";
import type { AuditoriaListItem, FacetasAuditoria, ResumoAuditoria } from "@/types/auditoria";
import type { Cid, EfeitoAdverso, Protocolo } from "@/types/catalogo";
import type {
  ConfiguracaoSeguranca,
  Configuracoes,
  Consentimento,
  MotivoSituacao,
  RegraAlerta,
  SolicitacaoTitular,
  VersaoLegal,
  VinculoExterno,
} from "@/types/configuracao";
import type { DefinicaoRelatorio, ResultadoRelatorio } from "@/types/relatorio";
import type {
  ComparacaoProtocolo,
  CruzamentoClinico,
  EstatisticasOperacionais,
  IndicadorOperacional,
  LinhaEspecialidade,
  PontoVolume,
} from "@/types/estatisticas";
import type {
  ComparacaoVersoes,
  ConteudoDetalhe,
  ConteudoEntrada,
  ConteudoListItem,
} from "@/types/conteudo";
import type {
  CampoPii,
  CuidadorVinculado,
  PacienteClinicaEntrada,
  PacienteDetalhe,
  PacienteEntrada,
  PacienteListItem,
  PiiRevelada,
  ResultadoConvite,
} from "@/types/paciente";
import type {
  ContaDisponivel,
  DistribuicaoEspecialidade,
  LogAcesso,
  MatrizPermissoes,
  PermissaoRestrita,
  UsuarioDetalhe,
  UsuarioEntrada,
  UsuarioListItem,
} from "@/types/usuario";
import type { DateRange, ListParams, ListResult, SingleResult } from "./index";

/**
 * ASSINATURAS TIPADAS DAS OPERAÇÕES
 * =============================================================================
 * `resources.ts` garante que a operação **existe** nos dois adapters.
 * Este arquivo diz o que ela **recebe e devolve**.
 *
 * A separação é proposital: o inventário é percorrido em runtime para montar os
 * adapters, então o tipo derivado dele é necessariamente genérico. As telas
 * consomem daqui, onde os tipos são concretos.
 *
 * Cresce uma seção por fase, junto com o mock correspondente.
 */

/* ---------------------------------------------------------------- Fase 2 */

export interface PasswordResetRequest {
  email: string;
}

/**
 * Proof carried by a recovery link opened from a recovery e-mail.
 *
 * Supabase delivers it in one of three shapes, and which one arrives depends on
 * the e-mail template configured for the project — not on the screen reading it:
 *
 *   token_hash  the hash behind `{{ .TokenHash }}`, still to be exchanged
 *   otp         the bare code behind `{{ .Token }}`, valid only next to its e-mail
 *   session     a recovery session already issued (implicit flow, in the fragment)
 *
 * > [!] `token_hash` and `otp` are NOT interchangeable.
 * The hash is what the server stores; the code is what the person receives.
 * Sending one where the other is expected fails verification every time, and the
 * screen reports it as a spent link — which sends people to request another link
 * that fails in exactly the same way.
 */
export type RecoveryCredential =
  | { kind: "token_hash"; token_hash: string }
  | { kind: "otp"; email: string; token: string }
  | { kind: "session"; access_token: string; refresh_token: string };

export interface PasswordRecoveryInput {
  credential: RecoveryCredential;
  password: string;
}

export interface AuthOperations {
  /** Nunca devolve sessão direto: o segundo fator é obrigatório. */
  signIn(params: { email: string; senha: string }): Promise<SingleResult<ResultadoLogin>>;

  verifyMfa(params: { desafio_id: string; codigo: string }): Promise<SingleResult<Sessao>>;

  signOut(): Promise<SingleResult<null>>;

  /** `null` enquanto a sessão viver só em memória — ver `adapters/mock/auth.ts`. */
  getSession(): Promise<SingleResult<Sessao>>;

  /**
   * O nível de garantia da sessão contra o que o backend exige.
   *
   * Chamada depois do login, e não durante: a pergunta não é "esta pessoa
   * entra?" — é "o que ela vê a partir daqui é real?". Com a exigência ligada e
   * a sessão em `aal1`, o backend não devolve erro: devolve **vazio**, em todas
   * as telas de uma vez.
   */
  getGarantia(): Promise<SingleResult<GarantiaDaSessao>>;

  /** Responde sucesso mesmo para e-mail inexistente, por design. */
  requestPasswordReset(params: PasswordResetRequest): Promise<SingleResult<{ enviado: true }>>;

  /**
   * Public password change for app accounts (patients and caregivers).
   *
   * Never yields a session: it ends signed out, whatever the account is.
   * Error codes the screen relies on:
   *   UNAUTHORIZED → the link is expired or spent; a new one is needed
   *   VALIDATION   → the password was refused; the same link can retry
   *   anything else → transient; the same link can retry
   */
  completePasswordRecovery(params: PasswordRecoveryInput): Promise<SingleResult<{ changed: true }>>;
}

/* ---------------------------------------------------------------- Fase 4 */

export interface DashboardOperations {
  getKpis(params?: { periodo?: Periodo }): Promise<SingleResult<KpisResposta>>;
  getSeries(params?: { periodo?: Periodo }): Promise<SingleResult<SeriesResposta>>;
}

/* ---------------------------------------------------------------- Fase 5 */

export interface PacientesOperations {
  /**
   * Listagem paginada. Devolve a PROJEÇÃO da tela — sem dado clínico livre e
   * com os campos pessoais já mascarados. É o equivalente ao `.select()` que a
   * Fase 15 fará sobre a view mascarada.
   *
   * Filtros aceitos: `protocolo_id`, `cid`, `fase`, `risco`, `status`.
   * Busca: nome, código e CPF (dígitos).
   */
  list(params?: ListParams): Promise<ListResult<PacienteListItem>>;

  getById(params: { id: string }): Promise<SingleResult<PacienteDetalhe>>;

  create(params: PacienteEntrada): Promise<SingleResult<PacienteDetalhe>>;

  update(params: { id: string; dados: Partial<PacienteEntrada> }): Promise<SingleResult<PacienteDetalhe>>;

  /** Desativação lógica. O motivo é obrigatório e vai para a auditoria. */
  deactivate(params: { id: string; motivo: string }): Promise<SingleResult<PacienteDetalhe>>;

  /** Convite de acesso ao app, por SMS — como anuncia o cabeçalho da tela. */
  sendInvite(params: { id: string }): Promise<SingleResult<ResultadoConvite>>;

  /**
   * Linhas da exportação, já achatadas e com PII mascarada. A serialização em
   * CSV é da tela (`lib/csv.ts`); a decisão sobre QUAIS colunas saem é do
   * backend, para que não dependa de quem clicou.
   */
  export(params?: ListParams): Promise<ListResult<Record<string, string>>>;

  /** Ver `resources.ts`: revelação auditada de um campo pessoal. */
  revealPii(params: { id: string; campos: CampoPii[] }): Promise<SingleResult<PiiRevelada>>;

  /**
   * Quem acompanha o paciente — vínculos vigentes e revogados.
   *
   * Somente leitura por desenho: convidar e revogar são atos do titular, no
   * aplicativo dele. O painel precisa **enxergar** o vínculo porque é dado
   * pessoal de terceiro dentro de uma ficha, e o encarregado de dados pergunta
   * por ele.
   *
   * O convite de acompanhante ainda PENDENTE não aparece: a tabela dele é
   * legível só pelo titular.
   */
  listCuidadores(params: { id: string }): Promise<ListResult<CuidadorVinculado>>;

  /**
   * Cancela o convite pendente, sem emitir outro.
   *
   * Reemitir já cancela o anterior, então isto serve ao caso em que o convite
   * foi para o número errado e **não** se quer um novo código circulando.
   */
  cancelInvite(params: { id: string }): Promise<SingleResult<PacienteDetalhe>>;

  /**
   * Desfaz o vínculo entre a ficha e a conta do aplicativo.
   *
   * A ficha fica, o histórico fica, a conta fica — o que se desfaz é a ligação
   * entre as duas. É o que permite corrigir uma ativação feita na ficha errada,
   * e é pré-requisito para trocar o CPF de quem já ativou.
   */
  unlinkAccount(params: { id: string }): Promise<SingleResult<PacienteDetalhe>>;

  /**
   * Registra o quadro clínico da ficha.
   *
   * > [!] Só vai ao banco o que MUDOU.
   * O adapter compara com o que já está gravado antes de escrever, e a razão é
   * a semântica do backend: diagnóstico e plano terapêutico são registros
   * datados — a escrita acrescenta uma linha e, no caso do plano, encerra a
   * anterior. Reenviar o valor vigente não seria inócuo: duplicaria o
   * diagnóstico e trocaria a data de início do tratamento por hoje.
   *
   * A fase é a exceção: é uma coluna da ficha, e regravá-la não tem efeito.
   */
  updateClinical(params: {
    id: string;
    dados: PacienteClinicaEntrada;
  }): Promise<SingleResult<PacienteDetalhe>>;
}

export interface CatalogosOperations {
  listCids(): Promise<ListResult<Cid>>;
  listProtocolos(): Promise<ListResult<Protocolo>>;
  listEspecialidades(): Promise<ListResult<{ value: string; label: string }>>;
  listEfeitos(): Promise<ListResult<EfeitoAdverso>>;

  /**
   * Fases de tratamento ATIVAS no cadastro, na ordem do catálogo.
   *
   * Só as que o painel sabe nomear: uma fase do banco sem correspondente aqui
   * não entra, porque a listagem não saberia exibi-la na coluna.
   */
  listFases(): Promise<ListResult<{ value: FaseTratamento; label: string }>>;
}

/* ---------------------------------------------------------------- Fase 6 */

export interface UsuariosOperations {
  /** Filtros aceitos: `papel`, `especialidade`, `status`. Busca: nome, e-mail, registro. */
  list(params?: ListParams): Promise<ListResult<UsuarioListItem>>;

  getById(params: { id: string }): Promise<SingleResult<UsuarioDetalhe>>;

  create(params: UsuarioEntrada): Promise<SingleResult<UsuarioDetalhe>>;

  update(params: { id: string; dados: Partial<UsuarioEntrada> }): Promise<SingleResult<UsuarioDetalhe>>;

  /**
   * Revoga ou devolve o acesso ao PAINEL, sem tocar na conta.
   *
   * É a revogação oficial: a pessoa deixa de operar o painel e continua com a
   * conta dela — o aplicativo, os outros perfis e os aparelhos registrados
   * seguem valendo. Para derrubar tudo de uma vez existe `setAccountActive`,
   * que é ato maior e tem nome próprio por isso.
   *
   * Vale no instante seguinte: a autorização é consultada a cada chamada, não
   * carimbada no token.
   */
  setStatus(params: { id: string; status: StatusUsuario }): Promise<SingleResult<UsuarioDetalhe>>;

  /**
   * Desativa a CONTA — todos os perfis, o aplicativo e o push de uma vez.
   *
   * Separada de `setStatus` porque a pergunta "esta pessoa ainda opera o
   * painel?" e "esta pessoa ainda usa a plataforma?" têm respostas diferentes,
   * e um botão só para as duas escolhe a errada metade das vezes.
   */
  setAccountActive(params: { id: string; ativa: boolean }): Promise<SingleResult<UsuarioDetalhe>>;

  /** Dispara o e-mail de redefinição. O painel nunca escolhe senha de ninguém. */
  resetPassword(params: { id: string }): Promise<SingleResult<{ enviado: true; destino: string }>>;

  /** Liga ou desliga o segundo fator. Desligar exige justificativa. */
  setMfa(params: { id: string; ativo: boolean; motivo?: string }): Promise<SingleResult<UsuarioDetalhe>>;

  listAccessLogs(params: { id: string } & ListParams): Promise<ListResult<LogAcesso>>;

  getDistribuicao(): Promise<ListResult<DistribuicaoEspecialidade>>;

  /** Contas sem perfil no painel — quem pode receber um. Ver `UsuarioEntrada`. */
  listContasSemPerfil(): Promise<ListResult<ContaDisponivel>>;

  /**
   * O catálogo de permissões restritas, com a concessão vigente desta pessoa.
   *
   * Devolve **uma linha por código do catálogo**, concedido ou não. Listar só
   * as concedidas esconderia exatamente o que a tela precisa mostrar: o que
   * esta pessoa ainda não pode fazer.
   *
   * Lista vazia para administrador — a concessão é por profissional, e o
   * catálogo do banco não alcança o perfil administrativo.
   */
  listPermissions(params: { id: string }): Promise<ListResult<PermissaoRestrita>>;

  /** Idempotente: reconceder o que está vigente não duplica nem reescreve a data. */
  grantPermission(params: { id: string; codigo: string }): Promise<SingleResult<PermissaoRestrita>>;

  /**
   * Encerra a concessão. A linha revogada FICA, com data e autor.
   *
   * Revogar é auditável; nunca ter concedido não deixa rastro nenhum — e é a
   * diferença que uma apuração pergunta.
   */
  revokePermission(params: { id: string; codigo: string }): Promise<SingleResult<PermissaoRestrita>>;
}

export interface PermissoesOperations {
  getMatrix(): Promise<SingleResult<MatrizPermissoes>>;

  /** Salva a matriz inteira: permissão é regra, e regra se aplica de uma vez. */
  updateMatrix(params: {
    concedidas: Record<Papel, Permissao[]>;
  }): Promise<SingleResult<MatrizPermissoes>>;
}

/* ---------------------------------------------------------------- Fase 7 */

export interface ConteudosOperations {
  /**
   * Listagem de VERSÕES, não de orientações — é a versão que percorre o fluxo
   * editorial e é ela que a revisão recebe.
   *
   * Filtros aceitos: `status`, `tipo`, `categoria_id`, `especialidade`.
   * Busca: título, resumo, categoria e autor.
   */
  list(params?: ListParams): Promise<ListResult<ConteudoListItem>>;

  getById(params: { id: string }): Promise<SingleResult<ConteudoDetalhe>>;

  /** `id` é o da ORIENTAÇÃO: devolve toda a linhagem de versões dela. */
  listVersions(params: { id: string } & ListParams): Promise<ListResult<ConteudoListItem>>;

  /** Aprova a versão e tira do ar a que estava publicada. */
  publish(params: { id: string }): Promise<SingleResult<ConteudoDetalhe>>;

  unpublish(params: { id: string; motivo?: string }): Promise<SingleResult<ConteudoDetalhe>>;

  /** Redigir é do autor, não do revisor — as três recusam por desenho. */
  create(params: ConteudoEntrada): Promise<SingleResult<ConteudoDetalhe>>;
  update(params: { id: string; dados: Partial<ConteudoEntrada> }): Promise<SingleResult<ConteudoDetalhe>>;
  submitForReview(params: { id: string }): Promise<SingleResult<ConteudoDetalhe>>;
}

export interface AprovacoesOperations {
  /** Só o que aguarda decisão, do que espera há mais tempo para o mais recente. */
  listQueue(params?: ListParams): Promise<ListResult<ConteudoListItem>>;

  /** A versão em revisão ao lado da anterior, para a comparação da tela. */
  getDiff(params: { id: string }): Promise<SingleResult<ComparacaoVersoes>>;

  approve(params: { id: string }): Promise<SingleResult<ConteudoDetalhe>>;

  /** Devolver e rejeitar exigem comentário — o backend recusa sem ele. */
  requestChanges(params: { id: string; comentario: string }): Promise<SingleResult<ConteudoDetalhe>>;
  reject(params: { id: string; comentario: string }): Promise<SingleResult<ConteudoDetalhe>>;
}

/* --------------------------------------------------------------- Fase 10 */

export interface AuditoriaOperations {
  /**
   * Linhas da trilha, do mais recente para o mais antigo.
   *
   * Filtros aceitos: `acao`, `usuario_id`, `paciente_id`. O período vai em
   * `range` — e é o único recorte aplicado no servidor, porque é o único que
   * corta volume antes de a linha viajar.
   */
  list(params?: ListParams): Promise<ListResult<AuditoriaListItem>>;

  getById(params: { id: string }): Promise<SingleResult<AuditoriaListItem>>;

  /** Contadores da janela — os cartões do topo. Padrão: 24 horas. */
  getSummary(params?: { janelaHoras?: number }): Promise<SingleResult<ResumoAuditoria>>;

  /**
   * Quem aparece na janela, para preencher os seletores de usuário e paciente.
   *
   * Recebe só o `range` porque as opções descrevem a JANELA, não o recorte: se
   * dependessem dos filtros aplicados, escolher um usuário apagaria os outros
   * da lista e não haveria como trocar de escolha.
   */
  getFacets(params?: { range?: DateRange | null }): Promise<SingleResult<FacetasAuditoria>>;

  /** Linhas achatadas do RECORTE inteiro, não da página aberta. */
  export(params?: ListParams): Promise<ListResult<Record<string, string>>>;
}

/* ----------------------------------------------------------- Fases 12 e 13 */

/** Recorte do cruzamento clínico. O protótipo abre em 90 dias, grau 2, ativos. */
export interface FiltroClinico {
  grauMinimo?: number;
  dias?: number;
  apenasAtivos?: boolean;
  /**
   * Nome do protocolo, exatamente como está no plano terapêutico.
   *
   * Recorte do SERVIDOR: filtrar depois daria o mesmo desenho, mas a trilha
   * passaria a dizer que a varredura foi da base inteira. O escopo do nível
   * Médio pede este filtro com todas as letras.
   */
  protocolo?: string | null;
  /** Id do sintoma. O escopo chama de "efeito adverso"; o catálogo, de sintoma. */
  sintomaId?: string | null;
}

export interface EstatisticasClinicasOperations {
  /** Protocolo × Efeito × Grau, contado por PACIENTE distinto. */
  crossTab(params?: FiltroClinico): Promise<SingleResult<CruzamentoClinico>>;

  /** O mesmo dado — o mapa de calor é a forma de desenhá-lo. */
  heatmap(params?: FiltroClinico): Promise<SingleResult<CruzamentoClinico>>;

  compareProtocolos(params?: FiltroClinico): Promise<ListResult<ComparacaoProtocolo>>;
}

/**
 * Janela dos indicadores operacionais.
 *
 * A tela usa o padrão de sete meses, que é o que o gráfico desenha; os
 * relatórios passam a própria janela, para que o resumo do cartão descreva o
 * período que foi de fato medido em vez de um período que a tela escolheu.
 */
export interface JanelaOperacional {
  /** Dias corridos até agora. Ausente usa o padrão da tela. */
  dias?: number;
  /**
   * Recorte por área de origem, aplicado no SERVIDOR.
   *
   * É o CÓDIGO do painel (`medico_oncologista`), o mesmo que o catálogo de
   * especialidades oferece — não a chave da tabela. O adapter resolve a chave,
   * como faz com o CID: qual id o banco usa para "Oncologia" é detalhe do
   * banco, e uma tela que o carregasse passaria a depender dele.
   */
  especialidade?: string | null;
}

export interface EstatisticasOperacionaisOperations {
  /** Indicadores, tabela por especialidade e série mensal, de uma leitura só. */
  getIndicadores(params?: JanelaOperacional): Promise<SingleResult<EstatisticasOperacionais>>;

  getTempoResposta(params?: JanelaOperacional): Promise<SingleResult<IndicadorOperacional>>;
  getAdesaoAgenda(params?: JanelaOperacional): Promise<ListResult<LinhaEspecialidade>>;
  getGargalos(params?: JanelaOperacional): Promise<ListResult<PontoVolume>>;

  /** A fila existe no banco; o que falta é gatilho de criticidade cadastrado. */
  getFilaAlertas(): Promise<ListResult<never>>;
}

/* ---------------------------------------------------------------- Fase 9 */

export interface ConfiguracoesOperations {
  /** Catálogos em vigor, mais a lista do que ainda não é dado do backend. */
  get(): Promise<SingleResult<Configuracoes>>;

  /** Termos e política, todas as versões — o histórico é exigência de aceite. */
  getTermos(): Promise<ListResult<VersaoLegal>>;

  /**
   * Publica uma versão nova e aposenta a anterior, no mesmo ato.
   *
   * Recebe o TEXTO, não o id de uma versão existente: publicar é registrar um
   * documento novo, e a numeração é do backend — por espécie, porque termos e
   * política evoluem em ritmos diferentes.
   *
   * > [!] Cria obrigação de novo aceite para todos os pacientes.
   * O aceite é versionado: quem aceitou a anterior não aceitou esta. Não é
   * edição do texto vigente — editar apagaria a prova do que a pessoa aceitou.
   */
  publishTermos(params: {
    tipo: VersaoLegal["tipo"];
    corpo: string;
  }): Promise<SingleResult<VersaoLegal>>;

  /** As duas recusam: catálogo do sistema muda por migração, não por formulário. */
  update(params: Partial<Configuracoes>): Promise<SingleResult<Configuracoes>>;
  uploadLogo(params: { arquivo: File }): Promise<SingleResult<{ url: string }>>;

  /**
   * Uma linha por sintoma ATIVO, com ou sem regra.
   *
   * Sintoma sem limiar aparece com `grau_minimo` nulo, e não é omitido: a tela
   * precisa mostrar o que está desprotegido tanto quanto o que está coberto.
   */
  getRegrasAlerta(): Promise<ListResult<RegraAlerta>>;

  /** Define ou troca o limiar. Trocar encerra a regra anterior e abre outra. */
  setRegraAlerta(params: {
    sintoma_id: string;
    grau_minimo: number;
  }): Promise<SingleResult<RegraAlerta>>;

  /** Encerra a regra vigente: o sintoma deixa de disparar alerta. */
  removerRegraAlerta(params: { sintoma_id: string }): Promise<SingleResult<RegraAlerta>>;

  /** Motivos de falta, cancelamento, remarcação e realização. */
  getMotivos(): Promise<ListResult<MotivoSituacao>>;

  criarMotivo(params: {
    situacao_codigo: string;
    codigo: string;
    label: string;
    ordem?: number;
  }): Promise<SingleResult<MotivoSituacao>>;

  atualizarMotivo(params: {
    id: string;
    label?: string;
    ordem?: number;
  }): Promise<SingleResult<MotivoSituacao>>;

  /**
   * Aposenta um motivo, ou o traz de volta.
   *
   * Aposentar, nunca apagar: um compromisso de março aponta para o motivo de
   * março, e apagar a linha falsificaria o relatório daquele mês.
   */
  setMotivoAtivo(params: { id: string; ativo: boolean }): Promise<SingleResult<MotivoSituacao>>;

  /** O estado do interruptor de segundo fator, e quem o mexeu por último. */
  getSeguranca(): Promise<SingleResult<ConfiguracaoSeguranca>>;

  /**
   * Liga ou desliga a exigência de segundo fator no perfil administrativo.
   *
   * > [!] Ligar a partir de uma sessão de um fator é recusado pelo backend.
   * A guarda não é conveniência: quem liga prova, no ato, que consegue voltar a
   * entrar depois. Sem ela, um administrador sem autenticador trancaria a
   * clínica inteira do lado de fora — e o caminho de volta também é ato de
   * administrador.
   *
   * Desligar não exige o mesmo, pela razão oposta: a saída de emergência não
   * pode depender da porta que emperrou.
   */
  setExigirMfa(params: { exigir: boolean }): Promise<SingleResult<ConfiguracaoSeguranca>>;

  /**
   * Os vínculos que a integração propôs e ninguém conferiu ainda.
   *
   * Só os propostos: confirmados e rejeitados já foram decididos, e uma fila de
   * conferência que mistura pendente com resolvido deixa de ser fila.
   */
  getVinculosExternos(): Promise<ListResult<VinculoExterno>>;

  /**
   * Confirma ou rejeita um vínculo.
   *
   * Rejeitar não é o mesmo que ignorar: a linha sai da fila com a decisão
   * registrada, e a integração não volta a propor o mesmo par sem que alguém
   * saiba que ele já foi recusado.
   */
  confirmarVinculoExterno(params: {
    id: string;
    confirmar: boolean;
  }): Promise<SingleResult<VinculoExterno>>;

  /** Quem aceitou qual versão, e quando. Somente leitura: aceitar é ato do titular. */
  getConsentimentos(params?: ListParams): Promise<ListResult<Consentimento>>;

  /**
   * Os pedidos que o titular abriu sobre os próprios dados.
   *
   * Abertos primeiro: é uma fila com prazo legal correndo, e ordenar por data
   * misturaria o que espera decisão com o que já foi decidido.
   */
  getSolicitacoesTitular(): Promise<ListResult<SolicitacaoTitular>>;

  /**
   * Defere ou recusa um pedido, com justificativa.
   *
   * > [!] Não há como registrar que o pedido foi CUMPRIDO.
   * O backend aceita apenas deferido e recusado; "executado" existe na
   * estrutura e nenhuma função o alcança. Para a LGPD o que conta é o
   * atendimento, não o deferimento — então é justamente a prova do atendimento
   * que fica de fora. A tela diz isso em vez de dar o assunto por encerrado.
   */
  decidirSolicitacaoTitular(params: {
    id: string;
    deferir: boolean;
    observacao: string;
  }): Promise<SingleResult<SolicitacaoTitular>>;
}

/* ---------------------------------------------------------------- Fase 8 */

export interface RelatoriosOperations {
  /** O catálogo dos doze, cada um sabendo se consegue rodar e por que não. */
  listDefinitions(): Promise<ListResult<DefinicaoRelatorio>>;

  /**
   * Roda um relatório: devolve colunas descritas e linhas achatadas.
   *
   * `especialidade` só tem efeito nos relatórios cuja definição declara o
   * filtro `especialidade` — nos demais é ignorado, porque a origem deles não
   * tem essa dimensão. A tela lê a mesma declaração para decidir se oferece o
   * seletor, então as duas pontas não divergem.
   */
  run(params: {
    slug: string;
    dias?: number;
    especialidade?: string | null;
  }): Promise<SingleResult<ResultadoRelatorio>>;

  export(params: {
    slug: string;
    dias?: number;
    especialidade?: string | null;
  }): Promise<ListResult<Record<string, string>>>;

  /** As três dependem de rotina agendada e tabela de token — ainda não existem. */
  schedule(params: { slug: string; email: string }): Promise<SingleResult<never>>;
  listSchedules(): Promise<ListResult<never>>;
  createShareLink(params: { slug: string }): Promise<SingleResult<never>>;
}

/* -------------------------------------------------------------------------
   O QUE LIGA O INVENTÁRIO ÀS ASSINATURAS
   ------------------------------------------------------------------------- */

/**
 * Cada recurso do inventário e a interface concreta que o descreve.
 *
 * `resources.ts` garante que a operação **existe** nos dois adapters; este mapa
 * é o que garante que ela tem a **mesma assinatura** nos dois. A distinção
 * importa: o tipo `Adapter` derivado do inventário declara cada operação como
 * `(...args: never[]) => Promise<unknown>`, que aceita qualquer coisa — mock e
 * Supabase podiam divergir em parâmetro ou em retorno e ainda compilar, e o
 * `as unknown as` das fachadas fazia o consumidor confiar numa assinatura
 * garantida apenas por coerção.
 */
export interface ResourceOperations {
  auth: AuthOperations;
  dashboard: DashboardOperations;
  pacientes: PacientesOperations;
  catalogos: CatalogosOperations;
  usuarios: UsuariosOperations;
  permissoes: PermissoesOperations;
  conteudos: ConteudosOperations;
  aprovacoes: AprovacoesOperations;
  auditoria: AuditoriaOperations;
  estatisticasClinicas: EstatisticasClinicasOperations;
  estatisticasOperacionais: EstatisticasOperacionaisOperations;
  configuracoes: ConfiguracoesOperations;
  relatorios: RelatoriosOperations;
}

/**
 * A forma que o bloco `implemented` de cada adapter precisa satisfazer.
 *
 * `Partial` por recurso, e não por adapter: operação **ausente** continua
 * legítima — `buildAdapter` a preenche com o stub NOT_IMPLEMENTED, que é o que
 * mantém o painel explicando em vez de estourando. O que deixa de ser legítimo
 * é operação **presente com assinatura errada**, que era exatamente o que
 * passava.
 *
 * Use com `satisfies`, nunca com anotação de tipo: `satisfies` verifica sem
 * apagar os tipos concretos dos módulos.
 */
export type PartialAdapterModules = {
  [R in keyof ResourceOperations]: Partial<ResourceOperations[R]>;
};

export type { DesafioMfa, ResultadoLogin, Sessao };
export type { DefinicaoRelatorio, ResultadoRelatorio };
export type { Configuracoes, VersaoLegal };
export type { ComparacaoProtocolo, CruzamentoClinico, EstatisticasOperacionais };
export type { AuditoriaListItem, ResumoAuditoria };
export type { KpisResposta, SeriesResposta };
export type { ComparacaoVersoes, ConteudoDetalhe, ConteudoEntrada, ConteudoListItem };
export type { Cid, EfeitoAdverso, Protocolo };
export type { PacienteDetalhe, PacienteEntrada, PacienteListItem };
export type { DistribuicaoEspecialidade, LogAcesso, MatrizPermissoes, UsuarioDetalhe, UsuarioEntrada, UsuarioListItem };
