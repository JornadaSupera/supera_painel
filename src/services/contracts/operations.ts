import type { Papel, Periodo, StatusUsuario } from "@/lib/enums";
import type { Permissao } from "@/lib/rbac";
import type { KpisResposta, SeriesResposta } from "@/types/dashboard";
import type { DesafioMfa, ResultadoLogin, Sessao } from "@/types/auth";
import type { AuditoriaListItem, ResumoAuditoria } from "@/types/auditoria";
import type { Cid, EfeitoAdverso, Protocolo } from "@/types/catalogo";
import type { Configuracoes, VersaoLegal } from "@/types/configuracao";
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
  PacienteDetalhe,
  PacienteEntrada,
  PacienteListItem,
  PiiRevelada,
  ResultadoConvite,
} from "@/types/paciente";
import type {
  DistribuicaoEspecialidade,
  LogAcesso,
  MatrizPermissoes,
  UsuarioDetalhe,
  UsuarioEntrada,
  UsuarioListItem,
} from "@/types/usuario";
import type { ListParams, ListResult, SingleResult } from "./index";

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

export interface AuthOperations {
  /** Nunca devolve sessão direto: o segundo fator é obrigatório. */
  signIn(params: { email: string; senha: string }): Promise<SingleResult<ResultadoLogin>>;

  verifyMfa(params: { desafio_id: string; codigo: string }): Promise<SingleResult<Sessao>>;

  signOut(): Promise<SingleResult<null>>;

  /** `null` enquanto a sessão viver só em memória — ver `adapters/mock/auth.ts`. */
  getSession(): Promise<SingleResult<Sessao>>;

  /** Responde sucesso mesmo para e-mail inexistente, por design. */
  requestPasswordReset(params: { email: string }): Promise<SingleResult<{ enviado: true }>>;

  resetPassword(params: { token: string; senha: string }): Promise<SingleResult<{ alterada: true }>>;
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
}

export interface CatalogosOperations {
  listCids(): Promise<ListResult<Cid>>;
  listProtocolos(): Promise<ListResult<Protocolo>>;
  listEspecialidades(): Promise<ListResult<{ value: string; label: string }>>;
  listEfeitos(): Promise<ListResult<EfeitoAdverso>>;
}

/* ---------------------------------------------------------------- Fase 6 */

export interface UsuariosOperations {
  /** Filtros aceitos: `papel`, `especialidade`, `status`. Busca: nome, e-mail, registro. */
  list(params?: ListParams): Promise<ListResult<UsuarioListItem>>;

  getById(params: { id: string }): Promise<SingleResult<UsuarioDetalhe>>;

  create(params: UsuarioEntrada): Promise<SingleResult<UsuarioDetalhe>>;

  update(params: { id: string; dados: Partial<UsuarioEntrada> }): Promise<SingleResult<UsuarioDetalhe>>;

  /** Ativar, pausar ou inativar. Pausar mantém o vínculo e suspende o acesso. */
  setStatus(params: { id: string; status: StatusUsuario }): Promise<SingleResult<UsuarioDetalhe>>;

  /** Dispara o e-mail de redefinição. O painel nunca escolhe senha de ninguém. */
  resetPassword(params: { id: string }): Promise<SingleResult<{ enviado: true; destino: string }>>;

  /** Liga ou desliga o segundo fator. Desligar exige justificativa. */
  setMfa(params: { id: string; ativo: boolean; motivo?: string }): Promise<SingleResult<UsuarioDetalhe>>;

  listAccessLogs(params: { id: string } & ListParams): Promise<ListResult<LogAcesso>>;

  getDistribuicao(): Promise<ListResult<DistribuicaoEspecialidade>>;
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

  /** Linhas achatadas do RECORTE inteiro, não da página aberta. */
  export(params?: ListParams): Promise<ListResult<Record<string, string>>>;
}

/* ----------------------------------------------------------- Fases 12 e 13 */

/** Recorte do cruzamento clínico. O protótipo abre em 90 dias, grau 2, ativos. */
export interface FiltroClinico {
  grauMinimo?: number;
  dias?: number;
  apenasAtivos?: boolean;
}

export interface EstatisticasClinicasOperations {
  /** Protocolo × Efeito × Grau, contado por PACIENTE distinto. */
  crossTab(params?: FiltroClinico): Promise<SingleResult<CruzamentoClinico>>;

  /** O mesmo dado — o mapa de calor é a forma de desenhá-lo. */
  heatmap(params?: FiltroClinico): Promise<SingleResult<CruzamentoClinico>>;

  compareProtocolos(params?: FiltroClinico): Promise<ListResult<ComparacaoProtocolo>>;
}

export interface EstatisticasOperacionaisOperations {
  /** Indicadores, tabela por especialidade e série mensal, de uma leitura só. */
  getIndicadores(): Promise<SingleResult<EstatisticasOperacionais>>;

  getTempoResposta(): Promise<SingleResult<IndicadorOperacional>>;
  getAdesaoAgenda(): Promise<ListResult<LinhaEspecialidade>>;
  getGargalos(): Promise<ListResult<PontoVolume>>;

  /** Sem origem no banco: não há tabela de alerta nem regra de criticidade. */
  getFilaAlertas(): Promise<ListResult<never>>;
}

/* ---------------------------------------------------------------- Fase 9 */

export interface ConfiguracoesOperations {
  /** Catálogos em vigor, mais a lista do que ainda não é dado do backend. */
  get(): Promise<SingleResult<Configuracoes>>;

  /** Termos e política, todas as versões — o histórico é exigência de aceite. */
  getTermos(): Promise<ListResult<VersaoLegal>>;

  /** As três recusam: catálogo do sistema muda por migração, não por formulário. */
  update(params: Partial<Configuracoes>): Promise<SingleResult<Configuracoes>>;
  uploadLogo(params: { arquivo: File }): Promise<SingleResult<{ url: string }>>;
  publishTermos(params: { id: string }): Promise<SingleResult<VersaoLegal>>;
}

/* ---------------------------------------------------------------- Fase 8 */

export interface RelatoriosOperations {
  /** O catálogo dos doze, cada um sabendo se consegue rodar e por que não. */
  listDefinitions(): Promise<ListResult<DefinicaoRelatorio>>;

  /** Roda um relatório: devolve colunas descritas e linhas achatadas. */
  run(params: { slug: string; dias?: number }): Promise<SingleResult<ResultadoRelatorio>>;

  export(params: { slug: string; dias?: number }): Promise<ListResult<Record<string, string>>>;

  /** As três dependem de rotina agendada e tabela de token — ainda não existem. */
  schedule(params: { slug: string; email: string }): Promise<SingleResult<never>>;
  listSchedules(): Promise<ListResult<never>>;
  createShareLink(params: { slug: string }): Promise<SingleResult<never>>;
}

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
