import type { Papel, Periodo, StatusUsuario } from "@/lib/enums";
import type { Permissao } from "@/lib/rbac";
import type { KpisResposta, SeriesResposta } from "@/types/dashboard";
import type { DesafioMfa, ResultadoLogin, Sessao } from "@/types/auth";
import type { Cid, EfeitoAdverso, Protocolo } from "@/types/catalogo";
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

export type { DesafioMfa, ResultadoLogin, Sessao };
export type { KpisResposta, SeriesResposta };
export type { Cid, EfeitoAdverso, Protocolo };
export type { PacienteDetalhe, PacienteEntrada, PacienteListItem };
export type { DistribuicaoEspecialidade, LogAcesso, MatrizPermissoes, UsuarioDetalhe, UsuarioEntrada, UsuarioListItem };
