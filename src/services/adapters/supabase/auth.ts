import type { AuthError, User } from "@supabase/supabase-js";

import { MFA_REQUIRED } from "@/lib/env";
import { PAPEL, type Papel } from "@/lib/enums";
import { ERROR_CODE, fail, okOne, type SingleResult } from "@/services/contracts";
import type {
  PasswordRecoveryInput,
  PasswordResetRequest,
  RecoveryCredential,
} from "@/services/contracts/operations";
import type {
  DesafioMfa,
  GarantiaDaSessao,
  ResultadoLogin,
  Sessao,
  UsuarioAutenticado,
} from "@/types/auth";
import { maskDestination } from "../_people";
import { executar, falhaDe, umDe } from "./_helpers";
import { getSupabaseClient } from "./client";
import { paraEspecialidade } from "./mapping";

/**
 * Autenticação — Supabase Auth (GoTrue).
 *
 * O fluxo do contrato é `signIn → segundo fator → sessão`, e é o que o painel
 * expõe. O que muda em relação ao mock é de onde vem cada pedaço:
 *
 *   signIn      → auth.signInWithPassword + auth.mfa.challenge
 *   verifyMfa   → auth.mfa.verify, e só então o painel considera logado
 *   perfil      → accounts × admins × professionals
 *
 * > [!] `signInWithPassword` já cria uma sessão, de nível `aal1`.
 * O painel não a considera válida: o `AuthContext` só guarda a sessão depois de
 * `verifyMfa`. Quem fechar a tela do segundo fator fica com uma sessão do
 * GoTrue sem acesso a tela nenhuma do painel — e o projeto tem
 * *Limit duration of AAL1 sessions* ligado, então ela cai sozinha em 15
 * minutos.
 */

/* -------------------------------------------------------------------------
   PERFIL DA SESSÃO
   ------------------------------------------------------------------------- */

interface LinhaPerfil {
  id: string;
  full_name: string | null;
  email: string;
  is_active: boolean;
  // Objeto, não array: `account_id` é único nas duas tabelas. Ver `umDe`.
  admins: { is_active: boolean } | null;
  professionals: {
    is_active: boolean;
    council_registration: string | null;
    professional_specialties: {
      is_primary: boolean;
      ended_at: string | null;
      specialties: { code: string } | { code: string }[] | null;
    }[] | null;
  } | null;
}

const SELECT_PERFIL = `
  id,
  full_name,
  email,
  is_active,
  admins ( is_active ),
  professionals (
    is_active,
    council_registration,
    professional_specialties ( is_primary, ended_at, specialties ( code ) )
  )
`;

/**
 * Quem é o usuário da sessão.
 *
 * Conta autentica; perfil diz o que ela é. Sem perfil concedido — o intervalo
 * entre o convite e a confirmação do e-mail — não há painel a entregar, e
 * dizer isso é melhor do que deixar a pessoa entrar numa tela vazia.
 */
async function carregarPerfil(
  user: User,
): Promise<UsuarioAutenticado | ReturnType<typeof fail> | ReturnType<typeof falhaDe>> {
  const { data, error } = await getSupabaseClient()
    .from("accounts")
    .select(SELECT_PERFIL)
    .eq("id", user.id)
    .maybeSingle();

  if (error) return falhaDe(error);
  if (!data) return fail(ERROR_CODE.FORBIDDEN, "Esta conta não tem acesso ao painel.");

  const linha = data as unknown as LinhaPerfil;
  const admin = umDe(linha.admins);
  const profissional = umDe(linha.professionals);

  if (!admin && !profissional) {
    return fail(
      ERROR_CODE.FORBIDDEN,
      "Esta conta ainda não tem perfil concedido. Procure um administrador da clínica.",
    );
  }

  // A regra dos dois `is_active`: conta ativa E perfil ativo.
  const perfilAtivo = admin ? admin.is_active : (profissional?.is_active ?? false);
  if (!linha.is_active || !perfilAtivo) {
    return fail(
      ERROR_CODE.FORBIDDEN,
      "Este acesso está indisponível. Procure um administrador da clínica.",
    );
  }

  const papel: Papel = admin ? PAPEL.ADMIN : PAPEL.PROFISSIONAL;
  const vinculos = (profissional?.professional_specialties ?? []).filter(
    (vinculo) => !vinculo.ended_at,
  );
  const vinculo = vinculos.find((item) => item.is_primary) ?? vinculos[0];

  return {
    id: linha.id,
    nome: linha.full_name?.trim() || linha.email,
    email: linha.email,
    papel,
    especialidade: paraEspecialidade(umDe(vinculo?.specialties)?.code),
    registro: profissional?.council_registration ?? null,
    avatar_url: null,
    mfa_ativo: true,
    horario_inicio: null,
    horario_fim: null,
    // O catálogo de permissões do banco está vazio: nada concede permissão
    // individual ainda, e inventar uma aqui contradiria o `<Can>` da tela.
    permissoes_extras: [],
  };
}

/**
 * Só o que o painel precisa de uma sessão do GoTrue.
 *
 * `getSession` devolve uma `Session` completa, mas `mfa.verify` devolve o par
 * de tokens com `expires_in` e sem `expires_at` — tratar as duas como o mesmo
 * tipo é o que faz a sessão nascer vencida.
 */
interface SessaoDoGoTrue {
  access_token: string;
  expires_at?: number;
  expires_in?: number;
}

/** Uma hora, quando o GoTrue não informa validade. É o padrão do projeto. */
const VALIDADE_PADRAO_MS = 60 * 60_000;

function montarSessao(sessao: SessaoDoGoTrue, usuario: UsuarioAutenticado): Sessao {
  /*
   * O vencimento vem em um de dois formatos, e faltando os dois a sessão NÃO
   * pode nascer com data zero: o `AuthContext` compara `expira_em` com o
   * relógio a cada 15 s e deslogaria na primeira checagem.
   */
  const vencimento =
    sessao.expires_at != null
      ? sessao.expires_at * 1000
      : sessao.expires_in != null
        ? Date.now() + sessao.expires_in * 1000
        : Date.now() + VALIDADE_PADRAO_MS;

  return {
    usuario,
    token: sessao.access_token,
    expira_em: new Date(vencimento).toISOString(),
  };
}

/* -------------------------------------------------------------------------
   SEGUNDO FATOR
   -------------------------------------------------------------------------
   O `desafio_id` do contrato é opaco para a tela, o que deixa este adapter
   escolher o que guardar dentro dele. Aqui ele carrega o par que o GoTrue
   exige em `mfa.verify` — o fator e o desafio — separados por `|`.
   ------------------------------------------------------------------------- */

function montarDesafio(factorId: string, challengeId: string): string {
  return `${factorId}|${challengeId}`;
}

/* -------------------------------------------------------------------------
   LOGIN
   ------------------------------------------------------------------------- */

export async function signIn({
  email,
  senha,
}: {
  email: string;
  senha: string;
}): Promise<SingleResult<ResultadoLogin>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });

    // Mensagem idêntica para e-mail inexistente e senha errada: diferenciar as
    // duas entrega ao atacante uma lista de e-mails válidos da clínica. O
    // GoTrue já responde assim, e o mapeamento preserva o comportamento.
    if (error) {
      if (error.status === 400) return fail(ERROR_CODE.UNAUTHORIZED, "E-mail ou senha inválidos.");
      return falhaDe(error);
    }
    if (!data.user) return fail(ERROR_CODE.UNAUTHORIZED, "E-mail ou senha inválidos.");

    // O perfil é conferido ANTES do segundo fator: conta desativada não deve
    // consumir um código de autenticador para só então descobrir que não entra.
    const perfil = await carregarPerfil(data.user);
    if ("error" in perfil) {
      await supabase.auth.signOut();
      return perfil;
    }

    // Segundo fator desligado por configuração: o acesso termina aqui.
    if (!MFA_REQUIRED) {
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session) return fail(ERROR_CODE.UNAUTHORIZED, "Entre novamente.");

      return okOne<ResultadoLogin>({ sessao: montarSessao(sessao.session, perfil) });
    }

    const { data: fatores, error: erroFatores } = await supabase.auth.mfa.listFactors();
    if (erroFatores) return falhaDe(erroFatores);

    const totp = fatores?.totp?.find((fator) => fator.status === "verified");

    if (totp) {
      const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      });
      if (erroDesafio) return falhaDe(erroDesafio);

      return okOne<ResultadoLogin>({
        mfa: {
          desafio_id: montarDesafio(totp.id, desafio.id),
          destino: "seu aplicativo autenticador",
          metodo: "totp",
          expira_em: new Date(Date.now() + 5 * 60_000).toISOString(),
        } satisfies DesafioMfa,
      });
    }

    /*
     * Segundo fator exigido, mas a conta não tem autenticador cadastrado.
     *
     * A recusa acontece aqui, e não na tela do código: mandar a pessoa para uma
     * tela onde nada que ela digitar funciona é pior do que dizer o que falta.
     * O painel ainda não tem tela de cadastro de autenticador — enquanto não
     * tiver, o caminho é o administrador do projeto cadastrar o fator ou
     * desligar a exigência em configuração.
     */
    await supabase.auth.signOut();

    return fail(
      ERROR_CODE.FORBIDDEN,
      `Este acesso exige um aplicativo autenticador, e ${maskDestination(perfil.email)} ainda não tem um cadastrado. Procure um administrador da clínica.`,
    );
  });
}

export async function verifyMfa({
  desafio_id,
  codigo,
}: {
  desafio_id: string;
  codigo: string;
}): Promise<SingleResult<Sessao>> {
  return executar(async () => {
    const supabase = getSupabaseClient();
    const [primeiro, segundo] = desafio_id.split("|");

    if (!primeiro || !segundo) {
      return fail(ERROR_CODE.UNAUTHORIZED, "Nenhum acesso em andamento. Entre novamente.");
    }

    const { data, error } = await supabase.auth.mfa.verify({
      factorId: primeiro,
      challengeId: segundo,
      code: codigo.trim(),
    });

    if (error) {
      if (error.status === 400) return fail(ERROR_CODE.UNAUTHORIZED, "Código inválido.");
      return falhaDe(error);
    }

    const perfil = await carregarPerfil(data.user);
    if ("error" in perfil) return perfil;

    return okOne(montarSessao(data, perfil));
  });
}

/* -------------------------------------------------------------------------
   SESSÃO
   ------------------------------------------------------------------------- */

export async function signOut(): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) return falhaDe(error);

    return okOne(null);
  });
}

/**
 * A sessão restaurada de um recarregamento, ou `null`.
 *
 * > [!] Restaurar NÃO é o mesmo que entrar, e a diferença é o segundo fator.
 * O GoTrue guarda uma sessão de um fator com a mesma validade de uma de dois:
 * quem digitou a senha e fechou a aba antes do código tem um token gravado, e
 * ele volta inteiro no recarregamento. Enquanto a sessão morria junto com a
 * aba, esse estado não sobrevivia para ser restaurado; agora sobrevive, e
 * devolvê-lo como sessão completa transformaria o segundo fator em uma tela
 * que se pula fechando o navegador.
 *
 * Por isso a restauração confere o nível do JWT, e não só a existência do
 * token. Sessão parada em `aal1` com autenticador cadastrado é descartada
 * aqui — quem recarregar volta para o login, que é onde o fluxo recomeça.
 *
 * Conta SEM autenticador cadastrado passa: a exigência não é dela, e barrá-la
 * trancaria do lado de fora justamente quem ainda não tem como cumprir.
 * `getGarantia` é quem trata esse caso, na tela.
 */
export async function getSession(): Promise<SingleResult<Sessao>> {
  return executar(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) return falhaDe(error);
    if (!data.session) return okOne<Sessao>(null);

    if (MFA_REQUIRED) {
      const { data: niveis } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      // `nextLevel === "aal2"` é como o GoTrue diz que há fator verificado.
      const temFator = niveis?.nextLevel === "aal2";
      const cumpriu = niveis?.currentLevel === "aal2";

      if (temFator && !cumpriu) return okOne<Sessao>(null);
    }

    const perfil = await carregarPerfil(data.session.user);
    if ("error" in perfil) return okOne<Sessao>(null);

    return okOne(montarSessao(data.session, perfil));
  });
}

/* -------------------------------------------------------------------------
   MUDANÇAS DE SESSÃO VINDAS DE FORA DA TELA
   -------------------------------------------------------------------------
   Duas coisas acontecem sem que nenhuma tela tenha pedido, e as duas precisam
   chegar ao `AuthContext`:

   1. **O token é renovado sozinho.** `autoRefreshToken` troca o access token
      antes de ele vencer, e o prazo que a tela guarda é o do instante do
      login. Sem ouvir a renovação, o relógio do contexto compara um retrato
      velho com a hora atual e encerra uma sessão que o servidor considera
      válida — o painel deslogaria sozinho depois de uma hora, com a pessoa
      usando.

   2. **A sessão acaba em outra aba.** Sair em uma aba tem que sair em todas;
      com o token compartilhado no armazenamento, a aba que ficou aberta
      continuaria desenhando uma tela que já não tem sessão por trás.
   ------------------------------------------------------------------------- */

export type EventoDeSessao =
  | { tipo: "encerrada" }
  | { tipo: "renovada"; token: string; expira_em: string };

/**
 * Ouve as mudanças e devolve a função que cancela a assinatura.
 *
 * Só os dois eventos acima atravessam. `SIGNED_IN` fica de fora de propósito:
 * ele também dispara na restauração inicial, e o contexto já trata isso em
 * `getSession` — deixá-lo passar faria a entrada acontecer duas vezes, uma
 * delas sem ter conferido o segundo fator.
 */
export function subscribe(listener: (evento: EventoDeSessao) => void): () => void {
  const { data } = getSupabaseClient().auth.onAuthStateChange((evento, sessao) => {
    if (evento === "SIGNED_OUT") {
      listener({ tipo: "encerrada" });
      return;
    }

    if (evento === "TOKEN_REFRESHED" && sessao) {
      listener({
        tipo: "renovada",
        token: sessao.access_token,
        expira_em: new Date(
          sessao.expires_at != null ? sessao.expires_at * 1000 : Date.now() + VALIDADE_PADRAO_MS,
        ).toISOString(),
      });
    }
  });

  return () => data.subscription.unsubscribe();
}

/* -------------------------------------------------------------------------
   GARANTIA DA SESSÃO
   -------------------------------------------------------------------------
   O MODO DE FALHA QUE ESTA FUNÇÃO EXISTE PARA DENUNCIAR.

   Com `require_admin_mfa` ligado no backend, `is_active_admin()` passa a exigir
   `aal2` no JWT. Uma sessão que entrou só com senha continua **válida** — ela
   simplesmente deixa de ser reconhecida como administrador. E o efeito disso
   não é `permission denied`: as políticas de RLS não casam, então a resposta é
   **zero linhas, sem erro**, em toda tela ao mesmo tempo. Pacientes vazio,
   trilha vazia, catálogos vazios.

   Quem operasse o painel nesse estado concluiria que a clínica perdeu os dados.

   COMO DESCOBRIR QUE É ISSO, e não uma base realmente vazia:

     nível da sessão  → `auth.mfa.getAuthenticatorAssuranceLevel()`, do GoTrue,
                        que lê o próprio JWT e não depende do banco
     exigência        → `security_settings`, que só o administrador lê

   E aqui há uma circularidade que precisa ser dita: **quando a exigência está
   ligada e a sessão não a cumpre, a leitura de `security_settings` também volta
   vazia** — é a mesma política. Ou seja, no exato caso que interessa, não dá
   para perguntar "está exigindo?".

   A saída é inferir, e a inferência é sólida: se o perfil diz administrador, a
   conta está ativa e mesmo assim a configuração de segurança não vem, então
   `is_active_admin()` devolveu falso — e a única condição dela que não depende
   de conta ativa é justamente o segundo fator.
   ------------------------------------------------------------------------- */

export async function getGarantia(): Promise<SingleResult<GarantiaDaSessao>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) return fail(ERROR_CODE.UNAUTHORIZED, "Entre novamente.");

    const { data: niveis, error: erroNivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (erroNivel) return falhaDe(erroNivel);

    // `currentLevel` nulo só acontece sem sessão, que já foi descartado acima.
    const nivel = niveis?.currentLevel === "aal2" ? "aal2" : "aal1";

    /*
     * `nextLevel` é o nível que a conta PODE alcançar. Ele vira `aal2` quando
     * há fator verificado — é a forma que o GoTrue tem de dizer "esta pessoa
     * tem autenticador". Com a sessão já em `aal2`, os dois são iguais, e o
     * fator existe por construção.
     */
    const fator_cadastrado = niveis?.nextLevel === "aal2";

    const perfil = await carregarPerfil(sessao.session.user);
    if ("error" in perfil) return perfil;

    // Só o administrador lê a configuração de segurança. Para o profissional a
    // exigência não se aplica, e não saber dela é a resposta correta.
    if (perfil.papel !== PAPEL.ADMIN) {
      return okOne<GarantiaDaSessao>({
        nivel,
        exigido: null,
        suficiente: true,
        fator_cadastrado,
      });
    }

    const { data, error } = await supabase
      .from("security_settings")
      .select("require_admin_mfa")
      .maybeSingle();

    // Erro de verdade (rede, servidor) não vira "está tudo bem": sem saber, o
    // painel não pode afirmar que a sessão basta.
    if (error) return falhaDe(error);

    if (data) {
      const exigido = (data as { require_admin_mfa: boolean }).require_admin_mfa;

      return okOne<GarantiaDaSessao>({
        nivel,
        exigido,
        suficiente: !exigido || nivel === "aal2",
        fator_cadastrado,
      });
    }

    /*
     * Administrador ativo que NÃO lê a configuração de segurança.
     *
     * É a circularidade descrita no cabeçalho, e ela só tem uma explicação: a
     * exigência está ligada e esta sessão não a cumpre. Vale reparar que o
     * caminho é inalcançável em `aal2` — se fosse, a política teria deixado
     * passar.
     */
    return okOne<GarantiaDaSessao>({
      nivel,
      exigido: true,
      suficiente: false,
      fator_cadastrado,
    });
  });
}

/* -------------------------------------------------------------------------
   RECUPERAÇÃO DE SENHA
   ------------------------------------------------------------------------- */

/**
 * Sempre responde sucesso, exista ou não o e-mail. Responder "e-mail não
 * encontrado" transforma esta tela num verificador de contas válidas.
 */
export async function requestPasswordReset({
  email,
}: PasswordResetRequest): Promise<SingleResult<{ enviado: true }>> {
  return executar(async () => {
    await getSupabaseClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/nova-senha`,
    });

    return okOne({ enviado: true as const });
  });
}

/* -------------------------------------------------------------------------
   RECOVERY FOR APP ACCOUNTS
   -------------------------------------------------------------------------
   Patients and caregivers reset their password on this domain, but they are
   not panel users. The recovery session exists only long enough to call
   `updateUser`, lives in this tab's memory (`persistSession: false`) and is
   discarded right after — nothing here reaches `AuthContext`.
   ------------------------------------------------------------------------- */

const LINK_SPENT = "Este link expirou ou já foi usado.";

/** Password refusals the person can fix by choosing another one. */
const PASSWORD_REFUSALS: Record<string, string> = {
  weak_password: "O servidor recusou esta senha por ser fraca. Escolha outra.",
  same_password: "A nova senha precisa ser diferente da anterior.",
};

/**
 * The credential already exchanged in this tab. A refused password consumes
 * the link on the first attempt, so a retry must reuse the session it opened
 * instead of verifying a token that no longer exists.
 */
let exchangedCredential: string | null = null;

function credentialKey(credential: RecoveryCredential): string {
  switch (credential.kind) {
    case "token_hash":
      return credential.token_hash;
    // The code repeats across accounts; only the pair identifies this link.
    case "otp":
      return `${credential.email}:${credential.token}`;
    case "session":
      return credential.access_token;
  }
}

/**
 * Turns the proof from the link into a recovery session on this tab.
 *
 * Each shape has exactly one call that verifies it — see `RecoveryCredential`.
 * Handing the bare code to `token_hash` is the defect this replaced: it fails
 * for every link, and the failure looks identical to an expired one.
 */
async function exchangeCredential(
  credential: RecoveryCredential,
): Promise<{ error: AuthError | null }> {
  const supabase = getSupabaseClient();

  switch (credential.kind) {
    case "token_hash":
      return supabase.auth.verifyOtp({ token_hash: credential.token_hash, type: "recovery" });
    case "otp":
      return supabase.auth.verifyOtp({
        email: credential.email,
        token: credential.token,
        type: "recovery",
      });
    case "session":
      return supabase.auth.setSession({
        access_token: credential.access_token,
        refresh_token: credential.refresh_token,
      });
  }
}

async function discardRecoverySession(): Promise<void> {
  exchangedCredential = null;

  try {
    // Local scope: ends this tab's recovery session without signing the
    // person out of the app on their phone.
    await getSupabaseClient().auth.signOut({ scope: "local" });
  } catch {
    // The session dies with the tab anyway; failing here must not turn a
    // changed password into an error screen.
  }
}

export async function completePasswordRecovery({
  credential,
  password,
}: PasswordRecoveryInput): Promise<SingleResult<{ changed: true }>> {
  return executar(async () => {
    const supabase = getSupabaseClient();
    const key = credentialKey(credential);

    if (exchangedCredential !== key) {
      const { error } = await exchangeCredential(credential);

      if (error) {
        await discardRecoverySession();
        if (error.status === 429) return fail(ERROR_CODE.RATE_LIMITED);
        return fail(ERROR_CODE.UNAUTHORIZED, LINK_SPENT);
      }

      exchangedCredential = key;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      const refusal = error.code ? PASSWORD_REFUSALS[error.code] : undefined;
      if (refusal) return fail(ERROR_CODE.VALIDATION, refusal);

      if (error.status === 429) return fail(ERROR_CODE.RATE_LIMITED);

      // The recovery session expired or was revoked while the form was open.
      if (error.status === 401 || error.status === 403 || error.code === "session_not_found") {
        await discardRecoverySession();
        return fail(ERROR_CODE.UNAUTHORIZED, LINK_SPENT);
      }

      return falhaDe(error);
    }

    await discardRecoverySession();
    return okOne({ changed: true as const });
  });
}
