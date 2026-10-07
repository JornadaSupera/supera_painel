import { ERROR_CODE, fail, type ErrorCode, type FailResult } from "@/services/contracts";
import { getSupabaseClient, mapSupabaseError } from "./client";

/**
 * Infra compartilhada do adapter Supabase.
 *
 * Garante que toda operação responda no formato do contrato, inclusive quando algo estoura. Uma exceção
 * que escapa daqui vira tela branca; um `{ error }` chega ao `ErrorState`.
 */

/** Forma mínima de um erro do PostgREST ou de uma exceção levantada em PL/pgSQL. */
export interface ErroPostgrest {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

/**
 * Códigos que o PostgREST devolve e que `mapSupabaseError` não cobre, por
 * serem específicos de chamada de função — o caminho que este adapter usa para
 * quase tudo que é clínico.
 */
const CODIGO_EXTRA: Record<string, ErrorCode> = {
  // Função inexistente ou nome de parâmetro errado. É defeito nosso, não do
  // usuário: a assinatura tem que bater exatamente com a do banco.
  PGRST202: ERROR_CODE.NOT_IMPLEMENTED,
  // `raise exception` sem SQLSTATE próprio — o padrão do PL/pgSQL. As RPCs do
  // projeto usam isso para regra de negócio.
  P0001: ERROR_CODE.VALIDATION,
  // Violação de chave estrangeira. No desenho deste banco é quase sempre
  // "a linha pai não existe ou não é sua".
  "23503": ERROR_CODE.VALIDATION,
  // `invalid_parameter_value`. As RPCs de escrita o usam para argumento
  // recusado — CPF fora do formato, fase de tratamento inexistente. Sem esta
  // linha caía em UNKNOWN, e a tela dizia "erro inesperado" para um campo
  // digitado errado.
  "22023": ERROR_CODE.VALIDATION,
  // `no_data_found`. As RPCs de configuração o usam para "a linha que você
  // apontou não existe" — sintoma desativado, motivo já removido. É NOT_FOUND,
  // e não falha de validação: o dado enviado estava bem formado.
  P0002: ERROR_CODE.NOT_FOUND,
  // `restrict_violation`. `guard_notification_type` a usa para recusar
  // desligar um tipo de notificação obrigatório — regra de segurança clínica,
  // não erro de formulário, mas ainda uma recusa que quem opera pode entender
  // e não repetir.
  "23001": ERROR_CODE.VALIDATION,
  // `exclusion_violation`. `slot_blocked`: o horário colide com um bloqueio
  // da agenda de quem atenderia. É conflito de horário, não "alterado por
  // outra pessoa", que é o que o 409 do PostgREST diria sozinho.
  "23P01": ERROR_CODE.CONFLICT,
  // `object_not_in_prerequisite_state`. `staff_invitation_pending`: a ação
  // espera o convite ser aceito, e nada que a pessoa digite muda isso.
  "55000": ERROR_CODE.CONFLICT,
};

/**
 * Códigos cuja `message` já é texto de tela.
 *
 * As RPCs de paciente e de profissional levantam **sentinela** — um
 * identificador estável que o mapa abaixo traduz. As de configuração levantam
 * **frase**, em português e escrita para quem opera ("motivo só se cadastra
 * para estado terminal"). Descartá-la para exibir "Verifique os dados
 * informados" troca a explicação exata por uma genérica.
 *
 * A lista é fechada de propósito. Fora dela ficam os erros que o Postgres
 * escreve sozinho — violação de chave estrangeira, de unicidade —, cuja
 * mensagem cita o nome de uma constraint. Nome de objeto do banco na tela da
 * recepção não informa nada e assusta.
 */
const MENSAGEM_LEGIVEL: ReadonlySet<string> = new Set([
  "P0001", // raise exception sem SQLSTATE próprio
  "22023", // invalid_parameter_value
  "P0002", // no_data_found
  "23001", // restrict_violation
]);

/** Sentinela é um token só (`invalid_cpf`); frase tem espaço. */
const PARECE_SENTINELA = /^[a-z0-9_]+$/;

/**
 * Sentinelas das RPCs, em português.
 *
 * As funções do banco levantam um identificador estável (`invalid_cpf`,
 * `specialty_required`) em vez de uma frase: o texto é decisão de interface, e
 * traduzi-lo no servidor congelaria o idioma do painel dentro de uma migration.
 * Quem traduz é este mapa.
 *
 * Só entram aqui as que a pessoa que opera consegue resolver. `forbidden` fica
 * de fora de propósito: o contrato já tem mensagem para FORBIDDEN, e repetir a
 * regra de permissão em cada recusa não ajuda ninguém a agir.
 */
const MENSAGEM_POR_SENTINELA: Record<string, string> = {
  /* ---------------------------------------------------------- paciente */
  invalid_cpf: "CPF inválido: são 11 dígitos.",
  patient_cpf_already_registered:
    "Já existe ficha ativa com este CPF. Abra a ficha existente em vez de cadastrar de novo.",
  patient_cpf_registered_inactive:
    "Já existe ficha com este CPF, e ela está desativada. Reative a ficha existente.",
  patient_not_found: "Ficha não encontrada.",
  patient_inactive: "A ficha está desativada. Reative antes de convidar.",
  patient_already_activated:
    "Esta ficha já tem conta vinculada. Desfaça o vínculo antes de convidar de novo.",
  missing_destination:
    "Falta o destino do convite. Preencha o celular da ficha antes de emitir.",
  invitation_not_pending: "Não há convite pendente para cancelar.",
  patient_not_linked: "Esta ficha não tem conta vinculada.",
  cpf_frozen_after_activation:
    "O CPF não muda depois que o paciente ativou o app. Desfaça o vínculo da conta antes de corrigi-lo.",
  unknown_treatment_phase: "Esta fase de tratamento não está ativa no cadastro.",
  birth_date_in_future: "A data de nascimento não pode ser depois de hoje.",
  underage:
    "Ficha de menor de 18 anos: o aplicativo só é liberado a partir dos 18, e o convite não é emitido.",

  /* ------------------------------------------------------ profissional */
  account_not_found:
    "Esta pessoa ainda não tem conta na plataforma. A conta precisa existir antes do perfil.",
  professional_already_registered: "Esta conta já tem perfil de profissional.",
  council_registration_required: "Informe o registro no conselho.",
  specialty_required:
    "Escolha ao menos uma especialidade: sem nenhuma, o perfil não consegue registrar nada.",
  unknown_specialty: "Especialidade desconhecida ou desativada.",
  primary_specialty_not_in_list: "A especialidade principal precisa estar entre as escolhidas.",
  professional_not_found: "Profissional não encontrado.",
  cannot_manage_own_professional_profile:
    "Ninguém edita o próprio perfil profissional. Peça a outro administrador.",

  /* ------------------------------------------------------- integração */
  link_not_proposed:
    "Este vínculo já foi conferido por alguém. Recarregue a fila para ver a decisão que está valendo.",

  /* ------------------------------------------- equipe (convite e fator) */
  mfa_required:
    "Esta ação exige a verificação do segundo fator. Informe o código do aplicativo autenticador.",
  invalid_email: "E-mail inválido. Confira o endereço.",
  invalid_name: "Informe o nome completo.",
  invalid_role: "Escolha se a pessoa entra como profissional ou como administradora.",
  email_in_use: "Já existe uma conta com este e-mail.",
  account_is_patient:
    "Esta conta é de paciente. A equipe usa conta própria, com e-mail corporativo.",
  account_is_caregiver:
    "Esta conta é de acompanhante. A equipe usa conta própria, com e-mail corporativo.",
  staff_invitation_pending:
    "O convite ainda não foi aceito. Para desistir dele, desative a conta.",
  staff_invitation_not_found: "Convite não encontrado. Recarregue a lista.",
  invite_failed:
    "A conta foi criada, mas o e-mail do convite não saiu. Use “Reenviar convite” na lista.",
  cannot_reset_own_factor:
    "O seu autenticador não é redefinido por aqui. Peça a outro administrador ou use a tela Segurança.",
  staff_account_not_found: "Esta conta não é de alguém da equipe.",
  reset_failed:
    "Não foi possível terminar a redefinição. Tente de novo: a segunda tentativa conclui o que faltou.",

  /* ---------------------------------------------------------- conteúdo */
  self_approval_not_allowed:
    "Quem escreveu a orientação não a aprova. Outro administrador precisa aprovar.",
  content_not_published: "Só se envia orientação que já foi publicada.",
  directed_send_not_allowed: "Esta área não envia orientação a pacientes.",
  directed_send_not_found: "Envio não encontrado.",

  /* ------------------------------------------------------------- chat */
  confidential_specialty_not_routable:
    "Conversas não vão direto para uma área sigilosa. O caminho até ela é o encaminhamento.",
  subject_not_found: "Assunto não encontrado. Recarregue a lista.",
  quick_reply_not_found: "Resposta rápida não encontrada. Recarregue a lista.",
  invalid_label: "O título precisa ter de 1 a 80 caracteres.",
  invalid_body: "O texto precisa ter de 1 a 2.000 caracteres.",
  conversation_not_found: "Conversa não encontrada. Recarregue a lista.",

  /* ----------------------------------------------------------- agenda */
  appointment_not_found: "Compromisso não encontrado. Recarregue a agenda.",
  origin_specialty_not_allowed:
    "A sessão desta área é marcada por quem é da própria área.",
  professional_profile_required: "Esta ação é de quem tem perfil de profissional ativo.",
  slot_blocked: "O profissional não está disponível neste horário.",
  window_too_large: "O período pedido é longo demais. Escolha até 62 dias.",
  block_not_found: "Bloqueio não encontrado. Recarregue a agenda.",
  invalid_period: "O fim precisa ser depois do início.",
};

/** A frase de tela de uma sentinela, ou `undefined` quando não há tradução. */
export function mensagemDaSentinela(sentinela: string): string | undefined {
  return MENSAGEM_POR_SENTINELA[sentinela];
}

export function traduzirErro(erro: ErroPostgrest | null | undefined): ErrorCode {
  if (!erro) return ERROR_CODE.UNKNOWN;

  // O banco responde `42501` tanto para falta de permissão quanto para sessão
  // sem segundo fator. A tela precisa distinguir: a primeira é uma recusa, a
  // segunda tem saída (informar o código).
  if (erro.message === "mfa_required") return ERROR_CODE.MFA_REQUIRED;

  const extra = erro.code ? CODIGO_EXTRA[erro.code] : undefined;
  return extra ?? mapSupabaseError(erro) ?? ERROR_CODE.UNKNOWN;
}

/**
 * Message to show, in the order the information is most useful.
 *
 * 1. The translated sentinel: `message` carries a stable identifier
 *    (`invalid_cpf`) that the map above turns into screen text.
 * 2. Without a translation, the function's `HINT`. It is written for whoever
 *    operates the panel, but the database keeps it in plain ASCII ("nao",
 *    "esta") and some hints name a database function ("Reative com
 *    set_patient_active") — which is why a translation, when there is one,
 *    comes first.
 * 3. Without either, the `message` itself — only when it is a sentence and
 *    comes from a code whose message is meant to be read. See
 *    `MENSAGEM_LEGIVEL`.
 * 4. Without any of the three, the contract uses the error code's default.
 */
export function mensagemDoErro(erro: ErroPostgrest | null | undefined): string | undefined {
  const mensagem = erro?.message?.trim();

  const traduzida = mensagem ? MENSAGEM_POR_SENTINELA[mensagem] : undefined;
  if (traduzida) return traduzida;

  const hint = erro?.hint?.trim();
  if (hint) return hint;

  if (!mensagem) return undefined;

  // Sentinela ainda sem tradução não vai para a tela: `invalid_cpf` não é
  // frase, e exibi-lo cru seria mostrar o identificador do código.
  if (PARECE_SENTINELA.test(mensagem)) return undefined;

  return erro?.code && MENSAGEM_LEGIVEL.has(erro.code) ? mensagem : undefined;
}

/** Converte um erro do PostgREST em resposta de falha do contrato. */
export function falhaDe(erro: ErroPostgrest | null | undefined): FailResult {
  return fail(traduzirErro(erro), mensagemDoErro(erro), {
    code: erro?.code,
    message: erro?.message,
  });
}

/**
 * Envelope de toda operação do adapter.
 *
 * Sem isto, um `throw` de dentro do supabase-js (rede caída, sessão ausente,
 * JSON malformado) sobe pelo `queryFn` como exceção crua e a tela perde a
 * distinção entre "erro do backend" e "defeito do painel".
 */
export async function executar<T>(operacao: () => Promise<T>): Promise<T | FailResult> {
  try {
    return await operacao();
  } catch (erro) {
    if (erro instanceof Error && /Failed to fetch|NetworkError/i.test(erro.message)) {
      return fail(ERROR_CODE.NETWORK);
    }

    return fail(ERROR_CODE.UNKNOWN, undefined, {
      message: erro instanceof Error ? erro.message : String(erro),
    });
  }
}

/**
 * Achata um vínculo embutido do PostgREST.
 *
 * A forma do retorno depende de uma constraint do banco, não da consulta: com
 * unicidade na chave estrangeira o PostgREST entende relação um-para-um e
 * devolve um OBJETO; sem ela, devolve um ARRAY. É por isso que o mesmo
 * `select` responde de duas formas conforme a tabela.
 *
 * O modo de errar é silencioso e caro: indexar `[0]` num objeto devolve
 * `undefined`, então o vínculo simplesmente "não existe" — sem erro, sem log,
 * e a tela mostra uma lista vazia que parece problema de permissão.
 */
export function umDe<T>(vinculo: T | T[] | null | undefined): T | null {
  if (!vinculo) return null;
  return Array.isArray(vinculo) ? (vinculo[0] ?? null) : vinculo;
}

/**
 * LEITURA PEDIDA POR DUAS CONSULTAS DA MESMA TELA.
 * =============================================================================
 * O Dashboard lê seus indicadores e seus gráficos em duas consultas, e as duas
 * precisam da mesma lista de pacientes, dos mesmos catálogos e do mesmo tipo de
 * compromisso. Cada uma ia ao banco por conta própria: a rede mostrava a mesma
 * função duas vezes por carga e, pior, a trilha de auditoria registrava duas
 * leituras onde houve um gesto só. O painel clínico repetia `read_patient` do
 * mesmo paciente para a agenda e para os alertas.
 *
 * Aqui a segunda consulta pega carona na primeira: a mesma chave, dentro de uma
 * janela curta, devolve a MESMA promessa. A janela é curta de propósito (cinco
 * segundos para o que muda, alguns minutos para catálogo), porque isto não é um
 * cache de dados, é a remoção de uma duplicata.
 *
 * Nada falho fica guardado: se a leitura rejeitar, ou se `manter` disser que o
 * valor é uma falha, a entrada sai e a próxima chamada tenta de novo.
 *
 * O que está aqui pode ser dado de paciente (um nome), então a memória é
 * esvaziada quando a sessão muda — ver `limparLeiturasCompartilhadas`.
 */
const LEITURAS_COMPARTILHADAS = new Map<string, { expiraEm: number; promessa: Promise<unknown> }>();

export function compartilharLeitura<T>(
  chave: string,
  validadeMs: number,
  carregar: () => Promise<T>,
  manter: (valor: T) => boolean = () => true,
): Promise<T> {
  const agora = Date.now();
  const existente = LEITURAS_COMPARTILHADAS.get(chave);

  if (existente && existente.expiraEm > agora) return existente.promessa as Promise<T>;

  const promessa = carregar().then(
    (valor) => {
      if (!manter(valor)) LEITURAS_COMPARTILHADAS.delete(chave);
      return valor;
    },
    (erro: unknown) => {
      LEITURAS_COMPARTILHADAS.delete(chave);
      throw erro;
    },
  );

  LEITURAS_COMPARTILHADAS.set(chave, { expiraEm: agora + validadeMs, promessa });
  return promessa;
}

/** Esvazia as leituras compartilhadas: outra pessoa pode estar entrando neste navegador. */
export function limparLeiturasCompartilhadas(): void {
  LEITURAS_COMPARTILHADAS.clear();
}

/**
 * Teto de linhas das funções `read_*`. É imposto no servidor — pedir mais não
 * traz mais, e o painel precisa saber disso para não prometer paginação que
 * não existe.
 */
export const TETO_READ = 200;

/** ISO 8601 UTC — o único formato de data que a camada de dados usa. */
export function paraIso(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

/**
 * Registra uma exportação na trilha, DEPOIS de o arquivo já ter sido gerado.
 *
 * `log_data_export` (25/09/2026) é o pedágio de auditoria da EXPORTAÇÃO — o
 * momento em que o dado sai do ambiente controlado, e o que uma investigação
 * de vazamento mais precisa encontrar. Falhar em registrar não desfaz uma
 * exportação que já aconteceu no navegador: o erro só vai para o console, para
 * não transformar uma falha de auditoria numa exportação recusada.
 *
 * `p_scope` é identificador, nunca texto livre (`^[a-z][a-z0-9_]{0,62}$`) —
 * quem chama é responsável por já ter normalizado o valor.
 */
export async function logarExportacao(params: {
  escopo: string;
  linhas: number;
  pacienteId?: string;
}): Promise<void> {
  const { error } = await getSupabaseClient().rpc("log_data_export", {
    p_scope: params.escopo,
    p_row_count: params.linhas,
    p_patient_id: params.pacienteId ?? null,
  });

  if (error) {
    console.error(
      `Falha ao registrar a exportação "${params.escopo}" na trilha de auditoria:`,
      error.message,
    );
  }
}

/**
 * Quem está logado, como profissional: a conta e o perfil.
 *
 * As políticas de escrita do profissional comparam `author_account_id` com
 * `auth.uid()` e `author_professional_id` com o perfil da conta, e o cliente
 * precisa mandar os dois. Sem perfil ativo não há o que escrever — dizer isso é
 * melhor do que deixar a política recusar sem explicação.
 */
export async function profissionalDaSessao(): Promise<
  { contaId: string; profissionalId: string } | FailResult
> {
  const supabase = getSupabaseClient();

  const { data: sessao } = await supabase.auth.getSession();
  const contaId = sessao.session?.user.id;
  if (!contaId) {
    return fail(ERROR_CODE.UNAUTHORIZED, "Sua sessão expirou. Entre de novo para continuar.");
  }

  const { data: perfil, error } = await supabase
    .from("professionals")
    .select("id")
    .eq("account_id", contaId)
    .maybeSingle();
  if (error) return falhaDe(error);

  const profissionalId = (perfil as { id: string } | null)?.id;
  if (!profissionalId) {
    return fail(ERROR_CODE.FORBIDDEN, "Só quem tem perfil de profissional faz isto.");
  }

  return { contaId, profissionalId };
}
