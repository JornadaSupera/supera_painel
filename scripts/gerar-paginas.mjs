/**
 * Gerador dos esqueletos de módulo da Fase 3.
 *
 * Utilitário de uso único: as nove telas nascem com a mesma estrutura, e
 * escrevê-las à mão introduziria divergências (um cabeçalho diferente, um
 * título fora do protótipo). Cada arquivo gerado é substituído pela tela real
 * na sua fase.
 *
 *   node scripts/gerar-paginas.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const RAIZ = resolve(import.meta.dirname, "..");
const BASE_PROTOTIPO = "https://strawti.com.br/prototipos/jornada-supera/admin";

const PAGINAS = [
  {
    arquivo: "src/features/dashboard/pages/DashboardPage.tsx",
    componente: "DashboardPage",
    titulo: "Dashboard executivo",
    subtitulo: "Visão geral da operação · atualização em tempo real",
    prototipo: `${BASE_PROTOTIPO}/`,
    fase: 4,
    nivelMedio: false,
    entrega: [
      "KPIs: pacientes ativos, novos no mês, sessões de quimioterapia e engajamento",
      "Quatro gráficos do protótipo, com a paleta de séries do tema",
      "Alternador de período: diário, semanal e mensal",
      "Drill-down de cada indicador para o relatório correspondente",
      "Exportação de captura do dashboard (jsPDF + html2canvas)",
    ],
  },
  {
    arquivo: "src/features/pacientes/pages/PacientesPage.tsx",
    componente: "PacientesPage",
    titulo: "Pacientes",
    subtitulo: "81 pacientes cadastrados · convite por SMS no cadastro",
    prototipo: `${BASE_PROTOTIPO}/pacientes/`,
    fase: 5,
    nivelMedio: false,
    entrega: [
      "Lista com busca por nome, CPF ou código e filtros por protocolo, CID, fase e risco",
      "Colunas do protótipo: Paciente, CID, Protocolo, Fase e Status",
      "Cadastro completo: diagnóstico, estadiamento, protocolo, alergias e reações",
      "Convite por SMS, edição da ficha e desativação com registro de auditoria",
      "Exportação da lista filtrada em CSV",
    ],
  },
  {
    arquivo: "src/features/usuarios/pages/UsuariosPage.tsx",
    componente: "UsuariosPage",
    titulo: "Usuários",
    subtitulo: "16 profissionais cadastrados · 7 especialidades",
    prototipo: `${BASE_PROTOTIPO}/usuarios/`,
    fase: 6,
    nivelMedio: false,
    entrega: [
      "Lista com iniciais, profissional, especialidade, registro, horário de chat e status",
      "Distribuição por especialidade no cabeçalho",
      "Cadastro com papel, permissões e horário de atendimento",
      "Matriz de permissões papel × permissão",
      "Histórico de acessos, ativar/desativar, reset de senha e gestão do segundo fator",
    ],
  },
  {
    arquivo: "src/features/conteudo/pages/ConteudoPage.tsx",
    componente: "ConteudoPage",
    titulo: "Aprovação de conteúdo",
    subtitulo: "Workflow editorial · orientações esperam aprovação antes de chegar aos pacientes",
    prototipo: `${BASE_PROTOTIPO}/conteudo/`,
    fase: 7,
    nivelMedio: false,
    entrega: [
      'Fila "Aguardando revisão" com autor, especialidade, versão e horário',
      "Ações por item: Aprovar, Revisar texto e Rejeitar, com comentário do revisor",
      'Tabela "Publicados" com título, categoria e visualizações',
      "Editor com formatação rica, upload de imagem e PDF e embed de vídeo",
      "Marcação por CID e especialidade, versionamento e despublicação",
    ],
  },
  {
    arquivo: "src/features/relatorios/pages/RelatoriosPage.tsx",
    componente: "RelatoriosPage",
    titulo: "Relatórios",
    subtitulo: "12 relatórios pré-definidos · período padrão: últimos 30 dias",
    prototipo: `${BASE_PROTOTIPO}/relatorios/`,
    fase: 8,
    nivelMedio: false,
    entrega: [
      "Quatro categorias: Pacientes, Clínico, Operacional e Qualidade & experiência",
      "Motor genérico com 12 definições declarativas — nunca 12 páginas copiadas",
      "Filtros por relatório e alternância entre tabela e gráfico",
      "Exportação em PDF, Excel e CSV, com registro de auditoria",
      "Agendamento de envio por e-mail e compartilhamento por link interno",
    ],
  },
  {
    arquivo: "src/features/estatisticas/pages/EstatisticasClinicasPage.tsx",
    componente: "EstatisticasClinicasPage",
    titulo: "Estatísticas clínicas",
    subtitulo: "Cruzamento Protocolo × Efeito × Grau",
    prototipo: `${BASE_PROTOTIPO}/estatisticas/clinicas/`,
    fase: 12,
    nivelMedio: true,
    entrega: [
      "Mapa de calor de prevalência por protocolo e efeito adverso",
      "Filtros: período, grau mínimo, CID, especialidade e apenas pacientes ativos",
      "Comparação entre protocolos e alertas de atenção clínica",
      "Exportação para apresentações, congressos e auditorias",
    ],
  },
  {
    arquivo: "src/features/estatisticas/pages/EstatisticasOperacionaisPage.tsx",
    componente: "EstatisticasOperacionaisPage",
    titulo: "Estatísticas operacionais",
    subtitulo: "Operação da clínica",
    prototipo: `${BASE_PROTOTIPO}/estatisticas/operacionais/`,
    fase: 13,
    nivelMedio: true,
    entrega: [
      "Indicadores: tempo de resposta no chat, taxa de falta, atendimentos e mensagens",
      "Volume mensal com linhas de meta e de capacidade máxima",
      "Comparativo por especialidade — não por profissional nominal",
      "Adesão à agenda e fila de alertas: volume, tempo até conduta e desfecho",
      "Destaque de gargalos operacionais",
    ],
  },
  {
    arquivo: "src/features/auditoria/pages/AuditoriaPage.tsx",
    componente: "AuditoriaPage",
    titulo: "Auditoria & logs",
    subtitulo: "Rastro de acesso a dados sensíveis · retenção de 5 anos · registros imutáveis",
    prototipo: `${BASE_PROTOTIPO}/auditoria/`,
    fase: 10,
    nivelMedio: true,
    entrega: [
      "Contadores de 24 h: leitura, edição, exclusão, sigiloso e exportação",
      "Tabela com usuário, ação, dado acessado, horário e IP",
      "Filtros por usuário, paciente, período e tipo de ação",
      "Identificação das ações do cuidador e da integração Gemed",
      "Exportação em CSV e JSON para o relatório do DPO",
    ],
  },
  {
    arquivo: "src/features/configuracoes/pages/ConfiguracoesPage.tsx",
    componente: "ConfiguracoesPage",
    titulo: "Configurações",
    subtitulo: "Identidade visual, mensagens, alertas, atendimento e termos",
    prototipo: `${BASE_PROTOTIPO}/configuracoes/`,
    fase: 9,
    nivelMedio: false,
    entrega: [
      "Identidade visual: logo 512×512 e cor primária, com pré-visualização",
      "Sete gatilhos de alerta: febre, vômito, dor, sangramento, confusão, diarreia e fadiga",
      "Horário de atendimento do chat e resposta automática fora do horário",
      "Textos de onboarding e mensagens automáticas",
      "Termos de uso e política de privacidade, com versionamento",
    ],
  },
];

const gabarito = ({ componente, titulo, subtitulo, prototipo, fase, nivelMedio, entrega }) => `import { ModuloEmConstrucao, PageHeader${nivelMedio ? ", StatusBadge" : ""} } from "@/components/shared";

/**
 * ${titulo}
 *
 * Esqueleto criado na Fase 3 (AdminLayout). O conteúdo chega na Fase ${fase}.
 * Protótipo: ${prototipo}
 */
export function ${componente}() {
  return (
    <>
      <PageHeader
        titulo="${titulo}"
        subtitulo="${subtitulo}"${
          nivelMedio
            ? `
        badge={
          <StatusBadge tone="primary" pill size="sm">
            MÉDIO
          </StatusBadge>
        }`
            : ""
        }
      />

      <ModuloEmConstrucao
        fase={${fase}}
        prototipo="${prototipo}"
        entrega={[
${entrega.map((item) => `          ${JSON.stringify(item)},`).join("\n")}
        ]}
      />
    </>
  );
}

export default ${componente};
`;

for (const pagina of PAGINAS) {
  const destino = resolve(RAIZ, pagina.arquivo);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, gabarito(pagina), "utf8");
  console.log(`✓ ${pagina.arquivo}`);
}

console.log(`\n${PAGINAS.length} páginas geradas.`);
