import { buildAdapter } from "../_stub";
import * as auth from "./auth";
import * as dashboard from "./dashboard";

/**
 * ADAPTER MOCK — implementação ativa enquanto o backend não existe.
 *
 * Cada recurso ganha seu arquivo (`pacientes.ts`, `usuarios.ts`, ...) na fase
 * correspondente do plano. Até lá, a operação existe e falha de forma
 * explícita com NOT_IMPLEMENTED, em vez de estourar `undefined`.
 *
 * Para implementar um recurso:
 *   1. crie `./pacientes.ts` exportando as operações de RESOURCES.pacientes
 *   2. importe aqui e registre em `implemented`
 *   3. `buildAdapter` preenche o resto com stubs automaticamente
 */
const implemented = {
  auth, // Fase 2
  dashboard, // Fase 4
  // Fase 5 -> pacientes
  // Fase 6 -> usuarios, permissoes
  // Fase 7 -> conteudos
};

export const mockAdapter = buildAdapter({ name: "mock", implemented });

export default mockAdapter;
