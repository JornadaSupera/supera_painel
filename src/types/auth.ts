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
   * The GoTrue access token. With the Supabase adapter the client keeps it in
   * browser storage so a reload does not end the session — a recorded trade,
   * see `adapters/supabase/client.ts` — which also means every tab of the
   * profile shares it. Nothing else about the session, and nothing about a
   * patient, is written to the browser.
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

/**
 * O nível de garantia da sessão, confrontado com o que o backend exige.
 *
 * Existe por causa de um modo de falha **silencioso**. Quando o backend passa a
 * exigir segundo fator do perfil administrativo, uma sessão que entrou só com
 * senha deixa de ser reconhecida como administrador — e o efeito não é uma
 * mensagem de erro: é **lista vazia em toda tela**, sem aviso nenhum. Pacientes
 * zero, trilha vazia, catálogos vazios. Uma clínica em branco.
 *
 * Sem esta checagem, quem operasse o painel concluiria que perdeu os dados.
 */
export interface GarantiaDaSessao {
  /** `aal1` = só senha. `aal2` = segundo fator verificado nesta sessão. */
  nivel: "aal1" | "aal2";
  /**
   * O backend exige segundo fator do perfil administrativo.
   *
   * `null` quando não dá para saber — é o caso de quem não é administrador, que
   * legitimamente não lê a configuração de segurança. Não confundir com
   * `false`: "não exige" e "não consegui perguntar" levam a telas diferentes.
   */
  exigido: boolean | null;
  /** A sessão atende ao que o backend exige. É o que decide se o painel abre. */
  suficiente: boolean;
  /**
   * A conta tem autenticador cadastrado e verificado.
   *
   * Muda o texto da recusa por inteiro: quem tem fator precisa **entrar de
   * novo**; quem não tem precisa **cadastrar um**, o que a própria tela da
   * recusa oferece.
   */
  fator_cadastrado: boolean;
}

/**
 * O segundo fator da PRÓPRIA conta, para a tela de segurança.
 *
 * Só o titular vê e mexe: o de outra pessoa não passa por aqui.
 */
export interface EstadoSegundoFator {
  cadastrado: boolean;
  /** O que se remove. `null` sem autenticador. */
  fator_id: string | null;
  cadastrado_em: string | null;
}

/**
 * O que o aplicativo autenticador precisa para registrar a conta.
 *
 * O fator nasce **não verificado**: só vale depois de a pessoa digitar um
 * código gerado por ele, e é essa prova que o eleva a autenticador da conta.
 */
export interface CadastroTotp {
  fator_id: string;
  /** O QR code, como SVG em `data:` — a política de conteúdo do painel aceita. */
  qr_code: string;
  /** O mesmo segredo em texto, para quem não consegue apontar a câmera. */
  segredo: string;
}
