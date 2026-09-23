import { MFA_REQUIRED } from "@/lib/env";
import { STATUS_USUARIO } from "@/lib/enums";
import { usuarios } from "@/mocks/usuarios";
import type { UsuarioMock } from "@/mocks/usuarios";
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
import { exigenciaDeMfa, nivelAtual, registrarNivel } from "./_security";
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
    //
    // A sessão nasce em `aal1`, e é justamente esse o caso que interessa
    // exercitar: painel com o fator desligado contra um backend que o exige
    // é a combinação que produz telas vazias sem erro nenhum.
    if (!MFA_REQUIRED) {
      registrarNivel("aal1");
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
      destino: usuario.mfa_ativo ? "seu aplicativo autenticador" : maskDestination(usuario.email),
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

    // O segundo fator verificado é o que eleva a sessão — o equivalente ao
    // `aal2` que o GoTrue carimba no JWT depois de `mfa.verify`.
    registrarNivel("aal2");

    return okOne(criarSessao(usuario));
  });
}

/**
 * O nível da sessão contra a exigência do backend.
 *
 * Reproduz a assimetria que importa: a exigência só se aplica ao perfil
 * administrativo, e quem não é administrador não tem como consultá-la — daí o
 * `null`, que a tela lê como "não se aplica" e não como "não exige".
 *
 * Todo usuário do mock tem autenticador, então `fator_cadastrado` é sempre
 * verdadeiro: o caminho de "não tem fator" é exercitado pelo adapter real, que
 * recusa o login antes da tela do código.
 */
export async function getGarantia(): Promise<SingleResult<GarantiaDaSessao>> {
  return simulate(() => {
    const nivel = nivelAtual();
    const exigido = exigenciaDeMfa();

    return okOne<GarantiaDaSessao>({
      nivel,
      exigido,
      suficiente: !exigido || nivel === "aal2",
      fator_cadastrado: true,
    });
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
}: PasswordResetRequest): Promise<SingleResult<{ enviado: true }>> {
  return simulate(() => {
    void email;
    return okOne({ enviado: true as const });
  });
}

/* -------------------------------------------------------------------------
   RECOVERY FOR APP ACCOUNTS
   -------------------------------------------------------------------------
   Links to exercise every state of `/redefinir-senha` in development:

     ?token_hash=qualquer-valor   → form, then success
     ?token_hash=expirado         → link expired
     #error_code=otp_expired      → link expired (rejected before the form)

   The password `Anterior@2026` simulates "same as the previous one".
   ------------------------------------------------------------------------- */

const MOCK_EXPIRED_TOKEN = "expirado";
const MOCK_PREVIOUS_PASSWORD = "Anterior@2026";

/** Links already used. A recovery link works once, as it does in Supabase. */
const spentRecoveryLinks = new Set<string>();

/** Identifies the link, whichever shape the template produced. */
function recoveryKey(credential: RecoveryCredential): string {
  switch (credential.kind) {
    case "token_hash":
      return credential.token_hash;
    case "otp":
      return `${credential.email}:${credential.token}`;
    case "session":
      return credential.access_token;
  }
}

export async function completePasswordRecovery({
  credential,
  password,
}: PasswordRecoveryInput): Promise<SingleResult<{ changed: true }>> {
  return simulate(() => {
    const key = recoveryKey(credential);

    if (key === MOCK_EXPIRED_TOKEN || spentRecoveryLinks.has(key)) {
      return fail(ERROR_CODE.UNAUTHORIZED, "Este link expirou ou já foi usado.");
    }
    if (password === MOCK_PREVIOUS_PASSWORD) {
      return fail(ERROR_CODE.VALIDATION, "A nova senha precisa ser diferente da anterior.");
    }

    spentRecoveryLinks.add(key);
    return okOne({ changed: true as const });
  });
}
