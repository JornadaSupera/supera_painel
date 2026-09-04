import type { Especialidade, Papel } from "@/lib/enums";
import type { Permissao } from "@/lib/rbac";

/**
 * Tipos de autenticação e sessão.
 *
 * Os nomes de campo seguem as colunas da futura tabela `usuarios` no Postgres
 * (`snake_case`), para que a Fase 15 não precise de camada de tradução.
 */

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  especialidade: Especialidade | null;
  /** CRM, CRF, COREN… conforme a especialidade. */
  registro: string | null;
  avatar_url: string | null;
  mfa_ativo: boolean;
  horario_inicio: string | null;
  horario_fim: string | null;
  /** Permissões concedidas individualmente, além das do papel (Fase 6). */
  permissoes_extras: Permissao[];
}

export interface Sessao {
  usuario: UsuarioAutenticado;
  /**
   * Só em memória. Nunca em `localStorage` nem em `sessionStorage`: qualquer
   * script da página lê esses armazenamentos, inclusive um XSS vindo do editor
   * de conteúdo. A Fase 15 troca por cookie `httpOnly` + refresh.
   */
  token: string;
  /** ISO 8601 UTC. */
  expira_em: string;
}

/** Resultado de `signIn`: o segundo fator é obrigatório e vem sempre. */
export interface DesafioMfa {
  /** Identifica a tentativa de login em curso. Curta duração. */
  desafio_id: string;
  /** Para onde o código foi enviado, já mascarado. */
  destino: string;
  metodo: "totp" | "sms";
  expira_em: string;
}

/**
 * Resultado de `signIn`.
 *
 * Duas saídas possíveis, e exatamente uma acontece: ou o acesso pede o segundo
 * fator, ou já entrega a sessão. Modelar como união — em vez de um campo
 * opcional — obriga quem consome a tratar os dois casos, e impede que a
 * ausência do segundo fator passe despercebida como `undefined`.
 */
export type ResultadoLogin =
  | { mfa: DesafioMfa; sessao?: never }
  | { mfa?: never; sessao: Sessao };
