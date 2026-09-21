import { MessageCircleWarning, Siren } from "lucide-react";

import type { LegalDocument } from "../types";
import { CONTROLLER, EMERGENCY_NUMBER, IN_APP_PRIVACY_PATH } from "./controller";

export const TERMS_OF_USE: LegalDocument = {
  slug: "termos",
  title: "Termos de Uso",
  documentTitle: "Termos de Uso · Jornada Supera",
  summary:
    "As regras para usar o aplicativo e os painéis do Jornada Supera: o que a plataforma oferece, o que ela não substitui e as responsabilidades de cada um.",
  version: "1.0",
  effectiveAt: "2026-09-21T12:00:00.000Z",


  sections: [
    {
      id: "aceite",
      title: "Aceite destes Termos",
      blocks: [
        {
          type: "paragraph",
          text: [
            "Estes Termos de Uso regulam o uso do Jornada Supera — o aplicativo para Android e iOS, o painel clínico e o painel administrativo — oferecido pelo ",
            { strong: CONTROLLER.name },
            `, inscrito no CNPJ sob o nº ${CONTROLLER.taxId}, com sede na ${CONTROLLER.address} (o “Centro”).`,
          ],
        },
        {
          type: "paragraph",
          text: [
            "Ao ativar a sua conta e marcar a opção de aceite, você declara que leu, entendeu e concorda com estes Termos e com a ",
            { href: "/privacidade", label: "Política de Privacidade" },
            ", que faz parte deles. Se não concordar, não use a plataforma — o seu atendimento presencial no Centro não depende do aplicativo.",
          ],
        },
      ],
    },
    {
      id: "definicoes",
      title: "Definições",
      blocks: [
        {
          type: "definitions",
          items: [
            {
              term: "Plataforma",
              text: "O conjunto formado pelo aplicativo do paciente e do cuidador, pelo painel clínico e pelo painel administrativo.",
            },
            {
              term: "Paciente",
              text: "Pessoa em acompanhamento no Centro, convidada por ele a usar o aplicativo.",
            },
            {
              term: "Cuidador acompanhante",
              text: "Pessoa convidada pelo paciente para acompanhar a jornada dele, com as permissões que o paciente definir.",
            },
            {
              term: "Profissional",
              text: "Integrante da equipe multidisciplinar ou da gestão do Centro com acesso aos painéis.",
            },
            {
              term: "Equipe",
              text: "Os profissionais do Centro responsáveis pelo seu acompanhamento.",
            },
            {
              term: "Horário de atendimento",
              text: "Dias e horários em que a equipe responde pelo chat, informados no próprio aplicativo.",
            },
          ],
        },
      ],
    },
    {
      id: "o-que-e",
      title: "O que é e o que não é o Jornada Supera",
      blocks: [
        {
          type: "paragraph",
          text: "O Jornada Supera é uma ferramenta de apoio ao acompanhamento oncológico. Pelo aplicativo, você registra sintomas no diário, conversa com a equipe, consulta a sua agenda, recebe orientações e notificações, e pode convidar um cuidador. Pelos painéis, a equipe acompanha os pacientes e o Centro faz a gestão do serviço.",
        },
        {
          type: "callout",
          tone: "danger",
          icon: Siren,
          title: "O Jornada Supera não é um serviço de urgência ou emergência",
          text: `Se você tiver febre alta, falta de ar, sangramento, dor intensa, desmaio, confusão mental ou qualquer sintoma grave ou que piore rapidamente, ligue ${EMERGENCY_NUMBER} (SAMU) ou procure imediatamente o pronto-atendimento mais próximo. Não aguarde resposta pelo aplicativo.`,
        },
        {
          type: "paragraph",
          text: "A plataforma também não:",
        },
        {
          type: "list",
          items: [
            "substitui consultas, exames, a avaliação presencial ou a orientação individual do seu médico e da equipe;",
            "faz diagnóstico, prescrição ou mudança de tratamento de forma automática;",
            "garante monitoramento contínuo, 24 horas por dia, dos registros que você fizer;",
            "é o sistema oficial de prontuário do Centro, que continua sendo a referência para as informações do seu atendimento.",
          ],
        },
        {
          type: "paragraph",
          text: "Nunca interrompa, altere ou inicie um medicamento ou tratamento apenas com base em informação vista no aplicativo sem falar antes com a sua equipe.",
        },
      ],
    },
    {
      id: "conta",
      title: "Cadastro, ativação e acesso",
      blocks: [
        {
          type: "list",
          items: [
            "O acesso ao aplicativo é feito a partir de convite do Centro, enviado por SMS ou e-mail. Só pode ativar a conta a pessoa a quem o convite se destina.",
            "Você se compromete a informar dados verdadeiros, completos e atualizados, e a avisar o Centro se algum deles mudar.",
            "Pacientes com menos de 18 anos usam a plataforma com o acompanhamento e a autorização do responsável legal, que responde pelo uso da conta.",
            "Você pode entrar com e-mail e senha, com a sua conta Google ou Apple, e usar biometria para abrir o aplicativo, se o seu celular permitir.",
            "Profissionais acessam os painéis com e-mail corporativo, senha e verificação em duas etapas, obrigatória para administradores.",
          ],
        },
      ],
    },
    {
      id: "seguranca-da-conta",
      title: "Segurança da sua conta",
      blocks: [
        {
          type: "list",
          items: [
            "A conta é pessoal e intransferível. Não compartilhe a sua senha, os códigos de verificação ou o acesso ao aparelho desbloqueado.",
            "Quem precisa acompanhar você deve ser convidado como cuidador, com o próprio acesso — nunca usar a sua conta.",
            "Mantenha o bloqueio de tela do celular ativo e o aplicativo e o sistema atualizados.",
            "Se perder o celular ou suspeitar de acesso indevido, troque a senha e avise o Centro imediatamente.",
            "Você responde pelo que for feito com a sua conta enquanto não comunicar ao Centro a perda ou o uso indevido das suas credenciais.",
          ],
        },
      ],
    },
    {
      id: "diario-e-alertas",
      title: "Diário de sintomas e alertas",
      blocks: [
        {
          type: "list",
          items: [
            "O diário serve para você registrar como se sente, com a intensidade de cada sintoma de 0 a 5 e um texto livre. Registre com sinceridade: é essa informação que ajuda a equipe a cuidar de você.",
            "Quando um sintoma ultrapassa os limites definidos pela equipe clínica, a plataforma gera um alerta para os profissionais. O alerta é um aviso de apoio, e não uma garantia de atendimento imediato.",
            "Alertas gerados fora do horário de atendimento podem ser vistos apenas no próximo período de atendimento da equipe.",
            "A ausência de alerta não significa que o seu quadro está bem. Se você se sentir mal, procure atendimento — não dependa do alerta.",
            "O resumo do diário e os alertas críticos podem ser enviados ao sistema de gestão clínica do Centro para integrar o seu prontuário.",
          ],
        },
      ],
    },
    {
      id: "chat",
      title: "Chat com a equipe",
      blocks: [
        {
          type: "callout",
          tone: "warning",
          icon: MessageCircleWarning,
          title: "Mensagem enviada não é mensagem lida",
          text: "O chat é respondido pela equipe no horário de atendimento, por ordem de chegada e conforme a disponibilidade dos profissionais. O tempo médio de resposta mostrado no aplicativo é uma referência, não um prazo garantido.",
        },
        {
          type: "list",
          items: [
            "Escolha o assunto da conversa para que ela chegue ao profissional mais indicado. A conversa pode ser encaminhada a outro profissional da equipe, e o histórico fica visível para quem assumir.",
            "Use o chat para dúvidas e informações sobre o seu acompanhamento. Não o use para urgências, reclamações administrativas complexas ou assuntos sem relação com o seu cuidado.",
            "Envie apenas imagens e arquivos necessários ao seu acompanhamento. Não envie fotos ou dados de outras pessoas sem autorização delas.",
            "Trate a equipe com respeito. Mensagens ofensivas, ameaçadoras ou discriminatórias podem levar à suspensão do chat, sem prejuízo do seu atendimento presencial.",
            "As mensagens trocadas fazem parte do registro do seu acompanhamento e são guardadas conforme a Política de Privacidade.",
          ],
        },
      ],
    },
    {
      id: "agenda",
      title: "Agenda e notificações",
      blocks: [
        {
          type: "list",
          items: [
            "A agenda mostra os seus compromissos cadastrados pelo Centro. Em caso de divergência, vale a confirmação feita diretamente pelo Centro.",
            "Lembretes e notificações dependem do seu celular, da conexão com a internet e de serviços de terceiros. Não deixe de acompanhar os seus compromissos por outros meios se uma notificação não chegar.",
            "As notificações não trazem detalhes clínicos no texto, para proteger a sua privacidade na tela bloqueada.",
            "Você pode ajustar as notificações no aplicativo. Algumas mensagens essenciais, como códigos de verificação e avisos de segurança, não podem ser desativadas.",
          ],
        },
      ],
    },
    {
      id: "orientacoes",
      title: "Orientações e conteúdo educativo",
      blocks: [
        {
          type: "paragraph",
          text: "Os textos, vídeos e materiais disponíveis no aplicativo são produzidos ou revisados pela equipe do Centro e têm caráter educativo e geral. Eles podem não se aplicar ao seu caso específico. Na dúvida, prevalece sempre a orientação individual do profissional que acompanha você.",
        },
        {
          type: "paragraph",
          text: "Links para sites ou vídeos de terceiros são indicados como apoio. O Centro não controla e não responde pelo conteúdo, pela disponibilidade ou pelas práticas de privacidade desses sites.",
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
            "Só o paciente convida o cuidador, define o que ele pode ver ou fazer e revoga o acesso, a qualquer momento.",
            "Ao convidar, o paciente declara que a pessoa convidada concorda em receber o convite e que tem a confiança dele para acessar as informações compartilhadas.",
            "O cuidador usa a plataforma dentro das permissões concedidas, em benefício do paciente, e se compromete a manter sigilo sobre tudo o que vir.",
            "O cuidador não pode aceitar termos, revogar consentimentos, pedir exportação ou exclusão de dados em nome do paciente.",
            "As ações do cuidador ficam registradas como dele. O uso indevido leva à revogação do acesso.",
          ],
        },
      ],
    },
    {
      id: "profissionais",
      title: "Regras para profissionais e administradores",
      blocks: [
        {
          type: "paragraph",
          text: "Além destes Termos, profissionais e administradores seguem o código de ética da sua profissão, as políticas internas do Centro e o dever de sigilo. Ao usar os painéis, você se compromete a:",
        },
        {
          type: "list",
          items: [
            "acessar dados de pacientes somente quando houver necessidade assistencial ou de gestão ligada à sua função;",
            "não compartilhar o seu login, a sua senha nem o seu fator de verificação com ninguém, inclusive colegas;",
            "não copiar, fotografar, exportar ou repassar dados de pacientes fora das funções previstas na plataforma;",
            "respeitar o sigilo por especialidade, em especial o das anotações de Psicologia;",
            "registrar condutas e respostas de forma fiel e oportuna, assumindo apenas os alertas que puder tratar;",
            "encerrar a sessão ao deixar a estação de trabalho e comunicar imediatamente qualquer suspeita de incidente.",
          ],
        },
        {
          type: "paragraph",
          text: "Todo acesso e toda ação nos painéis ficam registrados na trilha de auditoria. O descumprimento dessas regras pode levar à suspensão do acesso e às medidas disciplinares, éticas e legais cabíveis.",
        },
      ],
    },
    {
      id: "condutas-proibidas",
      title: "O que não é permitido",
      blocks: [
        {
          type: "paragraph",
          text: "É proibido, a qualquer usuário:",
        },
        {
          type: "list",
          items: [
            "usar a conta de outra pessoa ou se passar por outra pessoa;",
            "enviar conteúdo ilegal, ofensivo, discriminatório, que viole a privacidade de terceiros ou que contenha vírus e códigos maliciosos;",
            "tentar acessar dados, áreas ou funções para as quais não tem permissão;",
            "testar, contornar ou desativar mecanismos de segurança, ou sobrecarregar a plataforma de propósito;",
            "copiar, modificar, fazer engenharia reversa ou extrair dados da plataforma de forma automatizada;",
            "usar a plataforma para publicidade, venda de produtos ou qualquer finalidade estranha ao cuidado em saúde.",
          ],
        },
      ],
    },
    {
      id: "propriedade-intelectual",
      title: "Propriedade intelectual",
      blocks: [
        {
          type: "paragraph",
          text: "A marca Jornada Supera, a identidade visual, o software, os textos e os conteúdos da plataforma são protegidos por lei. O uso da plataforma não transfere a você nenhum direito sobre eles, além da licença pessoal, gratuita, limitada e revogável para usá-la conforme estes Termos.",
        },
        {
          type: "paragraph",
          text: "O que você escreve e envia continua sendo seu. Você autoriza o Centro a usar esse conteúdo exclusivamente para o seu acompanhamento e para as demais finalidades descritas na Política de Privacidade.",
        },
      ],
    },
    {
      id: "disponibilidade",
      title: "Disponibilidade e atualizações",
      blocks: [
        {
          type: "list",
          items: [
            "O Centro se esforça para manter a plataforma disponível, mas ela pode ficar fora do ar por manutenção, atualização, falha de conexão ou de serviços de terceiros. Não há garantia de funcionamento ininterrupto.",
            "Funções podem ser alteradas, incluídas ou retiradas para melhorar o serviço ou cumprir a lei.",
            "Algumas atualizações do aplicativo podem ser obrigatórias para continuar o uso com segurança.",
            "Se a plataforma estiver indisponível, entre em contato com o Centro por telefone e, em caso de urgência, procure atendimento presencial.",
          ],
        },
      ],
    },
    {
      id: "terceiros",
      title: "Serviços de terceiros",
      blocks: [
        {
          type: "paragraph",
          text: "A plataforma usa serviços de terceiros, como as lojas de aplicativos da Apple e do Google, o login com Google ou Apple, serviços de notificação, SMS, e-mail e hospedagem. O uso desses serviços também está sujeito aos termos de cada fornecedor. O Centro não responde por falhas, mudanças ou indisponibilidade desses serviços, sem prejuízo de adotar as medidas ao seu alcance para restabelecer o funcionamento.",
        },
      ],
    },
    {
      id: "responsabilidades",
      title: "Responsabilidades",
      blocks: [
        {
          type: "paragraph",
          text: "O Centro responde pelos serviços de saúde prestados pela sua equipe e pelo tratamento dos seus dados, nos termos da lei. Na máxima extensão permitida pela legislação, e sem afastar os direitos garantidos pelo Código de Defesa do Consumidor, o Centro não responde por danos decorrentes de:",
        },
        {
          type: "list",
          items: [
            "uso da plataforma como substituto de atendimento de urgência ou emergência, contrariando estes Termos;",
            "informações falsas, incompletas ou desatualizadas fornecidas pelo usuário;",
            "compartilhamento da conta, da senha, dos códigos ou do aparelho desbloqueado pelo próprio usuário;",
            "decisões sobre medicamentos ou tratamento tomadas sem orientação da equipe;",
            "falha do celular, da conexão de internet ou de serviços de terceiros fora do controle do Centro;",
            "ações do cuidador realizadas dentro das permissões concedidas pelo paciente;",
            "caso fortuito ou força maior.",
          ],
        },
      ],
    },
    {
      id: "suspensao",
      title: "Suspensão e encerramento",
      blocks: [
        {
          type: "list",
          items: [
            `Você pode deixar de usar a plataforma a qualquer momento e pedir a exclusão da conta em ${IN_APP_PRIVACY_PATH}.`,
            "O Centro pode suspender ou encerrar o acesso em caso de violação destes Termos, suspeita de fraude ou de uso indevido, fim do acompanhamento no Centro ou exigência legal, avisando o usuário sempre que possível.",
            "O encerramento da conta não apaga as informações que o Centro é obrigado por lei a guardar, como as que integram o prontuário, conforme a Política de Privacidade.",
            "O encerramento do acesso ao aplicativo não interrompe o seu tratamento no Centro.",
          ],
        },
      ],
    },
    {
      id: "pesquisa",
      title: "Pesquisa de satisfação",
      blocks: [
        {
          type: "paragraph",
          text: "O Centro pode convidar você a avaliar o atendimento com uma nota de 0 a 10 e um comentário. Responder é opcional e não interfere no seu tratamento. Evite incluir no comentário informações de saúde que não sejam necessárias para a avaliação.",
        },
      ],
    },
    {
      id: "comunicacoes",
      title: "Comunicações",
      blocks: [
        {
          type: "paragraph",
          text: "O Centro se comunica com você pelo aplicativo, por notificações, SMS e e-mail, para assuntos ligados ao seu acompanhamento e à sua conta. Não enviamos publicidade de terceiros. Fique atento a golpes: o Centro nunca pede a sua senha ou códigos de verificação por telefone, mensagem ou e-mail.",
        },
      ],
    },
    {
      id: "alteracoes",
      title: "Alterações destes Termos",
      blocks: [
        {
          type: "paragraph",
          text: "Estes Termos podem ser atualizados. Cada versão recebe um número e uma data de vigência. Mudanças relevantes serão avisadas pelo aplicativo e exigirão novo aceite antes de você continuar a usá-lo. A versão que você aceitou fica registrada.",
        },
      ],
    },
    {
      id: "disposicoes-gerais",
      title: "Disposições gerais",
      blocks: [
        {
          type: "list",
          items: [
            "Se alguma cláusula destes Termos for considerada inválida, as demais continuam valendo.",
            "A tolerância com o descumprimento de qualquer regra não significa renúncia ao direito de exigi-la depois.",
            "Estes Termos, junto com a Política de Privacidade, formam o acordo completo sobre o uso da plataforma.",
          ],
        },
      ],
    },
    {
      id: "lei-e-foro",
      title: "Lei aplicável e foro",
      blocks: [
        {
          type: "paragraph",
          text: `Estes Termos são regidos pelas leis brasileiras. Para pacientes e cuidadores, fica eleito o foro do seu domicílio, conforme o Código de Defesa do Consumidor. Para os demais casos, fica eleito o foro da comarca de ${CONTROLLER.city}.`,
        },
      ],
    },
    {
      id: "contato",
      title: "Contato",
      blocks: [
        {
          type: "list",
          items: [
            [{ strong: "Centro: " }, `${CONTROLLER.name} · CNPJ ${CONTROLLER.taxId}`],
            [{ strong: "Endereço: " }, CONTROLLER.address],
            [{ strong: "Telefone: " }, { href: CONTROLLER.phoneHref, label: CONTROLLER.phone }],
            [
              { strong: "Privacidade: " },
              "dúvidas sobre dados pessoais seguem o canal descrito na ",
              { href: "/privacidade", label: "Política de Privacidade" },
              ".",
            ],
          ],
        },
      ],
    },
  ],
};
