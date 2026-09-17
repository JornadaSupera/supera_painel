import type { FaseTratamento, Risco, StatusPaciente } from "@/lib/enums";
import type { Protocolo } from "./catalogo";

/**
 * Domínio de Pacientes.
 *
 * Os nomes de campo são as colunas da futura tabela `pacientes` no Postgres
 * (`snake_case`, ids UUID, datas ISO 8601 UTC). Nenhuma tradução entre camada
 * de dados e tela.
 *
 * > [!] Dado pessoal não trafega inteiro por padrão.
 * A listagem e a ficha recebem `cpf_mascarado`, `telefone_mascarado` e
 * `email_mascarado`. O valor completo só chega pela operação `revealPii`, que
 * exige `pacientes:reveal_pii` e deixa rastro na trilha de auditoria. Na Fase 15
 * isso vira uma *view* mascarada + uma função `security definer` no Postgres —
 * a mesma separação, agora com a barreira no banco.
 */

export type Sexo = "feminino" | "masculino";

/** Situação do convite de acesso ao app do paciente, enviado por SMS. */
export type StatusConvite = "nao_enviado" | "enviado" | "aceito";

export const STATUS_CONVITE_LABEL: Record<StatusConvite, string> = {
  nao_enviado: "Não enviado",
  enviado: "Enviado",
  aceito: "Aceito",
};

/** Colunas devolvidas na listagem — projeção enxuta, sem dado clínico livre. */
export interface PacienteListItem {
  id: string;
  /** Código interno da clínica, buscável: "PAC-0042". */
  codigo: string;
  nome: string;
  cpf_mascarado: string;
  nascimento: string;
  /** `null` quando a origem dos dados não informa o campo. */
  sexo: Sexo | null;
  cid: string;
  /** Vem do join com `cids` — evita uma segunda consulta na tela. */
  cid_descricao: string;
  protocolo_id: string;
  protocolo_nome: string;
  /** `null` enquanto nenhuma fase de tratamento estiver atribuída. */
  fase: FaseTratamento | null;
  status: StatusPaciente;
  /** `null` quando não há classificação de risco na origem dos dados. */
  risco: Risco | null;
  convite_status: StatusConvite;
  /**
   * `null` quando a projeção da listagem não traz a data de cadastro.
   *
   * A listagem do backend ordena por data de cadastro e **não devolve a coluna**
   * — são coisas diferentes, e a ficha, que lê a linha inteira, tem o valor.
   */
  criado_em: string | null;
}

/** Ficha completa. Tudo que a listagem tem, mais o que só ela mostra. */
export interface PacienteDetalhe extends PacienteListItem {
  telefone_mascarado: string;
  email_mascarado: string;
  estadiamento: string | null;
  diagnostico_em: string | null;
  alergias: string[];
  reacoes_previas: string[];
  observacoes: string | null;
  /** `insurance_name` — o convênio declarado na ficha. */
  convenio: string | null;
  protocolo: Protocolo | null;
  medico_responsavel_id: string | null;
  medico_responsavel_nome: string | null;
  convite_enviado_em: string | null;
  ultimo_acesso_app_em: string | null;
  desativado_em: string | null;
  motivo_desativacao: string | null;
  atualizado_em: string;
}

/** Campos que a operação `revealPii` sabe devolver. */
export type CampoPii = "cpf" | "telefone" | "email";

export type PiiRevelada = Partial<Record<CampoPii, string>>;

/**
 * Corpo de criação e edição — o que o formulário envia.
 *
 * > [!] São só os campos que o backend sabe gravar.
 * O cadastro recebe nome, CPF, nascimento, telefone, e-mail e convênio.
 * Diagnóstico, estadiamento, protocolo e fase são ato clínico, e se o painel
 * administrativo pode praticá-lo é pergunta aberta com a clínica — construir a
 * seção antes da resposta arrisca a tela, não a seção. Sexo, classificação de
 * risco, médico responsável e observações não têm coluna em lugar nenhum:
 * coletá-los seria gravar no vazio.
 *
 * A ficha continua LENDO tudo isso, porque quem escreve é o sistema do
 * consultório. Ler e escrever são permissões diferentes.
 */
export interface PacienteEntrada {
  nome: string;
  cpf: string;
  nascimento: string;
  telefone: string;
  email: string;
  /** Nome do convênio, quando houver. */
  convenio?: string | null;
  /**
   * Alergias e reações prévias só CRESCEM.
   *
   * O histórico clínico é imutável no backend e a única operação é acrescentar.
   * Na edição, o termo que sair desta lista não é apagado — apenas não é
   * acrescentado de novo. A tela diz isso em vez de oferecer um X que mente.
   */
  alergias?: string[];
  reacoes_previas?: string[];
  /** Emite o convite de acesso ao app logo após o cadastro. */
  enviar_convite?: boolean;
}

/**
 * Retorno de `sendInvite`.
 *
 * > [!] O token vem em texto puro UMA vez, e não há como reemiti-lo.
 * O backend guarda apenas o hash. Enquanto não houver provedor de SMS é o
 * painel que exibe o token para alguém digitar no app — e é isso que torna a
 * ativação testável. Reenviar cancela o convite pendente anterior e emite
 * outro token, porque o antigo costuma ser o que foi para o número errado.
 */
export interface ResultadoConvite {
  paciente_id: string;
  /** Destino mascarado — o telefone da ficha, ou o informado no reenvio. */
  destino: string;
  enviado_em: string;
  /** `null` quando a origem dos dados não expõe o token. */
  token: string | null;
  expira_em: string | null;
}
