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
  estatisticasClinicas,
  estatisticasOperacionais,
  configuracoes,
  relatorios,
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
  "pacientes.list.risco":
    "Não há classificação de risco no backend: nenhuma tabela de alerta e nenhuma regra de criticidade. Calcular no painel seria inferência clínica no front-end.",
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
  "conteudos.create":
    "Redigir orientação é do profissional da área, no espaço de trabalho dele — o banco exige que o autor seja quem escreve. O painel administrativo revisa, aprova e despublica.",
  "conteudos.update":
    "A edição do texto é do autor, e só enquanto a versão está em rascunho ou devolvida. Para pedir mudança, devolva a versão com um comentário.",
  "conteudos.submitForReview":
    "Enviar para revisão é o ato de quem escreveu — é assim que o texto entra nesta fila.",
  "auditoria.list.ip":
    "A trilha não registra endereço de IP: ela é escrita dentro do banco, por gatilho, e o Postgres não enxerga o endereço do navegador que originou a chamada.",
  "auditoria.summary.sigiloso":
    "A trilha não separa acesso sigiloso: ela guarda qual tabela foi lida, não qual linha nem sob que visibilidade. Contar exigiria copiar o recorte de sigilo para dentro do log.",
  "auditoria.summary.exportacao":
    "Exportação não gera linha na trilha: baixar um CSV do que já está na tela acontece no navegador, sem passar pelo banco.",
  "conteudos.list.visualizacoes":
    "Não há contagem de acessos: favorito e leitura vivem na biblioteca do paciente, e nem a equipe nem a administração têm política de leitura ali.",

  /* -------------------------------------------------------------------------
     LEITURA CLÍNICA EM CONJUNTO — a ausência que atinge três telas
     -------------------------------------------------------------------------
     As políticas de leitura da equipe são `TO clinical_reader`, e o papel de
     quem faz login (`authenticated`) não é membro dele: quem alcança aquelas
     linhas são as funções `read_*`, que têm `clinical_reader` como dono. Um
     `.from()` nessas tabelas devolve zero linhas SEM erro — e uma tela que soma
     zero linhas publica `0` com cara de medição.

     As `read_*` existem, mas são por paciente ou por conversa. Montar
     estatística com elas exigiria varrer a base a cada abertura de tela, e cada
     chamada grava acesso a prontuário em `audit_log`: o gráfico produziria
     centenas de "administrador leu o prontuário de fulano". Trocaríamos número
     errado por rastro sujo.

     O que libera é agregação no banco — função de resumo que devolva contagem,
     nunca linha. Ela é MELHOR em privacidade do que o que havia antes, porque
     nenhum registro de sintoma precisa chegar ao navegador.
     ------------------------------------------------------------------------- */
  "estatisticasClinicas.crossTab":
    "O cruzamento depende de ler diário e plano de toda a base ao mesmo tempo, e o backend só oferece essa leitura paciente a paciente. Falta uma leitura agregada, que devolva a contagem já somada sem expor registro de ninguém.",
  "estatisticasOperacionais.getIndicadores":
    "Os indicadores saem da agenda e do chat da clínica inteira, e o backend não oferece essa leitura em conjunto: a agenda só se lê por paciente e a conversa uma a uma.",
  "estatisticasOperacionais.getFilaAlertas":
    "Não existe fila de alertas no backend: não há tabela de alerta, regra de criticidade nem registro de conduta. Quem define o que é grave é a equipe assistencial, não o painel.",
  "relatorios.agregados":
    "Dez dos doze relatórios dependem de leitura clínica em conjunto — agenda, diário, plano e diagnóstico de toda a base — que o backend ainda não oferece. Cada um diz o seu motivo no próprio cartão.",
};

export const supabaseAdapter = buildAdapter({ name: "supabase", implemented });

export default supabaseAdapter;
