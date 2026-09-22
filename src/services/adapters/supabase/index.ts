// Both adapters register the same resources on purpose — `RESOURCES` checks
// the surface at compile time — so this block mirrors the other adapter.
// jscpd:ignore-start
import type { PartialAdapterModules } from "../../contracts/operations";
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
 */
/**
 * Ordenação da listagem de pacientes.
 *
 * `read_patient_list` aceita `full_name`, `birth_date` e `created_at`, e
 * **recusa** qualquer outro valor de `p_order_by` — não há SQL dinâmico do outro
 * lado. Ordenar por CID, fase ou situação exigiria ordenar a página atual no
 * cliente, o que ordenaria vinte linhas e chamaria isso de ordenação da base:
 * a segunda página voltaria a começar do começo.
 */
const SEM_ORDENACAO_NO_SERVIDOR =
  "A listagem do backend ordena por nome, nascimento e data de cadastro. Ordenar por esta coluna exigiria ordenar só a página visível, o que embaralharia a paginação em vez de ordenar a base.";

export const INDISPONIVEIS: Readonly<Record<string, string>> = {
  "pacientes.list.risco":
    "Não há classificação de risco no backend, e não vai haver nesta fase: “risco” são as etiquetas da sistematização de enfermagem do Gemed, que estão fora do escopo de leitura contratado. Calcular no painel seria inferência clínica no front-end.",
  "pacientes.filter.protocolo":
    "O filtro por protocolo existe no backend, mas não há catálogo de protocolos para oferecer: `protocol_name` é texto livre no plano terapêutico, sem tabela de domínio. Levantar os nomes em uso exigiria ler o plano de cada paciente, uma leitura auditada por paciente, só para preencher um seletor.",
  "pacientes.sort.cid": SEM_ORDENACAO_NO_SERVIDOR,
  "pacientes.sort.fase": SEM_ORDENACAO_NO_SERVIDOR,
  "pacientes.sort.status": SEM_ORDENACAO_NO_SERVIDOR,
  "pacientes.form.diagnostico":
    "Diagnóstico, estadiamento, protocolo e fase não são preenchidos no painel administrativo: registrá-los é ato clínico, e ainda não está decidido se este perfil pode praticá-lo. A ficha continua exibindo o que vier do sistema do consultório.",
  "pacientes.form.sexo":
    "Não há coluna de sexo no cadastro, e nenhuma tela do escopo a exibe. Coletar o campo gravaria no vazio.",
  "pacientes.deactivate.motivo":
    "O motivo da desativação não chega ao backend: a trilha guarda o ato e o ator, e não tem coluna de justificativa. O texto fica no registro do painel.",
  "pacientes.historico.remover":
    "Alergia e reação prévia não se apagam: o registro clínico é imutável, e a única operação do backend é acrescentar. Corrigir um termo errado é acrescentar o certo.",
  "pacientes.convite.envio":
    "O convite é emitido, não enviado: não há provedor de mensagem contratado. O código aparece uma vez na tela para ser passado ao paciente.",
  "usuarios.create.conta":
    "O painel não cria contas: ele concede perfil a quem já se cadastrou. Criar acesso de terceiro exigiria a chave de serviço, que nunca entra no navegador — e quem escolhe a senha tem que ser o titular, senão a trilha deixa de sustentar quem fez o quê.",
  "usuarios.update.identidade":
    "Nome e e-mail são da conta, e a única política de escrita ali é a do próprio titular. Corrigi-los é ato da pessoa, não da administração.",
  "usuarios.papel.gestor":
    "Gestor não existe como perfil no cadastro: há administrador e profissional, e nada entre os dois. O papel segue na matriz de permissões porque descreve um alcance real, mas não há onde gravá-lo.",
  "usuarios.list.horario":
    "Não há onde guardar a janela de atendimento no chat: nenhuma tabela tem as duas colunas de horário.",
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
  "auditoria.summary.exportacao":
    "Exportação não gera linha na trilha: baixar um CSV do que já está na tela acontece no navegador, sem passar pelo banco.",
  "conteudos.list.visualizacoes":
    "Não há contagem de acessos: favorito e leitura vivem na biblioteca do paciente, e nem a equipe nem a administração têm política de leitura ali.",

  /* -------------------------------------------------------------------------
     LEITURA CLÍNICA EM CONJUNTO — a ausência que atingia três telas
     -------------------------------------------------------------------------
     As políticas de leitura da equipe são `TO clinical_reader`, e o papel de
     quem faz login (`authenticated`) não é membro dele: quem alcança aquelas
     linhas são as funções `read_*`, que têm `clinical_reader` como dono. Um
     `.from()` nessas tabelas devolve zero linhas SEM erro — e uma tela que soma
     zero linhas publica `0` com cara de medição. Era o estado das três telas de
     número.

     A família `summarize_*` resolveu isso: o banco devolve a contagem já somada,
     **sem que nenhuma linha de prontuário chegue ao navegador**. É melhor em
     privacidade do que somar no cliente, e paga UMA leitura auditada onde a soma
     no cliente pagava uma por paciente. `estatisticasClinicas.crossTab` e
     `estatisticasOperacionais.getIndicadores` saíram desta lista.

     O que continua fora tem causa própria, e nenhuma delas é de leitura.
     ------------------------------------------------------------------------- */
  "estatisticasClinicas.prevalencia":
    "O resumo do banco devolve quantos registros e quantas pessoas relataram cada sintoma em cada grau, mas não devolve quantos pacientes havia no protocolo no período — o denominador da prevalência. Sem ele o mapa mostra contagem de registros, que é exata, em vez de um percentual sobre denominador ausente.",
  "estatisticasOperacionais.mensagensPorDia":
    "O resumo do chat conta conversas, não mensagens: a unidade é a conversa aberta e o instante da primeira resposta da equipe. Contar mensagens exigiria ler cada conversa, e cada leitura registra acesso a conteúdo clínico.",
  "estatisticasOperacionais.getFilaAlertas":
    "A fila de alertas existe no backend, mas nenhum gatilho de criticidade foi cadastrado: sem regra, nenhum alerta dispara, e a fila está vazia por configuração, não por ausência de ocorrência. O limiar é decisão clínica, e cadastrá-lo é ato da administração.",
  "estatisticasOperacionais.porProfissional":
    "O recorte dos resumos é por especialidade, e por profissional não existe — no backend nem aqui. Ranquear pessoa por volume ou por tempo de resposta transformaria um painel de operação em avaliação individual de desempenho, e com poucos casos a média re-identifica quem atendeu.",
  "relatorios.agregados":
    "Três dos doze relatórios não têm origem no backend: alertas de IA, NPS e conteúdo mais acessado. Cada um diz o seu motivo no próprio cartão.",
};

export const supabaseAdapter = buildAdapter({ name: "supabase", implemented });

export default supabaseAdapter;
