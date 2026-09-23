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
  /** Classificação TNM do diagnóstico principal. */
  tnm: string | null;
  diagnostico_em: string | null;
  /** Intenção do plano vigente — curativa, paliativa, adjuvante. */
  intencao_terapeutica: string | null;
  /** Início do plano vigente. `null` quando não há plano. */
  plano_iniciado_em: string | null;
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
  /** Identificação e contato: o que a recepção digita. */
  origem_cadastro: OrigemDoDado;
  /** Diagnóstico, estadiamento e histórico: o que é ato clínico. */
  origem_clinica: OrigemDoDado;
  /** O plano terapêutico vigente. `null` quando não há plano. */
  origem_plano: OrigemDoDado | null;
}

/**
 * De onde veio um pedaço da ficha, e quando ele chegou.
 *
 * Hoje tudo vale `local` — a integração com o sistema do consultório está
 * desligada, e por isso o campo parece inerte. Ele deixa de ser no dia em que a
 * sincronização ligar, e é exatamente aí que alguém precisa distinguir o que
 * foi digitado na recepção do que veio de fora: corrigir no painel um dado que
 * a próxima sincronização sobrescreve é trabalho perdido, e não há como saber
 * disso olhando o valor.
 */
export interface OrigemDoDado {
  origem: "local" | "gemed";
  /** `null` enquanto o dado nunca foi sincronizado. */
  sincronizado_em: string | null;
}

/**
 * Quem acompanha o paciente no aplicativo.
 *
 * > [!] É dado pessoal de TERCEIRO dentro da ficha de outra pessoa.
 * Nome, e-mail e telefone aqui não são do paciente: são de quem ele convidou.
 * Chegam mascarados e **não há revelação por esta tela** — o painel precisa
 * saber que o vínculo existe e quem é, não precisa do contato. Quem tem essa
 * necessidade é o titular, no aplicativo dele.
 *
 * Vínculo revogado continua na lista: o histórico com data de concessão e de
 * revogação é o que responde "quem podia ver o quê, em que data".
 */
export interface CuidadorVinculado {
  /** Id do VÍNCULO, não da pessoa. */
  id: string;
  nome: string;
  email_mascarado: string;
  /** `null` quando a conta não informou telefone. */
  telefone_mascarado: string | null;
  status: "ativo" | "revogado";
  vinculado_em: string;
  revogado_em: string | null;
}

/** Campos que a operação `revealPii` sabe devolver. */
export type CampoPii = "cpf" | "telefone" | "email";

export type PiiRevelada = Partial<Record<CampoPii, string>>;

/**
 * Corpo de criação e edição — o que o formulário envia.
 *
 * > [!] São só os campos que o backend sabe gravar.
 * O cadastro recebe nome, CPF, nascimento, telefone, e-mail e convênio. Sexo,
 * classificação de risco, médico responsável e observações não têm coluna em
 * lugar nenhum: coletá-los seria gravar no vazio.
 *
 * O quadro clínico — diagnóstico, estadiamento, protocolo e fase — é ato de
 * outra natureza e tem corpo próprio: ver `PacienteClinicaEntrada`.
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
 * O quadro clínico da ficha — o que o escopo nomeia como "diagnóstico,
 * estadiamento e protocolo".
 *
 * Corpo separado de `PacienteEntrada` porque do outro lado são atos separados:
 * o cadastro é uma escrita, e isto são três, cada uma com a sua regra. Manter a
 * divisão aqui deixa a tela decidir o que envia sem descobrir a diferença por
 * um erro do banco.
 *
 * > [!] Campo ausente significa "não mexer", nunca "apagar".
 * Não há operação de remoção do outro lado: diagnóstico e plano são registros
 * datados, e corrigir um é registrar o seguinte. Enviar apenas o que mudou não
 * é otimização — é a única forma de a ficha não ganhar uma linha repetida a
 * cada vez que alguém abre a edição e salva sem alterar nada.
 */
export interface PacienteClinicaEntrada {
  /** Código do CID-10, como a clínica o escreve: "C50.9". */
  cid?: string | null;
  estadiamento?: string | null;
  /** Classificação TNM, quando houver. Texto livre por decisão do backend. */
  tnm?: string | null;
  diagnostico_em?: string | null;
  /**
   * Nome do protocolo. Texto livre: não existe tabela de domínio por trás, e
   * inventar um catálogo no painel criaria dois vocabulários para a mesma coisa.
   */
  protocolo_nome?: string | null;
  ciclos_previstos?: number | null;
  /** Intenção terapêutica — curativa, paliativa, adjuvante. */
  intencao?: string | null;
  plano_iniciado_em?: string | null;
  fase?: FaseTratamento | null;
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
