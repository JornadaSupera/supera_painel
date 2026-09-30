import type {
  CondutaAlerta,
  Especialidade,
  FaseTratamento,
  Periodo,
  StatusAlerta,
  StatusUsuario,
  VocabularioTermo,
} from "@/lib/enums";
import type { KpisResposta, SeriesResposta } from "@/types/dashboard";
import type {
  CadastroTotp,
  DesafioMfa,
  EstadoSegundoFator,
  GarantiaDaSessao,
  ResultadoLogin,
  Sessao,
} from "@/types/auth";
import type { AuditoriaListItem, FacetasAuditoria, ResumoAuditoria } from "@/types/auditoria";
import type { Cid, EfeitoAdverso, Protocolo } from "@/types/catalogo";
import type { AlertaClinico, CompromissoAgenda, ConversaClinico, MensagemClinico } from "@/types/clinico";
import type { SatisfactionResponse, SatisfactionSummary } from "@/types/satisfaction";
import type { AppointmentTypeOption, BusinessHour, PersonalBlock, PersonalBlockInput } from "@/types/agenda";
import type { ConversationAssignment, TransferTarget } from "@/types/conversation-transfer";
import type { DiarySymptom, PatientTimeline } from "@/types/patient-record";
import type {
  ClinicaConfiguracao,
  ConfiguracaoSeguranca,
  Configuracoes,
  Consentimento,
  IntervaloAtendimento,
  ItemCatalogo,
  MotivoSituacao,
  RegraAlerta,
  SlideOnboarding,
  SolicitacaoTitular,
  VersaoLegal,
  VinculoExterno,
} from "@/types/configuracao";
import type {
  AgendamentoRelatorio,
  AgendamentoRelatorioEntrada,
  DefinicaoRelatorio,
  ExecucaoRelatorio,
  ResultadoRelatorio,
} from "@/types/relatorio";
import type {
  ComparacaoProtocolo,
  CruzamentoClinico,
  EstatisticasOperacionais,
  FilaDeAlertas,
  IndicadorOperacional,
  LinhaEspecialidade,
  ParametroOperacional,
  PontoVolume,
} from "@/types/estatisticas";
import type {
  ComparacaoVersoes,
  AnexoConteudo,
  CategoriaConteudo,
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

  /**
   * O autenticador (TOTP) da própria conta.
   *
   * Cadastrar, conferir e remover são atos do titular sobre a sessão dele: o
   * banco de identidade só deixa cada pessoa mexer no próprio fator. O de outra
   * conta não tem operação aqui — redefinir o fator de terceiros exige a chave
   * de serviço, que nunca entra no navegador.
   */
  getSegundoFator(): Promise<SingleResult<EstadoSegundoFator>>;
  /**
   * Começa o cadastro: devolve o QR code e o segredo.
   *
   * Descarta antes qualquer tentativa anterior que ficou pela metade — sem
   * isso, abandonar a tela deixaria um fator pendente que trava o próximo
   * cadastro.
   */
  iniciarCadastroTotp(): Promise<SingleResult<CadastroTotp>>;
  /**
   * Confere o primeiro código e ativa o fator. A sessão sobe para dois fatores
   * no mesmo ato, então nada precisa de novo login.
   */
  confirmarCadastroTotp(params: { fator_id: string; codigo: string }): Promise<SingleResult<null>>;
  /** Desiste de um cadastro não concluído. */
  cancelarCadastroTotp(params: { fator_id: string }): Promise<SingleResult<null>>;
  /** Remove o autenticador da própria conta. Exige a sessão já em dois fatores. */
  removerSegundoFator(params: { fator_id: string }): Promise<SingleResult<null>>;

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

  /**
   * Ouve o que muda na sessão sem que nenhuma tela tenha pedido: a renovação
   * automática do token, o encerramento vindo de outra aba e a entrada de
   * outra conta em outra aba.
   *
   * Devolve a função que cancela a assinatura. Síncrona de propósito — é a
   * única operação do contrato que não vai ao servidor, e transformá-la em
   * promessa obrigaria o `AuthContext` a cancelar no desmonte uma assinatura
   * que talvez ainda não existisse.
   */
  subscribe(listener: (evento: EventoDeSessao) => void): () => void;
}

/**
 * O que o `AuthContext` precisa saber quando a sessão muda por fora.
 *
 * Every event that carries a session also carries whose it is. The token is
 * shared by every tab of the browser profile, so a sign-in in another tab
 * swaps the identity behind all of them — and only the context knows which
 * account this tab is drawing, so the context is the one that compares.
 */
export type EventoDeSessao =
  | { tipo: "encerrada" }
  | { tipo: "ativa"; usuario_id: string }
  | { tipo: "renovada"; usuario_id: string; token: string; expira_em: string };

/* ---------------------------------------------------------------- Fase 4 */

export interface DashboardOperations {
  getKpis(params?: { periodo?: Periodo }): Promise<SingleResult<KpisResposta>>;
  getSeries(params?: { periodo?: Periodo }): Promise<SingleResult<SeriesResposta>>;
  /**
   * Declara à trilha que a captura do painel foi exportada, DEPOIS de o arquivo
   * já ter sido gerado no navegador. É o mesmo pedágio que relatórios e lista de
   * pacientes pagam: sem ele a exportação aconteceria e a auditoria não
   * saberia. Uma captura não alcança linha de paciente, então a trilha guarda
   * zero linhas.
   */
  registrarExportacao(params: { formato: "pdf" | "png" }): Promise<SingleResult<null>>;
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
  /**
   * A matriz papel × permissão em vigor, só para leitura.
   *
   * É regra do painel (`lib/rbac.ts`), não dado do backend: não há operação de
   * escrita porque não há onde gravá-la. A exceção por pessoa é outro eixo —
   * `usuarios.grantPermission`.
   */
  getMatrix(): Promise<SingleResult<MatrizPermissoes>>;
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

  /**
   * As versões escritas pela própria pessoa, com o estado que o AUTOR precisa
   * ver: o banco devolve uma versão devolvida ao rascunho e arquiva uma rejeitada,
   * e aqui elas voltam como "devolvido" e "rejeitado".
   */
  listMine(params?: ListParams): Promise<ListResult<ConteudoListItem>>;

  /** As categorias ativas da(s) especialidade(s) da pessoa: onde ela pode escrever. */
  listCategories(): Promise<ListResult<CategoriaConteudo>>;

  /**
   * Redigir é do autor, não do revisor: as três exigem perfil de profissional, e
   * o banco recusa quem não é o autor da versão. Editar só vale enquanto a versão
   * é rascunho — depois de enviada, mudar o texto faria o revisor aprovar um
   * texto e publicar outro.
   *
   * `create` nasce sempre como rascunho, da primeira versão de uma orientação
   * nova. Anexo só existe depois: ele pertence à versão.
   */
  create(params: ConteudoEntrada): Promise<SingleResult<ConteudoDetalhe>>;
  update(params: { id: string; dados: Partial<ConteudoEntrada> }): Promise<SingleResult<ConteudoDetalhe>>;
  /** Rascunho → em revisão. É o que faz o texto entrar na fila do administrador. */
  submitForReview(params: { id: string }): Promise<SingleResult<ConteudoDetalhe>>;

  /**
   * Anexos da versão em rascunho: imagem ou PDF.
   *
   * A linha do anexo precisa existir antes do arquivo — é ela que autoriza o
   * upload — e o caminho começa pelo id da versão.
   */
  addAttachment(params: { versaoId: string; arquivo: File }): Promise<SingleResult<AnexoConteudo>>;
  removeAttachment(params: { versaoId: string; anexo: AnexoConteudo }): Promise<SingleResult<null>>;
  /** O conteúdo de um anexo, como arquivo: o navegador só exibe `blob:`. */
  downloadAttachment(params: { caminho: string }): Promise<SingleResult<Blob>>;
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
  /** Código do CID-10, exatamente como no catálogo (`cid10.code`). Recorte do servidor. */
  cid?: string | null;
}

/**
 * Painel clínico — ver PA-07.
 *
 * Cada operação já é recortada pelo profissional da sessão no próprio banco
 * (`private.my_professional_id()`); nenhum parâmetro de "quem sou eu" passa
 * por aqui, e não há como um profissional pedir a agenda de outro por esta
 * via.
 */
export interface ClinicoOperations {
  /** Compromissos do profissional logado, na janela informada. */
  getMinhaAgenda(params: {
    de: string;
    ate: string;
    /**
     * Pula os nomes dos pacientes. Cada nome é uma leitura auditada do paciente,
     * e a visão de mês desenha só horário e tipo — pedir centenas de nomes para
     * não mostrar nenhum seria ruído na trilha.
     */
    semNomes?: boolean;
  }): Promise<ListResult<CompromissoAgenda>>;
  /** Os tipos de compromisso ativos, para filtrar a agenda. */
  listAppointmentTypes(): Promise<ListResult<AppointmentTypeOption>>;
  /** O horário de atendimento da clínica, por dia da semana. */
  listBusinessHours(): Promise<ListResult<BusinessHour>>;
  /** Os bloqueios pessoais que tocam a janela. Só o dono os enxerga. */
  listMyBlocks(params: { from: string; to: string }): Promise<ListResult<PersonalBlock>>;
  createBlock(params: PersonalBlockInput): Promise<SingleResult<PersonalBlock>>;
  updateBlock(params: PersonalBlockInput & { id: string }): Promise<SingleResult<PersonalBlock>>;
  deleteBlock(params: { id: string }): Promise<SingleResult<null>>;

  /**
   * A fila de alertas — compartilhada pela equipe, não recortada por
   * profissional. `status` filtra; sem ele vêm todos.
   */
  listAlertas(params?: {
    status?: StatusAlerta;
    /**
     * Não resolve o nome do paciente. Para quem só CONTA os alertas: cada nome é
     * uma leitura de paciente gravada na trilha, e contar não precisa de nenhum.
     */
    semNomes?: boolean;
  }): Promise<ListResult<AlertaClinico>>;
  /** Assume um alerta em aberto. Exige a permissão `alerts.triage`. */
  assumirAlerta(params: { id: string }): Promise<SingleResult<null>>;
  /**
   * Designa um alerta que já está em atendimento a outro profissional. Exige a
   * permissão `alerts.triage`, e o banco só aceita quem ainda está ativo. O
   * designado recebe uma notificação.
   */
  designarAlerta(params: { id: string; profissionalId: string }): Promise<SingleResult<null>>;
  /** Resolve um alerta assumido, com a conduta tomada. */
  resolverAlerta(params: {
    id: string;
    conduta: CondutaAlerta;
    notas?: string;
  }): Promise<SingleResult<null>>;

  /** As conversas — mesma fila de equipe da fila de alertas. */
  listConversas(): Promise<ListResult<ConversaClinico>>;
  /** Histórico de uma conversa, com os anexos de cada mensagem. */
  listMensagens(params: { conversaId: string }): Promise<ListResult<MensagemClinico>>;
  /**
   * Responde na conversa, com um anexo opcional.
   *
   * A mensagem não volta na resposta: o profissional não lê a tabela direto, só
   * pelas leituras do banco. Quem chama relê a conversa.
   *
   * > [!] Mensagem e anexo não se desfazem.
   * A ordem é mensagem, linha do anexo, arquivo — e o banco não apaga nenhuma
   * das três. Se o arquivo falhar depois de a mensagem sair, o erro diz que a
   * mensagem foi enviada, em vez de convidar a repetir o envio inteiro.
   */
  enviarMensagem(params: {
    conversaId: string;
    corpo: string;
    anexo?: File;
  }): Promise<SingleResult<null>>;
  /** O conteúdo de um anexo. Vem como arquivo, não como link: o navegador só exibe `blob:`. */
  baixarAnexo(params: { caminho: string }): Promise<SingleResult<Blob>>;
  /** Assume uma conversa ainda sem especialidade atribuída. */
  assumirConversa(params: { id: string }): Promise<SingleResult<null>>;
  /** Marca como resolvida uma conversa da própria especialidade. */
  resolverConversa(params: { id: string }): Promise<SingleResult<null>>;
  /** Registra a leitura da conversa por esta conta. */
  marcarConversaLida(params: { id: string }): Promise<SingleResult<null>>;

  /**
   * A linha do tempo de um paciente: diário, alertas, conversas, compromissos,
   * anotações e sinalizações da equipe, do mais recente para trás.
   *
   * O que a especialidade de quem pergunta não pode ler simplesmente não vem: o
   * banco recorta cada fonte, e a tela não tem como saber o que faltou.
   * `days: null` vai até onde as fontes alcançam (um teto por fonte).
   */
  getPatientTimeline(params: {
    patientId: string;
    days: number | null;
  }): Promise<SingleResult<PatientTimeline>>;
  /** Os sintomas de um registro do diário. Lidos sob demanda: é uma chamada por registro. */
  listDiarySymptoms(params: { entryId: string }): Promise<ListResult<DiarySymptom>>;
  /**
   * Grava uma anotação pontual da própria especialidade — texto livre, sem
   * caráter de evolução oficial. A anotação não se edita nem se apaga: corrigir
   * é escrever outra.
   *
   * Com `flagDistress`, sinaliza sofrimento logo em seguida. Se a anotação
   * saiu e a sinalização não, o erro diz isso (`details.noteSaved`).
   */
  addSpecialtyNote(params: {
    patientId: string;
    specialty: Especialidade;
    body: string;
    flagDistress?: boolean;
  }): Promise<SingleResult<{ note_id: string }>>;
  /**
   * Sinaliza sofrimento a partir de uma anotação PRÓPRIA. A equipe vê que houve
   * a sinalização, de qual área e quando — nunca o texto.
   */
  raiseDistressFlag(params: { noteId: string }): Promise<SingleResult<null>>;

  /** Colegas ativos que podem receber uma conversa, sem a própria pessoa. */
  listTransferTargets(): Promise<ListResult<TransferTarget>>;
  /**
   * Encaminha uma conversa da própria área para um colega.
   *
   * O banco escolhe a área de destino pela especialidade do colega, fecha a
   * atribuição atual, abre a nova e grava a mensagem de transição ao paciente —
   * o painel não escreve nenhuma dessas três coisas. Só quem está na área da
   * conversa encaminha, e só enquanto ela está aberta.
   */
  transferConversation(params: {
    conversationId: string;
    toProfessionalId: string;
  }): Promise<SingleResult<null>>;
  /** Quem segurou a conversa e quando, do mais antigo ao mais recente. */
  listConversationAssignments(params: {
    conversationId: string;
  }): Promise<ListResult<ConversationAssignment>>;
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

  /**
   * O volume da fila de alertas: pendentes e em atendimento, só contagem.
   * Tempo até a conduta e desfecho continuam sem origem — dependem de um resumo
   * no banco que não identifique paciente.
   */
  getFilaAlertas(): Promise<SingleResult<FilaDeAlertas>>;
}

/* ---------------------------------------------------------------- Fase 9 */

export interface ConfiguracoesOperations {
  /**
   * Catálogos em vigor, mais a lista do que ainda não é dado do backend.
   *
   * Inclui os termos RETIRADOS: ao contrário de `getMotivos`, a política de
   * leitura destas cinco tabelas não filtra por `ativo`, e é isso que torna
   * `setTermoVocabularioAtivo` reversível pelo painel — não há um estado que
   * só quem administra o banco enxerga.
   */
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

  /**
   * Corrige rótulo e/ou ordem de um termo do vocabulário.
   *
   * `vocabulario` é o nome da tabela (`symptoms`, `notification_types`,
   * `content_categories`, `conversation_subjects`, `appointment_types`) — o
   * mesmo valor que `p_vocabulary` espera, sem tradução no meio. O `código`
   * não está entre os parâmetros porque não é editável: o backend recusa
   * qualquer UPDATE que o altere, e é ele que o diário, os relatórios e os
   * gatilhos de alerta usam para apontar para o mesmo item.
   */
  atualizarTermoVocabulario(params: {
    vocabulario: VocabularioTermo;
    id: string;
    label?: string;
    ordem?: number;
  }): Promise<SingleResult<ItemCatalogo>>;

  /**
   * Retira um termo do vocabulário, ou o reativa — a MESMA função nos dois
   * sentidos, ao contrário de `setMotivoAtivo`.
   *
   * A diferença de `setMotivoAtivo` não é a função, é a tabela: a leitura do
   * vocabulário não filtra por `ativo` (ver `get()`, acima), então um termo
   * retirado continua visível e reversível pelo painel.
   *
   * > [!] `notification_types` pode recusar retirar.
   * Um tipo de notificação não silenciável é obrigatório — o backend recusa
   * desligá-lo (`guard_notification_type`), porque desligar calaria a
   * notificação para todo mundo, sem exceção. A recusa chega como mensagem
   * legível, não como erro genérico.
   */
  setTermoVocabularioAtivo(params: {
    vocabulario: VocabularioTermo;
    id: string;
    ativo: boolean;
  }): Promise<SingleResult<ItemCatalogo>>;

  /** Identidade visual, mensagens e horário — `clinic_settings`, desde 25/09/2026. */
  getClinica(): Promise<SingleResult<ClinicaConfiguracao>>;

  /**
   * Sobe o arquivo e devolve o caminho no bucket `clinic-branding`.
   *
   * Sempre ANTES de `salvarIdentidade`: `set_clinic_branding` recusa um
   * `logoPath` que ainda não existe no bucket — a ordem é sobe, depois grava.
   */
  uploadLogo(params: { arquivo: File }): Promise<SingleResult<{ path: string; url: string }>>;

  /**
   * Salva cor e logo juntos — é uma RPC só, `set_clinic_branding`.
   *
   * `logoPath: null` remove o logo. Não trocar o logo significa reenviar o
   * caminho atual: a função substitui o valor, não mantém o que não veio.
   */
  salvarIdentidade(params: {
    corPrimaria: string;
    corSecundaria: string;
    logoPath: string | null;
  }): Promise<SingleResult<ClinicaConfiguracao>>;

  /** Salva os slides de onboarding e a mensagem fora do horário juntos. */
  salvarMensagens(params: {
    slidesOnboarding: SlideOnboarding[];
    mensagemForaHorario: string | null;
  }): Promise<SingleResult<ClinicaConfiguracao>>;

  /** Substitui a semana inteira — não existe "editar um dia": `set_clinic_business_hours` apaga e recria tudo. */
  salvarHorario(params: {
    fuso: string;
    intervalos: IntervaloAtendimento[];
  }): Promise<SingleResult<ClinicaConfiguracao>>;

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

  /**
   * As linhas de referência do gráfico de volume — `operational_parameters`,
   * desde 25/09/2026. Sempre os mesmos dois códigos fixos (meta mensal e
   * capacidade máxima); a lista vem sem a que ainda não foi cadastrada, não com
   * ela zerada — zero pareceria uma meta real.
   */
  getMetasOperacionais(): Promise<ListResult<ParametroOperacional>>;

  /**
   * Cria ou atualiza uma meta pelo código.
   *
   * `codigo` não é de livre escolha: são os dois que o gráfico de volume
   * desenha (`monthly_appointments_target`, `monthly_appointments_capacity`) —
   * ver `EstatisticasOperacionaisPage`. Chamar de novo com o mesmo código troca
   * o valor; não existe "criar outra meta".
   */
  salvarMetaOperacional(params: {
    codigo: string;
    rotulo: string;
    valor: number;
  }): Promise<SingleResult<ParametroOperacional>>;

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
   * Deferir não é cumprir. Exclusão e revogação de consentimento se executam
   * sozinhas pela rotina agendada; correção pede o passo extra de
   * `completarSolicitacaoTitular`, abaixo. Acesso e portabilidade o titular
   * resolve sozinho, pelo app.
   */
  decidirSolicitacaoTitular(params: {
    id: string;
    deferir: boolean;
    observacao: string;
  }): Promise<SingleResult<SolicitacaoTitular>>;

  /**
   * Marca um pedido de CORREÇÃO como cumprido, depois de o dado já ter sido
   * corrigido fora do painel.
   *
   * > [!] Só serve para `rectification` deferido — `complete_data_subject_request`
   * recusa qualquer outro tipo ou status com `request_not_completable`. Exclusão e
   * revogação de consentimento não passam por aqui: a rotina agendada
   * (`execute-subject-requests`, a cada 5 min) tenta executá-las sozinha assim que
   * são deferidas, e `execucao_erro` avisa quando ela falha — nesse caso o pedido
   * continua `granted`, e o reparo é do responsável pelo banco, não desta operação.
   */
  completarSolicitacaoTitular(params: {
    id: string;
    observacao?: string;
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

  /**
   * Os agendamentos cadastrados — de TODOS os administradores, não só de quem
   * pergunta. A política do banco não filtra por dono: quem cadastrou um
   * agendamento continua vendo os alheios, porque o aviso chega para a
   * clínica, não para uma pessoa.
   */
  listAgendamentos(): Promise<ListResult<AgendamentoRelatorio>>;

  /** Cadastra — sempre entregando à própria conta; não há seletor de destinatário. */
  criarAgendamento(params: AgendamentoRelatorioEntrada): Promise<SingleResult<AgendamentoRelatorio>>;

  /** Substitui o agendamento inteiro — não existe "só trocar o horário". */
  atualizarAgendamento(
    params: AgendamentoRelatorioEntrada & { id: string },
  ): Promise<SingleResult<AgendamentoRelatorio>>;

  /** Pausa ou retoma. Não há como apagar — só a rotina do banco decide os `report_runs`. */
  setAgendamentoAtivo(params: {
    id: string;
    ativo: boolean;
  }): Promise<SingleResult<AgendamentoRelatorio>>;

  /** As últimas gerações — a prova de que a rotina agendada rodou de fato. */
  listExecucoes(): Promise<ListResult<ExecucaoRelatorio>>;

  /**
   * Registra na trilha uma exportação que o navegador acabou de gerar sozinho
   * (o PDF é uma captura da tela, não passa pelo banco). O CSV se registra na
   * própria `export`.
   */
  registrarExportacao(params: {
    slug: string;
    linhas: number;
    formato: "pdf";
  }): Promise<SingleResult<null>>;
}

/**
 * Satisfação dos pacientes: a pesquisa NPS e o que foi respondido.
 *
 * Leitura direta das tabelas da pesquisa, que só a administração enxerga. Nada
 * aqui devolve o nome do paciente: a resposta é atribuível por construção, e
 * quem precisa de mais abre a ficha, onde a leitura fica registrada.
 */
export interface SatisfacaoOperations {
  /**
   * O resumo de um período: nota, distribuição, taxa de resposta e o recorte por
   * momento da jornada. `days: null` vai até onde o banco entrega.
   */
  getSummary(params: { days: number | null }): Promise<SingleResult<SatisfactionSummary>>;

  /**
   * As respostas, da mais recente para a mais antiga.
   *
   * Filtros: `category` (promoter, passive, detractor), `milestone` (código do
   * momento) e `with_comment` (`"yes"`). O período vai em `range`, pela data da
   * resposta.
   */
  list(params?: ListParams): Promise<ListResult<SatisfactionResponse>>;
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
  clinico: ClinicoOperations;
  estatisticasClinicas: EstatisticasClinicasOperations;
  estatisticasOperacionais: EstatisticasOperacionaisOperations;
  configuracoes: ConfiguracoesOperations;
  relatorios: RelatoriosOperations;
  satisfacao: SatisfacaoOperations;
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
