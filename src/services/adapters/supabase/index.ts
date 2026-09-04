import { buildAdapter } from "../_stub";
import * as auth from "./auth";
import * as catalogos from "./catalogos";
import * as dashboard from "./dashboard";
import * as pacientes from "./pacientes";
import * as permissoes from "./permissoes";
import * as usuarios from "./usuarios";

/**
 * ADAPTER SUPABASE.
 *
 * Mesma superfície do mock, verificada em tempo de compilação por
 * `RESOURCES`: operação declarada e não escrita vira stub NOT_IMPLEMENTED, não
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
 *
 * Recursos ainda no stub: `conteudos`, `aprovacoes`, `relatorios`,
 * `estatisticasClinicas`, `estatisticasOperacionais`, `auditoria` e
 * `configuracoes`.
 */
const implemented = {
  auth,
  dashboard,
  pacientes,
  catalogos,
  usuarios,
  permissoes,
};

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
 */
export const INDISPONIVEIS: Readonly<Record<string, string>> = {
  "pacientes.list.cid":
    "A listagem não traz o CID: o diagnóstico só se lê paciente a paciente, e cada leitura registra um acesso ao prontuário. Ele aparece na ficha.",
  "pacientes.list.protocolo":
    "A listagem não traz o protocolo: o plano terapêutico só se lê paciente a paciente. Ele aparece na ficha.",
  "pacientes.create":
    "O cadastro de paciente ainda não existe no backend: a tabela só permite leitura.",
  "pacientes.update": "A edição de ficha ainda não existe no backend.",
  "pacientes.deactivate": "A desativação de paciente ainda não existe no backend.",
  "pacientes.sendInvite":
    "O convite de acesso ao app ainda não existe no backend: falta o vínculo entre a ficha e a conta.",
  "usuarios.create": "O cadastro de profissional ainda não existe no backend.",
  "usuarios.update": "A edição de profissional ainda não existe no backend.",
  "usuarios.pause":
    "Pausar acesso ainda não existe no backend: só há ativo e inativo. Desativar revoga o acesso na hora.",
  "usuarios.setMfa":
    "O segundo fator é gerenciado pela própria pessoa, no aplicativo autenticador dela.",
  "permissoes.updateMatrix":
    "A matriz de permissões ainda não é dado do backend: o catálogo está vazio.",
};

export const supabaseAdapter = buildAdapter({ name: "supabase", implemented });

export default supabaseAdapter;
