import { ModuloEmConstrucao, PageHeader, StatusBadge } from "@/components/shared";

/**
 * Estatísticas clínicas
 *
 * Esqueleto criado na Fase 3 (AdminLayout). O conteúdo chega na Fase 12.
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/estatisticas/clinicas/
 */
export function EstatisticasClinicasPage() {
  return (
    <>
      <PageHeader
        titulo="Estatísticas clínicas"
        subtitulo="Cruzamento Protocolo × Efeito × Grau"
        badge={
          <StatusBadge tone="primary" pill size="sm">
            MÉDIO
          </StatusBadge>
        }
      />

      <ModuloEmConstrucao
        fase={12}
        prototipo="https://strawti.com.br/prototipos/jornada-supera/admin/estatisticas/clinicas/"
        entrega={[
          "Mapa de calor de prevalência por protocolo e efeito adverso",
          "Filtros: período, grau mínimo, CID, especialidade e apenas pacientes ativos",
          "Comparação entre protocolos e alertas de atenção clínica",
          "Exportação para apresentações, congressos e auditorias",
        ]}
      />
    </>
  );
}

export default EstatisticasClinicasPage;
