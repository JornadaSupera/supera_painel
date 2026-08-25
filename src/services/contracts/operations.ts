import type { Periodo } from "@/lib/enums";
import type { KpisResposta, SeriesResposta } from "@/types/dashboard";
import type { DesafioMfa, ResultadoLogin, Sessao } from "@/types/auth";
import type { SingleResult } from "./index";

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

export type { DesafioMfa, ResultadoLogin, Sessao };
export type { KpisResposta, SeriesResposta };
