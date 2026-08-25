import { ModuloEmConstrucao, PageHeader } from "@/components/shared";

/**
 * Relatórios
 *
 * Esqueleto criado na Fase 3 (AdminLayout). O conteúdo chega na Fase 8.
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/relatorios/
 */
export function RelatoriosPage() {
  return (
    <>
      <PageHeader
        titulo="Relatórios"
        subtitulo="12 relatórios pré-definidos · período padrão: últimos 30 dias"
      />

      <ModuloEmConstrucao
        fase={8}
        prototipo="https://strawti.com.br/prototipos/jornada-supera/admin/relatorios/"
        entrega={[
          "Quatro categorias: Pacientes, Clínico, Operacional e Qualidade & experiência",
          "Motor genérico com 12 definições declarativas — nunca 12 páginas copiadas",
          "Filtros por relatório e alternância entre tabela e gráfico",
          "Exportação em PDF, Excel e CSV, com registro de auditoria",
          "Agendamento de envio por e-mail e compartilhamento por link interno",
        ]}
      />
    </>
  );
}

export default RelatoriosPage;
