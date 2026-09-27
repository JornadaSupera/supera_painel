import { ERROR_CODE, fail, type SingleResult } from "@/services/contracts";
import type { Configuracoes } from "@/types/configuracao";

/**
 * THE ONE SETTINGS WRITE THAT STILL REFUSES — and why.
 * =============================================================================
 * Shared by both adapters, so the mock never promises a form the real backend
 * denies. `uploadLogo`, identity, messages and business hours used to sit
 * here too — `clinic_settings` (25/09/2026) gave each a real place to land,
 * and each adapter now implements them its own way.
 *
 * `publishTermos` used to sit here as well: publishing a legal document is an
 * act of the clinic, the backend exposes it, and each adapter carries it out
 * its own way.
 */

const MIGRATION_ONLY =
  "Os catálogos do sistema mudam por migração versionada, com revisão, e não por formulário: o mesmo vocabulário alimenta o diário do paciente, os relatórios e os gatilhos de alerta, e renomear um código aqui quebraria os três de uma vez.";

export const SETTINGS_WRITE_OPERATIONS = {
  /** Regra de produto: o vocabulário não se edita em tela. */
  update: async (): Promise<SingleResult<Configuracoes>> =>
    fail(ERROR_CODE.FORBIDDEN, MIGRATION_ONLY),
};
