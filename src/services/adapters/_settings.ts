import { ERROR_CODE, fail, type SingleResult } from "@/services/contracts";
import type { Configuracoes, VersaoLegal } from "@/types/configuracao";

/**
 * SETTINGS WRITES — none exist, on either backend.
 * =============================================================================
 * The refusal is a product rule, not a missing implementation, so both adapters
 * give the same answer: a mock that accepted these would have the screen
 * promise a form the real backend denies.
 */

const MIGRATION_ONLY =
  "Os catálogos do sistema mudam por migração versionada, com revisão, e não por formulário: o mesmo vocabulário alimenta o diário do paciente, os relatórios e os gatilhos de alerta, e renomear um código aqui quebraria os três de uma vez.";

export const SETTINGS_WRITE_OPERATIONS = {
  update: async (): Promise<SingleResult<Configuracoes>> =>
    fail(ERROR_CODE.FORBIDDEN, MIGRATION_ONLY),

  uploadLogo: async (): Promise<SingleResult<{ url: string }>> =>
    fail(
      ERROR_CODE.NOT_IMPLEMENTED,
      "Não há onde guardar a identidade visual: nenhuma tabela de parâmetro e nenhum bucket de marca no Storage.",
    ),

  publishTermos: async (): Promise<SingleResult<VersaoLegal>> =>
    fail(
      ERROR_CODE.FORBIDDEN,
      "Publicar uma nova versão dos termos cria obrigação de novo aceite para todos os pacientes. A tabela só permite leitura pelo painel — a publicação é feita pela migração que traz o texto revisado.",
    ),
};
