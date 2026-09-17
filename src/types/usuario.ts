import type {
  AcaoAuditoria,
  Especialidade,
  OrigemAuditoria,
  Papel,
  StatusUsuario,
} from "@/lib/enums";
import type { Permissao } from "@/lib/rbac";

/**
 * Domínio de Usuários — os profissionais que operam o painel.
 *
 * O contrato trata "profissional clínico" como PAPEL e as sete especialidades
 * como espaços de trabalho. Por isso `papel` e `especialidade` são colunas
 * distintas: um psicólogo e um nutricionista têm o mesmo papel e acessos
 * diferentes. Ver `lib/rbac.ts`.
 *
 * E-mail e registro profissional aparecem em claro: são dado de contato
 * corporativo, público dentro da clínica e exibido assim no protótipo. Não se
 * confundem com a PII de paciente, que nasce mascarada.
 */

export interface UsuarioListItem {
  id: string;
  nome: string;
  /** Como a pessoa é tratada na clínica: "Dra.", "Enf.", "Nutri.". */
  tratamento: string | null;
  email: string;
  papel: Papel;
  especialidade: Especialidade | null;
  /** CRM, CRF, COREN, CRN, CRP, CRO ou CREFITO — conforme a especialidade. */
  registro: string | null;
  avatar_url: string | null;
  status: StatusUsuario;
  /**
   * `null` quando a origem dos dados não expõe o segundo fator de terceiros —
   * "não sabemos", que é diferente de `false` e não deve virar alerta na tela.
   */
  mfa_ativo: boolean | null;
  /** Janela de atendimento no chat. O protótipo mostra "08:00–18:00". */
  horario_inicio: string | null;
  horario_fim: string | null;
  ultimo_acesso_em: string | null;
  criado_em: string;
}

export interface UsuarioDetalhe extends UsuarioListItem {
  /**
   * TODAS as áreas vigentes, e não só a principal.
   *
   * O vínculo é temporal do lado do banco: tirar alguém de uma área encerra a
   * vigência e a linha fica, porque a pergunta que uma auditoria faz é quem
   * podia ler o quê, em que data. Aqui aparecem as que valem hoje.
   */
  especialidades: Especialidade[];
  permissoes_extras: Permissao[];
  /**
   * Conjunto efetivo, já resolvido: papel → especialidade → extras.
   *
   * Vem pronto do backend para que a tela não recalcule regra de acesso. Duas
   * implementações da mesma regra é como as duas divergem.
   */
  permissoes_efetivas: Permissao[];
}

/**
 * Corpo do cadastro e da edição de usuário do painel.
 *
 * > [!] Cadastrar é CONCEDER um perfil, não criar um acesso.
 * A conta nasce quando a própria pessoa se cadastra; o painel não tem servidor
 * para criá-la em nome de terceiros, e criar senha alheia quebraria o não
 * repúdio da trilha. Por isso a entrada carrega `account_id` em vez de nome e
 * e-mail: os dois são da conta, e quem os corrige é o titular.
 *
 * Tratamento, janela de atendimento no chat e segundo fator não estão aqui
 * porque não têm coluna: o primeiro não existe no cadastro, a segunda é
 * configuração que ninguém guarda ainda, e o terceiro é gerenciado pela pessoa
 * no aplicativo autenticador dela.
 */
export interface UsuarioEntrada {
  /** Conta existente que recebe o perfil. */
  account_id: string;
  papel: Papel;
  /** Áreas vigentes. Vazio para administrador. */
  especialidades: Especialidade[];
  /** A área que agrupa a carteira. Na omissão, a primeira da lista. */
  especialidade_principal?: Especialidade | null;
  registro?: string | null;
}

/** Uma conta que ainda não tem perfil no painel — candidata a receber um. */
export interface ContaDisponivel {
  id: string;
  nome: string;
  email: string;
  criado_em: string;
}

/** Um quadrado da faixa de distribuição no topo da tela. */
export interface DistribuicaoEspecialidade {
  especialidade: Especialidade;
  label: string;
  total: number;
}

/** Linha do histórico de acessos de um profissional. */
export interface LogAcesso {
  id: string;
  usuario_id: string;
  acao: AcaoAuditoria;
  recurso: string;
  origem: OrigemAuditoria;
  ip: string;
  user_agent: string;
  criado_em: string;
}

/**
 * Matriz papel × permissão.
 *
 * É a mesma regra que `lib/rbac.ts` aplica no cliente — só que editável. Na
 * Fase 15 a tabela `permissoes` passa a ser a fonte, e `lib/rbac.ts` vira
 * apenas o avaliador.
 */
export interface MatrizPermissoes {
  papeis: Papel[];
  permissoes: { id: Permissao; label: string; grupo: string }[];
  concedidas: Record<Papel, Permissao[]>;
  /** Permissões que nenhum papel concede — só a especialidade. */
  exclusivas_de_especialidade: Permissao[];
}
