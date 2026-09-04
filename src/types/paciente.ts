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
  criado_em: string;
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

/** Corpo de criação e edição — o que o formulário envia. */
export interface PacienteEntrada {
  nome: string;
  cpf: string;
  nascimento: string;
  sexo: Sexo;
  telefone: string;
  email: string;
  cid: string;
  protocolo_id: string;
  fase: FaseTratamento;
  risco: Risco;
  estadiamento?: string | null;
  diagnostico_em?: string | null;
  alergias?: string[];
  reacoes_previas?: string[];
  observacoes?: string | null;
  medico_responsavel_id?: string | null;
  /** Dispara o SMS de convite logo após o cadastro. */
  enviar_convite?: boolean;
}

/** Retorno de `sendInvite` — o protótipo anuncia "convite por SMS no cadastro". */
export interface ResultadoConvite {
  paciente_id: string;
  /** Telefone mascarado para onde o SMS foi enviado. */
  destino: string;
  enviado_em: string;
}
