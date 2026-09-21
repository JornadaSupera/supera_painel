import { Ban, Fingerprint, ShieldAlert } from "lucide-react";

import type { LegalDocument } from "../types";
import {
  CONTROLLER,
  DATA_PROTECTION_OFFICER,
  EMERGENCY_NUMBER,
  IN_APP_PRIVACY_PATH,
} from "./controller";

const officerContact = DATA_PROTECTION_OFFICER.email
  ? `pelo e-mail ${DATA_PROTECTION_OFFICER.email}`
  : `pelo telefone ${CONTROLLER.phone}, pedindo para falar com o Encarregado de Dados`;

export const PRIVACY_POLICY: LegalDocument = {
  slug: "privacidade",
  title: "Política de Privacidade",
  documentTitle: "Política de Privacidade · Jornada Supera",
  summary:
    "Como o Jornada Supera coleta, usa, guarda e protege os seus dados — inclusive os dados de saúde — e como você exerce os seus direitos pela Lei Geral de Proteção de Dados.",
  version: "1.0",
  effectiveAt: "2026-09-21T12:00:00.000Z",


  sections: [
    {
      id: "quem-somos",
      title: "Quem é responsável pelos seus dados",
      blocks: [
        {
          type: "paragraph",
          text: [
            "O Jornada Supera é a plataforma de acompanhamento oncológico do ",
            { strong: CONTROLLER.name },
            `, inscrito no CNPJ sob o nº ${CONTROLLER.taxId}, com sede na ${CONTROLLER.address}. O Centro é o `,
            { strong: "Controlador" },
            " dos dados pessoais tratados na plataforma: é ele quem decide para que e como os seus dados são usados.",
          ],
        },
        {
          type: "paragraph",
          text: [
            "A empresa contratada para desenvolver, implantar e dar suporte técnico à plataforma atua como ",
            { strong: "Operadora" },
            ", tratando dados apenas em nome do Centro, segundo as instruções dele e sob dever de confidencialidade.",
          ],
        },
        {
          type: "paragraph",
          text: `Qualquer dúvida sobre esta Política pode ser encaminhada ao Encarregado pelo Tratamento de Dados Pessoais (DPO) ${officerContact}, ou pelo próprio aplicativo em ${IN_APP_PRIVACY_PATH}.`,
        },
      ],
    },
    {
      id: "abrangencia",
      title: "A quem esta Política se aplica",
      blocks: [
        {
          type: "paragraph",
          text: "Esta Política vale para todas as pessoas cujos dados passam pelo Jornada Supera:",
        },
        {
          type: "list",
          items: [
            [
              { strong: "Pacientes" },
              " em acompanhamento no Centro, usuários do aplicativo para Android e iOS;",
            ],
            [
              { strong: "Cuidadores acompanhantes" },
              " convidados pelo paciente para acompanhar a jornada dele;",
            ],
            [
              { strong: "Profissionais de saúde" },
              " da equipe multidisciplinar e da gestão, usuários do painel clínico e do painel administrativo;",
            ],
            [
              { strong: "Visitantes" },
              " destas páginas públicas e de qualquer página da plataforma acessível sem login.",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "Esta Política complementa, e não substitui, o sigilo médico e as normas éticas das profissões de saúde, que continuam valendo integralmente sobre as informações do seu atendimento.",
        },
      ],
    },
    {
      id: "definicoes",
      title: "Termos que usamos",
      blocks: [
        {
          type: "definitions",
          items: [
            {
              term: "Dado pessoal",
              text: "Informação que identifica você ou permite identificá-lo, como nome, CPF, telefone ou e-mail.",
            },
            {
              term: "Dado pessoal sensível",
              text: "Dado sobre a sua saúde, entre outros previstos em lei. Sintomas, diagnóstico, CID, estadiamento, tratamento, alergias e anotações clínicas são dados sensíveis.",
            },
            {
              term: "Titular",
              text: "A pessoa a quem os dados se referem — você.",
            },
            {
              term: "Tratamento",
              text: "Toda operação feita com dados: coleta, uso, acesso, armazenamento, compartilhamento, correção, eliminação.",
            },
            {
              term: "Anonimização",
              text: "Processo que impede, por meios técnicos razoáveis, que um dado seja associado a você.",
            },
            {
              term: "ANPD",
              text: "Autoridade Nacional de Proteção de Dados, órgão que fiscaliza o cumprimento da LGPD.",
            },
          ],
        },
      ],
    },
    {
      id: "dados-coletados",
      title: "Quais dados tratamos",
      blocks: [
        {
          type: "paragraph",
          text: "Tratamos apenas o necessário para o seu acompanhamento. Os dados dependem do seu papel na plataforma:",
        },
        {
          type: "table",
          caption: "Dados de pacientes",
          columns: ["Categoria", "Exemplos"],
          rows: [
            [
              "Identificação",
              "Nome completo, CPF, data de nascimento, sexo, código de paciente e foto de perfil, quando enviada.",
            ],
            ["Contato", "Telefone celular, e-mail e convênio."],
            [
              "Dados clínicos (sensíveis)",
              "Diagnóstico e CID-10, estadiamento, protocolo e fase do tratamento, alergias, reações prévias, médico responsável e plano terapêutico.",
            ],
            [
              "Diário de sintomas (sensível)",
              "Os sintomas que você registra, a intensidade de cada um na escala de 0 a 5, o texto livre que escrever e a data de cada registro.",
            ],
            [
              "Comunicação com a equipe",
              "Mensagens do chat, assunto da conversa, imagens e anexos enviados, confirmações de leitura e encaminhamentos entre profissionais.",
            ],
            [
              "Agenda",
              "Consultas, sessões e exames, com data, local, profissional, status e confirmações.",
            ],
            [
              "Uso de conteúdo",
              "Orientações lidas, favoritadas ou pendentes de leitura.",
            ],
            ["Pesquisa de satisfação", "Nota de 0 a 10 e o comentário, se você escrever um."],
            [
              "Consentimentos e pedidos",
              "Versão dos Termos e desta Política que você aceitou, data do aceite, eventual revogação e os pedidos que fizer como titular.",
            ],
          ],
        },
        {
          type: "table",
          caption: "Dados de cuidadores acompanhantes",
          columns: ["Categoria", "Exemplos"],
          rows: [
            [
              "Convite",
              "Telefone ou e-mail informado pelo paciente para enviar o convite, e o status do convite.",
            ],
            [
              "Cadastro",
              "Nome, contato, vínculo com o paciente, permissões concedidas por ele, datas de concessão e de revogação.",
            ],
          ],
        },
        {
          type: "table",
          caption: "Dados de profissionais e administradores",
          columns: ["Categoria", "Exemplos"],
          rows: [
            [
              "Cadastro profissional",
              "Nome, e-mail corporativo, especialidade, número de registro no conselho de classe, papel, permissões, horário de atendimento e foto.",
            ],
            [
              "Atuação na plataforma",
              "Registros de atendimento, condutas sobre alertas, revisões de conteúdo e demais ações registradas na trilha de auditoria.",
            ],
          ],
        },
        {
          type: "table",
          caption: "Dados técnicos, de todos os usuários",
          columns: ["Categoria", "Exemplos"],
          rows: [
            [
              "Autenticação e segurança",
              "Credenciais (a senha é guardada apenas de forma cifrada, nunca em texto legível), fatores de verificação em duas etapas, datas de login e de último acesso.",
            ],
            [
              "Registros de acesso",
              "Endereço IP, data e hora, navegador ou aparelho utilizado, e a ação realizada, sempre que um dado clínico é acessado ou alterado.",
            ],
            [
              "Aparelho",
              "Identificador para envio de notificações e preferências do aplicativo, como tema e notificações.",
            ],
            [
              "Login social",
              "Se você optar por entrar com Google ou Apple: nome, e-mail e identificador da conta fornecidos por esse serviço. Não recebemos a sua senha dessas contas.",
            ],
          ],
        },
        {
          type: "callout",
          tone: "success",
          icon: Fingerprint,
          title: "Sua biometria não sai do seu aparelho",
          text: "Quando você usa impressão digital ou reconhecimento facial para abrir o aplicativo, a verificação é feita pelo sistema do seu celular. O Jornada Supera recebe apenas a resposta “confirmado” ou “não confirmado” — nunca a sua digital ou a imagem do seu rosto.",
        },
        {
          type: "paragraph",
          text: [
            { strong: "O que não coletamos: " },
            "sua localização, seus contatos, suas fotos fora das que você escolher enviar, seu microfone ou dados de outros aplicativos.",
          ],
        },
      ],
    },
    {
      id: "origem",
      title: "De onde vêm os dados",
      blocks: [
        {
          type: "list",
          items: [
            [
              { strong: "Do Centro: " },
              "seu cadastro, diagnóstico e plano de tratamento são registrados pela equipe, inclusive a partir do sistema de gestão clínica do Centro (Gemed).",
            ],
            [
              { strong: "De você: " },
              "tudo o que você registra no aplicativo — diário, mensagens, respostas e preferências.",
            ],
            [
              { strong: "Do paciente, sobre o cuidador: " },
              "o contato do cuidador é informado pelo paciente, apenas para enviar o convite.",
            ],
            [
              { strong: "Da equipe: " },
              "respostas, condutas e registros de atendimento dos profissionais.",
            ],
            [
              { strong: "Do uso da plataforma: " },
              "registros técnicos e de acesso gerados automaticamente.",
            ],
            [
              { strong: "De serviços de login: " },
              "Google ou Apple, somente se você escolher entrar por eles.",
            ],
          ],
        },
      ],
    },
    {
      id: "finalidades",
      title: "Para que usamos e com qual base legal",
      blocks: [
        {
          type: "paragraph",
          text: "Cada uso dos seus dados tem uma finalidade definida e uma base legal prevista na LGPD (Lei nº 13.709/2018):",
        },
        {
          type: "table",
          caption: "Finalidades e bases legais",
          columns: ["Finalidade", "Base legal"],
          rows: [
            [
              "Acompanhar o seu tratamento: diário de sintomas, chat com a equipe, agenda, orientações e alertas de sintomas graves",
              "Tutela da saúde, em procedimento realizado por profissionais de saúde (art. 11, II, “f”)",
            ],
            [
              "Integrar as informações ao prontuário e ao sistema de gestão clínica do Centro",
              "Tutela da saúde (art. 11, II, “f”) e cumprimento de obrigação legal ou regulatória (art. 11, II, “a”)",
            ],
            [
              "Criar e manter a sua conta, confirmar a sua identidade e permitir o login",
              "Execução de contrato (art. 7º, V) e prevenção à fraude e segurança do titular na identificação e autenticação (art. 11, II, “g”)",
            ],
            [
              "Enviar lembretes de consulta, avisos da equipe, códigos de verificação e e-mails de recuperação de senha",
              "Execução de contrato (art. 7º, V) e tutela da saúde (art. 11, II, “f”)",
            ],
            [
              "Registrar quem acessou cada dado clínico, quando, de onde e para quê",
              "Cumprimento de obrigação legal (art. 7º, II, e art. 11, II, “a”) e prevenção à fraude (art. 11, II, “g”)",
            ],
            [
              "Permitir que o cuidador acompanhe a sua jornada",
              "Consentimento do paciente (art. 11, I), revogável a qualquer momento",
            ],
            [
              "Enviar o convite ao cuidador antes de ele aceitar",
              "Legítimo interesse do paciente, limitado à entrega do convite (art. 7º, IX)",
            ],
            [
              "Pesquisa de satisfação",
              "Legítimo interesse do Centro em melhorar o atendimento (art. 7º, IX); responder é opcional",
            ],
            [
              "Gerar indicadores e estatísticas de qualidade assistencial e de operação",
              "Tutela da saúde (art. 11, II, “f”), com dados agregados e, sempre que possível, anonimizados",
            ],
            [
              "Atender pedidos de titulares, autoridades e defender direitos em processos",
              "Cumprimento de obrigação legal (art. 7º, II) e exercício regular de direitos (art. 7º, VI, e art. 11, II, “d”)",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "Na ativação da conta, pedimos também o seu aceite expresso ao tratamento dos seus dados de saúde no aplicativo. Esse aceite é uma camada adicional de transparência: a base principal do seu atendimento continua sendo a tutela da saúde, e por isso as informações que já integram o seu prontuário seguem as regras de guarda do prontuário mesmo se você revogar o aceite.",
        },
        {
          type: "callout",
          tone: "info",
          title: "Uso para pesquisa",
          text: "Seus dados identificáveis não são usados em pesquisa científica sem aprovação de um Comitê de Ética em Pesquisa e, quando exigido, sem o seu consentimento específico, em documento próprio. Estatísticas usadas em apresentações, congressos ou auditorias são agregadas e não identificam pacientes.",
        },
      ],
    },
    {
      id: "sigilo",
      title: "Dados de saúde e sigilo profissional",
      blocks: [
        {
          type: "list",
          items: [
            "Cada profissional acessa apenas o necessário para a sua função e especialidade. O acesso é definido por perfil e reforçado diretamente no banco de dados — não depende só da tela.",
            "Anotações de Psicologia são restritas aos profissionais de Psicologia. Nem mesmo administradores da plataforma as acessam por causa do cargo.",
            "Todo acesso a dado clínico fica registrado em uma trilha de auditoria que não pode ser alterada, com quem acessou, quando, de onde e qual ação realizou.",
            "CPF, telefone e e-mail aparecem mascarados nas telas da equipe. Exibir o dado completo exige uma ação explícita, que também fica registrada.",
            "Alertas de sintomas graves são enviados à equipe e ao sistema de gestão clínica do Centro para que um profissional avalie o seu caso.",
          ],
        },
      ],
    },
    {
      id: "cuidador",
      title: "Cuidador acompanhante",
      blocks: [
        {
          type: "list",
          items: [
            "Apenas o paciente pode convidar um cuidador, escolher o que ele pode ver ou fazer e revogar o acesso, a qualquer momento, pelo aplicativo.",
            "O cuidador acessa somente o que o paciente autorizou. Ele não pode aceitar termos, revogar consentimentos, pedir a exportação ou a exclusão de dados em nome do paciente.",
            "As ações realizadas pelo cuidador ficam identificadas como dele na trilha de auditoria.",
            "O contato informado para o convite é usado apenas para entregar o convite. O paciente declara ter autorização do cuidador para compartilhar esse contato.",
            "Ao aceitar o convite, o cuidador passa a ser também titular dos próprios dados na plataforma, com todos os direitos desta Política.",
          ],
        },
      ],
    },
    {
      id: "menores",
      title: "Crianças e adolescentes",
      blocks: [
        {
          type: "paragraph",
          text: "Quando o paciente tiver menos de 18 anos, o tratamento dos dados é feito no seu melhor interesse, com o consentimento específico de pelo menos um dos pais ou do responsável legal, que acompanha o uso da plataforma e exerce os direitos do titular em nome dele, nos termos do art. 14 da LGPD e do Estatuto da Criança e do Adolescente.",
        },
      ],
    },
    {
      id: "compartilhamento",
      title: "Com quem compartilhamos",
      blocks: [
        {
          type: "callout",
          tone: "success",
          icon: Ban,
          title: "Nunca vendemos seus dados",
          text: "Seus dados não são vendidos, alugados, cedidos para publicidade nem compartilhados com planos de saúde, empregadores, seguradoras ou laboratórios para fins comerciais.",
        },
        {
          type: "paragraph",
          text: "Compartilhamos dados apenas quando necessário, com o mínimo de informação possível:",
        },
        {
          type: "table",
          caption: "Destinatários dos dados",
          columns: ["Com quem", "Para quê"],
          rows: [
            [
              "Equipe multidisciplinar do Centro",
              "Seu acompanhamento clínico, conforme a especialidade e o sigilo de cada profissão.",
            ],
            [
              "Sistema de gestão clínica do Centro (Gemed)",
              "Leitura do cadastro, do plano terapêutico e do CID-10; registro do resumo do diário e dos alertas críticos no seu prontuário.",
            ],
            [
              "Provedor de banco de dados, autenticação e armazenamento de arquivos (Supabase)",
              "Guardar os dados da plataforma com segurança, em servidores no Brasil.",
            ],
            [
              "Hospedagem das páginas web (Google Firebase)",
              "Entregar os arquivos do painel e destas páginas. Não armazena dados clínicos.",
            ],
            [
              "Serviço de notificações (OneSignal) e lojas de aplicativos (Apple e Google)",
              "Entregar notificações no seu celular e distribuir o aplicativo. As notificações não trazem detalhes clínicos no texto.",
            ],
            [
              "Provedores de SMS e de e-mail transacional",
              "Enviar códigos de verificação, convites, lembretes e recuperação de senha.",
            ],
            [
              "Google e Apple, no login social",
              "Confirmar a sua identidade, somente se você escolher esse meio de login.",
            ],
            [
              "Autoridades públicas",
              "Cumprir obrigação legal, ordem judicial ou requisição de autoridade competente, no limite do que for exigido.",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "Todos os prestadores de serviço estão sujeitos a obrigações de confidencialidade e de segurança compatíveis com esta Política, e só podem usar os dados para executar o serviço contratado. Um novo fornecedor que passe a tratar dados pessoais será informado nesta Política antes de começar.",
        },
      ],
    },
    {
      id: "transferencia-internacional",
      title: "Transferência internacional",
      blocks: [
        {
          type: "paragraph",
          text: "O banco de dados principal, com os seus dados clínicos, fica em servidores localizados no Brasil. Alguns serviços de apoio — entrega de notificações, login social, lojas de aplicativos e a rede de distribuição das páginas web — podem processar dados técnicos, como o identificador do aparelho, fora do país.",
        },
        {
          type: "paragraph",
          text: "Nesses casos, a transferência ocorre apenas nas hipóteses do art. 33 da LGPD, com fornecedores que oferecem garantias de proteção compatíveis com a lei brasileira, como cláusulas contratuais padrão, e sem envio do conteúdo clínico.",
        },
      ],
    },
    {
      id: "retencao",
      title: "Por quanto tempo guardamos",
      blocks: [
        {
          type: "paragraph",
          text: "Guardamos os dados apenas pelo tempo necessário para cada finalidade, respeitando os prazos exigidos por lei:",
        },
        {
          type: "table",
          caption: "Prazos de guarda",
          columns: ["Dado", "Prazo"],
          rows: [
            [
              "Informações que integram o prontuário do paciente",
              "No mínimo 20 anos a partir do último registro, conforme a Lei nº 13.787/2018 e as normas do Conselho Federal de Medicina.",
            ],
            [
              "Registros de acesso à aplicação (IP, data e hora)",
              "No mínimo 6 meses, conforme o art. 15 do Marco Civil da Internet (Lei nº 12.965/2014).",
            ],
            [
              "Trilha de auditoria de acesso a dados clínicos",
              "Pelo prazo definido na política de segurança do Centro, suficiente para responder a fiscalizações e pedidos de titulares.",
            ],
            [
              "Aceites dos Termos e desta Política",
              "Enquanto a conta existir e, depois, pelo prazo necessário para comprovar o aceite em eventual processo.",
            ],
            [
              "Contato usado em convite de cuidador",
              "Até o convite ser aceito ou cancelado, mantido depois apenas no registro de auditoria.",
            ],
            [
              "Demais dados da conta",
              "Enquanto a conta estiver ativa, e depois eliminados ou anonimizados, salvo obrigação legal de guarda.",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "Encerrado o prazo, os dados são eliminados ou anonimizados. Cópias de segurança seguem o seu próprio ciclo técnico de expurgo.",
        },
      ],
    },
    {
      id: "seguranca",
      title: "Como protegemos seus dados",
      blocks: [
        {
          type: "list",
          items: [
            "Criptografia em trânsito (HTTPS) e em repouso.",
            "Isolamento de dados por usuário diretamente no banco de dados, em todas as tabelas.",
            "Verificação em duas etapas obrigatória para administradores e disponível para profissionais.",
            "Encerramento automático da sessão do painel por inatividade.",
            "Senhas guardadas somente de forma cifrada; credenciais do aplicativo guardadas no armazenamento seguro do celular.",
            "Nenhum dado clínico gravado no navegador dos computadores da equipe.",
            "Ambientes de teste separados do ambiente real, preferencialmente com dados fictícios.",
            "Cópias de segurança periódicas, atualização de componentes de segurança e monitoramento de acessos.",
            "Acesso administrativo ao ambiente real restrito a pessoas autorizadas, registrado e revogado quando deixa de ser necessário.",
          ],
        },
        {
          type: "paragraph",
          text: "Nenhum sistema é totalmente imune a falhas. Por isso, também dependemos de você: mantenha a sua senha em segredo, use o bloqueio de tela do celular e avise o Centro se suspeitar de acesso indevido à sua conta.",
        },
      ],
    },
    {
      id: "direitos",
      title: "Seus direitos",
      blocks: [
        {
          type: "paragraph",
          text: "Pelo art. 18 da LGPD, você pode pedir, a qualquer momento e sem custo:",
        },
        {
          type: "list",
          items: [
            [{ strong: "Confirmação e acesso: " }, "saber se tratamos seus dados e receber uma cópia deles;"],
            [{ strong: "Correção: " }, "corrigir dados incompletos, inexatos ou desatualizados;"],
            [
              { strong: "Anonimização, bloqueio ou eliminação " },
              "de dados desnecessários, excessivos ou tratados em desconformidade com a lei;",
            ],
            [{ strong: "Portabilidade: " }, "receber seus dados em formato estruturado, para levar a outro serviço;"],
            [
              { strong: "Eliminação " },
              "dos dados tratados com base no seu consentimento, ressalvadas as hipóteses de guarda obrigatória;",
            ],
            [{ strong: "Informação " }, "sobre com quem seus dados foram compartilhados;"],
            [
              { strong: "Informação sobre não consentir " },
              "e as consequências de não fornecer o consentimento;",
            ],
            [{ strong: "Revogação " }, "do consentimento;"],
            [{ strong: "Oposição " }, "a tratamento que descumpra a lei;"],
            [
              { strong: "Revisão " },
              "de decisões tomadas unicamente com base em tratamento automatizado.",
            ],
          ],
        },
        {
          type: "paragraph",
          text: `Pedidos de acesso, portabilidade e exclusão podem ser feitos pelo aplicativo, em ${IN_APP_PRIVACY_PATH}, ou ${officerContact}. Para proteger você, podemos pedir a confirmação da sua identidade antes de atender. A confirmação e o acesso aos dados são respondidos em até 15 dias; os demais pedidos, no menor prazo possível, dentro do previsto na regulamentação da ANPD.`,
        },
        {
          type: "callout",
          tone: "warning",
          title: "O que a exclusão não apaga",
          text: "Excluir a conta encerra o seu acesso ao aplicativo e elimina os dados que não precisam ser guardados. As informações que integram o seu prontuário, os registros de acesso e a trilha de auditoria são mantidos pelos prazos legais, porque o Centro é obrigado por lei a guardá-los. Nesses casos, informamos o motivo da guarda na resposta ao seu pedido.",
        },
        {
          type: "paragraph",
          text: [
            "Se considerar que o seu pedido não foi atendido, você também pode peticionar à Autoridade Nacional de Proteção de Dados em ",
            { href: "https://www.gov.br/anpd", label: "gov.br/anpd" },
            ".",
          ],
        },
      ],
    },
    {
      id: "consentimento",
      title: "Consentimento e revogação",
      blocks: [
        {
          type: "list",
          items: [
            "O aceite dos Termos de Uso e desta Política fica registrado com a versão exata do texto, a data e a hora.",
            "Você pode revogar o consentimento a qualquer momento. A revogação vale dali em diante e não torna irregular o que foi feito antes dela.",
            "Sem o consentimento ao tratamento dos dados de saúde no aplicativo, não é possível usar o diário de sintomas, o chat e os demais recursos de acompanhamento. O seu atendimento presencial no Centro continua normalmente.",
            "Apenas o próprio titular revoga o consentimento — nunca o cuidador.",
          ],
        },
      ],
    },
    {
      id: "decisoes-automatizadas",
      title: "Alertas automáticos e inteligência artificial",
      blocks: [
        {
          type: "paragraph",
          text: "Quando você registra um sintoma com intensidade acima dos limites definidos pela equipe clínica, a plataforma gera um alerta automático para os profissionais. O alerta só avisa: quem avalia o seu caso e decide a conduta é sempre um profissional de saúde. Nenhuma decisão sobre o seu tratamento é tomada apenas por sistema automatizado.",
        },
        {
          type: "paragraph",
          text: "Eventuais recursos de inteligência artificial da plataforma não recebem dados que identifiquem pacientes e não fazem diagnóstico, triagem, priorização de atendimento ou orientação clínica. Antes de entrar em uso, o provedor e o local de processamento desses recursos são informados nesta Política.",
        },
      ],
    },
    {
      id: "armazenamento-local",
      title: "Cookies e armazenamento no aparelho",
      blocks: [
        {
          type: "paragraph",
          text: "Não usamos cookies de publicidade, ferramentas de rastreamento de terceiros nem perfis de comportamento para marketing.",
        },
        {
          type: "list",
          items: [
            "No computador, o painel guarda apenas preferências de exibição, como o tema claro ou escuro. A sessão fica somente na memória e termina ao fechar a aba ou por inatividade.",
            "No celular, o aplicativo guarda as credenciais de acesso no armazenamento seguro do sistema e preferências como tema, biometria e notificações.",
            "As fontes e os arquivos destas páginas são servidos pelo próprio domínio da plataforma, sem chamadas a redes de terceiros.",
          ],
        },
      ],
    },
    {
      id: "incidentes",
      title: "Incidentes de segurança",
      blocks: [
        {
          type: "paragraph",
          text: "Se ocorrer um incidente de segurança que possa trazer risco ou dano relevante a você, o Centro comunicará a ANPD e os titulares afetados nos prazos da regulamentação, informando o que aconteceu, quais dados foram envolvidos, os riscos e as medidas adotadas para conter e reverter os efeitos.",
        },
      ],
    },
    {
      id: "alteracoes",
      title: "Alterações desta Política",
      blocks: [
        {
          type: "paragraph",
          text: "Esta Política pode ser atualizada para refletir mudanças na plataforma, na lei ou na forma como tratamos dados. Cada versão recebe um número e uma data de vigência. Se a mudança for relevante, avisaremos pelo aplicativo e pediremos um novo aceite antes que você continue a usá-lo. A versão anterior aceita por você permanece registrada.",
        },
      ],
    },
    {
      id: "contato",
      title: "Fale com a gente",
      blocks: [
        {
          type: "list",
          items: [
            [{ strong: "Controlador: " }, `${CONTROLLER.name} · CNPJ ${CONTROLLER.taxId}`],
            [{ strong: "Endereço: " }, CONTROLLER.address],
            [{ strong: "Telefone: " }, { href: CONTROLLER.phoneHref, label: CONTROLLER.phone }],
            [
              { strong: "Encarregado de Dados (DPO): " },
              DATA_PROTECTION_OFFICER.email
                ? { href: `mailto:${DATA_PROTECTION_OFFICER.email}`, label: DATA_PROTECTION_OFFICER.email }
                : `pelo telefone do Centro ou pelo aplicativo, em ${IN_APP_PRIVACY_PATH}`,
            ],
          ],
        },
        {
          type: "callout",
          tone: "danger",
          icon: ShieldAlert,
          title: "Em caso de emergência, não use estes canais",
          text: `Para qualquer sintoma grave, ligue ${EMERGENCY_NUMBER} (SAMU) ou procure o pronto-atendimento mais próximo.`,
        },
      ],
    },
  ],
};
