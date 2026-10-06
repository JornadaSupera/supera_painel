import type { Especialidade } from "@/lib/enums";

/**
 * O que o cadastro diz do profissional logado, além do que a sessão já traz
 * (nome, e-mail, registro e área principal).
 */
export interface PerfilProfissional {
  /** Quando a conta foi criada (ISO 8601 UTC). */
  criado_em: string | null;
  /** As áreas em que a pessoa atua hoje, a principal primeiro. */
  areas: { especialidade: Especialidade; principal: boolean; desde: string }[];
}
