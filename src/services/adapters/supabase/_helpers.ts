import { ERROR_CODE, fail, type ErrorCode, type FailResult } from "@/services/contracts";
import { mapSupabaseError } from "./client";

/**
 * Infra compartilhada do adapter Supabase.
 *
 * Faz o que `mock/_helpers.ts` faz do outro lado: garante que toda operação
 * responda no formato do contrato, inclusive quando algo estoura. Uma exceção
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
};

export function traduzirErro(erro: ErroPostgrest | null | undefined): ErrorCode {
  if (!erro) return ERROR_CODE.UNKNOWN;

  const extra = erro.code ? CODIGO_EXTRA[erro.code] : undefined;
  return extra ?? mapSupabaseError(erro) ?? ERROR_CODE.UNKNOWN;
}

/**
 * Mensagem a exibir, na ordem em que a informação é mais útil.
 *
 * 1. O `HINT` das funções deste banco é escrito para ser lido por quem opera o
 *    painel — "peça a outro administrador", "desvincule a conta antes". Quando
 *    existe, é melhor do que qualquer texto genérico nosso.
 * 2. Sem `HINT`, a sentinela traduzida: `message` traz um identificador estável
 *    (`invalid_cpf`), que é preciso para o código e ilegível na tela.
 * 3. Sem as duas, a própria `message` — mas só quando ela é frase e vem de um
 *    código cuja mensagem é escrita para ser lida. Ver `MENSAGEM_LEGIVEL`.
 * 4. Sem nenhuma das três, o contrato usa a mensagem padrão do código de erro.
 */
export function mensagemDoErro(erro: ErroPostgrest | null | undefined): string | undefined {
  const hint = erro?.hint?.trim();
  if (hint) return hint;

  const mensagem = erro?.message?.trim();
  if (!mensagem) return undefined;

  const traduzida = MENSAGEM_POR_SENTINELA[mensagem];
  if (traduzida) return traduzida;

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
