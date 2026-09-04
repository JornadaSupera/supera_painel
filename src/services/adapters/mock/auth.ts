import { MFA_REQUIRED } from "@/lib/env";
import { STATUS_USUARIO } from "@/lib/enums";
import { usuarios } from "@/mocks/usuarios";
import type { UsuarioMock } from "@/mocks/usuarios";
import { ERROR_CODE, fail, okOne, type SingleResult } from "@/services/contracts";
import type { DesafioMfa, ResultadoLogin, Sessao, UsuarioAutenticado } from "@/types/auth";
import { now, simulate, uuid } from "./_helpers";

/**
 * Autenticação mockada.
 *
 * Reproduz o fluxo que o Supabase Auth executará na Fase 15:
 *
 *     signIn(email, senha)  →  desafio de MFA  →  verifyMfa(código)  →  sessão
 *
 * O segundo fator é **obrigatório** e não tem desvio — PDF §5, "Login com
 * segundo fator obrigatório". Um perfil sem MFA configurado ainda passa pelo
 * desafio; a diferença é que o código chega por SMS em vez de TOTP.
 */

/** Código aceito em desenvolvimento. Some junto com o mock, na Fase 15. */
const CODIGO_MFA_MOCK = "000000";

const MFA_VALIDADE_MS = 5 * 60_000;
const SESSAO_VALIDADE_MS = 60 * 60_000;
const MAX_TENTATIVAS_MFA = 5;

interface DesafioEmAberto {
  usuario_id: string;
  expira_em: number;
  tentativas: number;
}

/** Desafios em curso. Em memória, como no servidor seriam efêmeros. */
const desafios = new Map<string, DesafioEmAberto>();

/**
 * Tentativas de login por e-mail, para simular o bloqueio por excesso.
 * No Supabase isso é feito pelo próprio Auth; aqui existe para que a interface
 * de rate limit possa ser construída e testada.
 */
const tentativasPorEmail = new Map<string, { total: number; ultima: number }>();
const MAX_TENTATIVAS_LOGIN = 5;
const JANELA_BLOQUEIO_MS = 15 * 60_000;

function criarSessao(usuario: UsuarioMock): Sessao {
  usuario.ultimo_acesso_em = now();

  return {
    usuario: paraUsuarioAutenticado(usuario),
    token: uuid(),
    expira_em: new Date(Date.now() + SESSAO_VALIDADE_MS).toISOString(),
  };
}

function paraUsuarioAutenticado(usuario: UsuarioMock): UsuarioAutenticado {
  // `senha_mock` e `status` ficam de fora de propósito: o que sai daqui é o
  // que a aplicação pode ver.
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    especialidade: usuario.especialidade,
    registro: usuario.registro,
    avatar_url: usuario.avatar_url,
    mfa_ativo: usuario.mfa_ativo,
    horario_inicio: usuario.horario_inicio,
    horario_fim: usuario.horario_fim,
    permissoes_extras: usuario.permissoes_extras,
  };
}

/** "juliana.fontana@cosc.com.br" → "ju•••••••@cosc.com.br" */
function mascararDestino(email: string): string {
  const [usuario, dominio] = email.split("@");
  if (!usuario || !dominio) return "seu contato cadastrado";
  return `${usuario.slice(0, 2)}${"•".repeat(Math.max(3, usuario.length - 2))}@${dominio}`;
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
  return simulate(() => {
    const chave = email.trim().toLowerCase();
    const registro = tentativasPorEmail.get(chave);

    if (registro && Date.now() - registro.ultima > JANELA_BLOQUEIO_MS) {
      tentativasPorEmail.delete(chave);
    } else if (registro && registro.total >= MAX_TENTATIVAS_LOGIN) {
      return fail(
        ERROR_CODE.RATE_LIMITED,
        "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.",
      );
    }

    const usuario = usuarios.find((u) => u.email.toLowerCase() === chave);
    const credenciaisOk = usuario?.senha_mock === senha;

    // Mensagem idêntica para e-mail inexistente e senha errada. Diferenciar as
    // duas entrega ao atacante uma lista de e-mails válidos da clínica.
    if (!usuario || !credenciaisOk) {
      const atual = tentativasPorEmail.get(chave)?.total ?? 0;
      tentativasPorEmail.set(chave, { total: atual + 1, ultima: Date.now() });

      return fail(ERROR_CODE.UNAUTHORIZED, "E-mail ou senha inválidos.");
    }

    // Conta pausada ou inativa também não revela o motivo exato.
    if (usuario.status !== STATUS_USUARIO.ATIVO) {
      return fail(
        ERROR_CODE.FORBIDDEN,
        "Este acesso está indisponível. Procure um administrador da clínica.",
      );
    }

    tentativasPorEmail.delete(chave);

    // Segundo fator desligado por configuração: o mock entrega a sessão de uma
    // vez, para que os dois adapters respondam a mesma coisa à mesma chave.
    if (!MFA_REQUIRED) {
      return okOne<ResultadoLogin>({ sessao: criarSessao(usuario) });
    }

    const desafio_id = uuid();
    desafios.set(desafio_id, {
      usuario_id: usuario.id,
      expira_em: Date.now() + MFA_VALIDADE_MS,
      tentativas: 0,
    });

    const mfa: DesafioMfa = {
      desafio_id,
      destino: usuario.mfa_ativo ? "seu aplicativo autenticador" : mascararDestino(usuario.email),
      metodo: usuario.mfa_ativo ? "totp" : "sms",
      expira_em: new Date(Date.now() + MFA_VALIDADE_MS).toISOString(),
    };

    return okOne<ResultadoLogin>({ mfa });
  });
}

/* -------------------------------------------------------------------------
   SEGUNDO FATOR
   ------------------------------------------------------------------------- */

export async function verifyMfa({
  desafio_id,
  codigo,
}: {
  desafio_id: string;
  codigo: string;
}): Promise<SingleResult<Sessao>> {
  return simulate(() => {
    const desafio = desafios.get(desafio_id);

    if (!desafio || Date.now() > desafio.expira_em) {
      desafios.delete(desafio_id);
      return fail(ERROR_CODE.UNAUTHORIZED, "O código expirou. Entre novamente.");
    }

    if (desafio.tentativas >= MAX_TENTATIVAS_MFA) {
      desafios.delete(desafio_id);
      return fail(ERROR_CODE.RATE_LIMITED, "Muitas tentativas. Entre novamente.");
    }

    if (codigo !== CODIGO_MFA_MOCK) {
      desafio.tentativas += 1;
      return fail(ERROR_CODE.UNAUTHORIZED, "Código inválido.");
    }

    const usuario = usuarios.find((u) => u.id === desafio.usuario_id);
    if (!usuario) {
      desafios.delete(desafio_id);
      return fail(ERROR_CODE.UNAUTHORIZED, "Não foi possível concluir o acesso.");
    }

    // Desafio é de uso único: consumido, deixa de existir.
    desafios.delete(desafio_id);

    return okOne(criarSessao(usuario));
  });
}

/* -------------------------------------------------------------------------
   SESSÃO
   ------------------------------------------------------------------------- */

export async function signOut(): Promise<SingleResult<null>> {
  return simulate(() => okOne(null));
}

/**
 * A sessão vive só na memória do `AuthContext` — nunca em `localStorage`.
 * Recarregar a página encerra a sessão, e isso é o comportamento pretendido
 * nesta fase. Na Fase 15 o Supabase restaura a sessão a partir de um cookie
 * `httpOnly`, que o JavaScript da página não consegue ler.
 */
export async function getSession(): Promise<SingleResult<Sessao>> {
  return simulate(() => okOne<Sessao>(null));
}

/* -------------------------------------------------------------------------
   RECUPERAÇÃO DE SENHA
   ------------------------------------------------------------------------- */

/**
 * Sempre responde sucesso, exista ou não o e-mail.
 * Responder "e-mail não encontrado" transforma esta tela em um verificador de
 * contas válidas para quem estiver sondando.
 */
export async function requestPasswordReset({
  email,
}: {
  email: string;
}): Promise<SingleResult<{ enviado: true }>> {
  return simulate(() => {
    void email;
    return okOne({ enviado: true as const });
  });
}

export async function resetPassword({
  token,
  senha,
}: {
  token: string;
  senha: string;
}): Promise<SingleResult<{ alterada: true }>> {
  return simulate(() => {
    if (!token) return fail(ERROR_CODE.VALIDATION, "Link inválido ou expirado.");
    if (senha.length < 10) return fail(ERROR_CODE.VALIDATION, "A senha não atende aos requisitos.");

    return okOne({ alterada: true as const });
  });
}
