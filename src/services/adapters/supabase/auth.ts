import type { User } from "@supabase/supabase-js";

import { MFA_REQUIRED } from "@/lib/env";
import { PAPEL, type Papel } from "@/lib/enums";
import { ERROR_CODE, fail, okOne, type SingleResult } from "@/services/contracts";
import type { DesafioMfa, ResultadoLogin, Sessao, UsuarioAutenticado } from "@/types/auth";
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

/** "juliana.fontana@cosc.com.br" → "ju•••••••@cosc.com.br" */
function mascararDestino(email: string): string {
  const [usuario, dominio] = email.split("@");
  if (!usuario || !dominio) return "seu contato cadastrado";
  return `${usuario.slice(0, 2)}${"•".repeat(Math.max(3, usuario.length - 2))}@${dominio}`;
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
      `Este acesso exige um aplicativo autenticador, e ${mascararDestino(perfil.email)} ainda não tem um cadastrado. Procure um administrador da clínica.`,
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
 * O cliente é criado com `persistSession: false` — a sessão não vai para
 * `localStorage`, onde qualquer script da página a leria. O preço é que
 * recarregar encerra a sessão, e é o comportamento pretendido nesta fase.
 * Enquanto a aba viver, esta função devolve a sessão em curso.
 */
export async function getSession(): Promise<SingleResult<Sessao>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient().auth.getSession();

    if (error) return falhaDe(error);
    if (!data.session) return okOne<Sessao>(null);

    const perfil = await carregarPerfil(data.session.user);
    if ("error" in perfil) return okOne<Sessao>(null);

    return okOne(montarSessao(data.session, perfil));
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
}: {
  email: string;
}): Promise<SingleResult<{ enviado: true }>> {
  return executar(async () => {
    await getSupabaseClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/nova-senha`,
    });

    return okOne({ enviado: true as const });
  });
}

/**
 * O `token` é o `token_hash` que veio no link do e-mail. Como o cliente é
 * criado com `detectSessionInUrl: false`, ele não é consumido sozinho: a troca
 * por sessão de recuperação é explícita, e só então a senha pode mudar.
 */
export async function resetPassword({
  token,
  senha,
}: {
  token: string;
  senha: string;
}): Promise<SingleResult<{ alterada: true }>> {
  return executar(async () => {
    if (!token) return fail(ERROR_CODE.VALIDATION, "Link inválido ou expirado.");

    const supabase = getSupabaseClient();

    const { error: erroToken } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: "recovery",
    });
    if (erroToken) return fail(ERROR_CODE.VALIDATION, "Link inválido ou expirado.");

    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) return falhaDe(error);

    return okOne({ alterada: true as const });
  });
}
