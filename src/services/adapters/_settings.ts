import { ERROR_CODE, fail, type SingleResult } from "@/services/contracts";
import type { Configuracoes } from "@/types/configuracao";

/**
 * SETTINGS WRITES THAT STILL REFUSE — and why each one does.
 * =============================================================================
 * Two are left, and they refuse for different reasons. Keeping them here, shared
 * by both adapters, is what stops the mock from promising a form the real
 * backend denies.
 *
 * `publishTermos` used to sit here. It does not any more: publishing a legal
 * document is an act of the clinic, the backend exposes it, and each adapter
 * carries it out its own way.
 */

const MIGRATION_ONLY =
  "Os catálogos do sistema mudam por migração versionada, com revisão, e não por formulário: o mesmo vocabulário alimenta o diário do paciente, os relatórios e os gatilhos de alerta, e renomear um código aqui quebraria os três de uma vez.";

export const SETTINGS_WRITE_OPERATIONS = {
  /** Regra de produto: o vocabulário não se edita em tela. */
  update: async (): Promise<SingleResult<Configuracoes>> =>
    fail(ERROR_CODE.FORBIDDEN, MIGRATION_ONLY),

  /** Lacuna de backend: não há onde guardar o arquivo nem a cor. */
  uploadLogo: async (): Promise<SingleResult<{ url: string }>> =>
    fail(
      ERROR_CODE.NOT_IMPLEMENTED,
      "Não há onde guardar a identidade visual: nenhuma tabela de parâmetro e nenhum bucket de marca no Storage.",
    ),
};
