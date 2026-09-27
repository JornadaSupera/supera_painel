import { ERROR_CODE, fail, type SingleResult } from "@/services/contracts";
import type { Configuracoes } from "@/types/configuracao";

/**
 * THE ONE SETTINGS WRITE THAT STILL REFUSES — and why.
 * =============================================================================
 * Shared by both adapters, so the mock never promises a form the real backend
 * denies. `uploadLogo`, identity, messages and business hours used to sit
 * here too — `clinic_settings` (25/09/2026) gave each a real place to land,
 * and each adapter now implements them its own way. Vocabulary label, order
 * and active/retired followed the same path (`update_vocabulary_term` +
 * `set_vocabulary_term_active`, also 25/09/2026) — see `atualizarTermoVocabulario`
 * and `setTermoVocabularioAtivo` in each adapter.
 *
 * `publishTermos` used to sit here as well: publishing a legal document is an
 * act of the clinic, the backend exposes it, and each adapter carries it out
 * its own way.
 *
 * `update` is what is left: it takes the whole `Configuracoes` object at
 * once, and never was any screen's write path — not before this vocabulary
 * became editable, and not after. It stays refused because nothing should
 * ever call it, not because the vocabulary is fixed.
 */

const NOT_A_WRITE_PATH =
  "Esta operação recebe o objeto Configuracoes inteiro e nunca foi o caminho de escrita de nada neste painel. Rótulo, ordem e o estado ativo/retirado do vocabulário mudam por atualizarTermoVocabulario e setTermoVocabularioAtivo; o resto das telas de Configurações tem a própria RPC.";

export const SETTINGS_WRITE_OPERATIONS = {
  /** Não é regra de produto — é uma operação que nunca teve implementação. */
  update: async (): Promise<SingleResult<Configuracoes>> =>
    fail(ERROR_CODE.FORBIDDEN, NOT_A_WRITE_PATH),
};
