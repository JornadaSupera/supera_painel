// Both adapters register the same resources on purpose — `RESOURCES` checks
// the surface at compile time — so this block mirrors the other adapter.
// jscpd:ignore-start
import type { PartialAdapterModules } from "../../contracts/operations";
import { buildAdapter } from "../_stub";
import * as aprovacoes from "./aprovacoes";
import * as auditoria from "./auditoria";
import * as auth from "./auth";
import * as catalogos from "./catalogos";
import * as clinico from "./clinico";
import * as conversationTransfer from "./conversationTransfer";
import * as patientRecord from "./patientRecord";
import * as personalAgenda from "./personalAgenda";
import * as scheduling from "./scheduling";
import * as conteudos from "./conteudos";
import * as configuracoes from "./configuracoes";
import * as dashboard from "./dashboard";
import * as estatisticasClinicas from "./estatisticasClinicas";
import * as estatisticasOperacionais from "./estatisticasOperacionais";
import * as pacientes from "./pacientes";
import * as permissoes from "./permissoes";
import * as relatorios from "./relatorios";
import * as satisfacao from "./satisfacao";
import * as usuarios from "./usuarios";

/**
 * ADAPTER SUPABASE.
 *
 * A superfície é a de `RESOURCES`, verificada em tempo de compilação: operação declarada e não escrita vira stub NOT_IMPLEMENTED, não
 * `undefined is not a function`.
 *
 * Duas regras do banco valem para tudo que se escrever aqui, e nenhuma delas é
 * negociável no cliente:
 *
 *  1. **Leitura clínica é por `.rpc('read_…')`, nunca por `.from()`.** As
 *     políticas da equipe só valem dentro dessas funções, que registram o
 *     acesso em `audit_log`. Com `.from()` o painel recebe zero linhas, sem
 *     erro nenhum — o sintoma é uma lista vazia inexplicável.
 *  2. **Quase toda escrita é RPC.** Fora da lista fechada do guia do banco,
 *     `.insert()` devolve `permission denied`. Não funciona "por acaso".

 */
const implemented = {
  auth,
  dashboard,
  pacientes,
  catalogos,
  usuarios,
  permissoes,
  conteudos,
  aprovacoes,
  auditoria,
  // The record, the transfer, the personal calendar and the scheduling live in their own files but answer to the same resource.
  clinico: { ...clinico, ...patientRecord, ...conversationTransfer, ...personalAgenda, ...scheduling },
  estatisticasClinicas,
  estatisticasOperacionais,
  configuracoes,
  relatorios,
  satisfacao,
} satisfies PartialAdapterModules;
// jscpd:ignore-end

/**
 * O QUE O BACKEND AINDA NÃO EXECUTA — e por quê.
 * =============================================================================
 * Operação que existe no contrato e não tem caminho no banco. A interface lê
 * esta lista para desabilitar a ação **antes** de a pessoa preencher um
 * formulário inteiro e só então receber `permission denied`.
 *
 * O motivo é o texto que a tela exibe. Descreve a regra, não o arquivo: quem
 * opera o painel precisa saber o que pedir a quem, não onde está escrito.
 *
 * Cada linha sai daqui no dia em que o banco ganhar a política ou a função
 * correspondente — e nenhuma tela muda junto.
 *
 * Só entra aqui a chave que uma tela lê por `motivoIndisponivel`. O que o banco
 * ainda não tem e a tela já mostra por conta própria (os cartões de relatório
 * sem origem, a fila de alertas sem gatilho) diz o seu motivo no próprio lugar.
 */
export const INDISPONIVEIS: Readonly<Record<string, string>> = {
  "pacientes.list.risco":
    "Não há classificação de risco disponível, e não vai haver nesta fase: “risco” são as etiquetas da sistematização de enfermagem do Gemed, que estão fora do escopo de leitura contratado. Calcular no painel seria inferência clínica no front-end.",
  "auditoria.summary.exportacao":
    "Exportação não gera linha na trilha: baixar um CSV do que já está na tela acontece no navegador, sem passar pelo banco.",
};

export const supabaseAdapter = buildAdapter({ name: "supabase", implemented });

export default supabaseAdapter;
