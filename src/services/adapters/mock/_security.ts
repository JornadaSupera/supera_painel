/**
 * O ESTADO DE SEGURANÇA QUE OS DOIS MOCKS COMPARTILHAM.
 * =============================================================================
 * No backend real são duas coisas distintas, lidas de lugares distintos: o
 * nível de garantia vem do JWT, e a exigência vem de uma tabela de uma linha.
 * O mock não tem nem JWT nem tabela, e precisa das duas para exercitar o
 * comportamento que importa — o de uma sessão que entra e não enxerga nada.
 *
 * Elas vivem aqui, e não dentro de `auth` ou de `configuracoes`, porque as duas
 * telas fazem perguntas diferentes sobre o MESMO estado: o login decide o nível
 * da sessão, a tela de configurações decide a exigência, e a checagem de
 * garantia cruza os dois. Duas cópias divergiriam no primeiro teste manual.
 *
 * Nada aqui é persistido: recarregar a aba devolve o padrão, como acontece com
 * a sessão do mock.
 */

/** O nível que a sessão em curso alcançou. */
let nivelDaSessao: "aal1" | "aal2" = "aal1";

/**
 * A exigência começa DESLIGADA, como no banco.
 *
 * Nascer ligada faria o mock recusar o login de desenvolvimento antes de
 * alguém conseguir olhar a tela — que é exatamente o acidente que a migration
 * do backend evita pela mesma razão.
 */
let exigeMfa = false;

/** Quando e por quem o interruptor foi mexido. `null` = valor de nascimento. */
let mexidoEm: string | null = null;
let mexidoPor: string | null = null;

export function nivelAtual(): "aal1" | "aal2" {
  return nivelDaSessao;
}

/** Chamado pelo login: com o segundo fator verificado, a sessão sobe de nível. */
export function registrarNivel(nivel: "aal1" | "aal2"): void {
  nivelDaSessao = nivel;
}

export function exigenciaDeMfa(): boolean {
  return exigeMfa;
}

export function estadoDaSeguranca(): {
  exige_mfa: boolean;
  atualizado_em: string | null;
  atualizado_por: string | null;
} {
  return { exige_mfa: exigeMfa, atualizado_em: mexidoEm, atualizado_por: mexidoPor };
}

/** Quem mexeu no interruptor — o mock guarda o nome, o banco guarda a conta. */
export function definirExigenciaDeMfa(exigir: boolean, autor: string | null): void {
  exigeMfa = exigir;
  mexidoEm = new Date().toISOString();
  mexidoPor = autor;
}
