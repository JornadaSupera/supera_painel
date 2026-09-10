import { buildAdapter } from "../_stub";
import * as aprovacoes from "./aprovacoes";
import * as auditoria from "./auditoria";
import * as auth from "./auth";
import * as catalogos from "./catalogos";
import * as conteudos from "./conteudos";
import * as configuracoes from "./configuracoes";
import * as dashboard from "./dashboard";
import * as estatisticasClinicas from "./estatisticasClinicas";
import * as estatisticasOperacionais from "./estatisticasOperacionais";
import * as pacientes from "./pacientes";
import * as permissoes from "./permissoes";
import * as relatorios from "./relatorios";
import * as usuarios from "./usuarios";

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
  pacientes, // Fase 5
  catalogos, // Fase 5
  usuarios, // Fase 6
  permissoes, // Fase 6
  conteudos, // Fase 7
  aprovacoes, // Fase 7 — a fila vive na mesma tela
  auditoria, // Fase 10
  estatisticasClinicas, // Fase 12
  estatisticasOperacionais, // Fase 13
  configuracoes, // Fase 9
  relatorios, // Fase 8
};

/**
 * O mock implementa tudo que declara: nada a bloquear na interface.
 * Ver `INDISPONIVEIS` no adapter Supabase para o contrato desta lista.
 */
export const INDISPONIVEIS: Readonly<Record<string, string>> = {};

export const mockAdapter = buildAdapter({ name: "mock", implemented });

export default mockAdapter;
