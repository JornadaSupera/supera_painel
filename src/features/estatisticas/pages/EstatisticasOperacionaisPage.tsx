import { UnderConstruction, PageHeader, StatusBadge } from "@/components/shared";

/**
 * Estatísticas operacionais
 *
 * Esqueleto criado na Fase 3 (AdminLayout). O conteúdo chega na Fase 13.
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/estatisticas/operacionais/
 */
export function EstatisticasOperacionaisPage() {
  return (
    <>
      <PageHeader
        title="Estatísticas operacionais"
        subtitle="Operação da clínica"
        badge={
          <StatusBadge tone="primary" pill size="sm">
            MÉDIO
          </StatusBadge>
        }
      />

      <UnderConstruction
        phase={13}
        prototypeUrl="https://strawti.com.br/prototipos/jornada-supera/admin/estatisticas/operacionais/"
        deliverables={[
          "Indicadores: tempo de resposta no chat, taxa de falta, atendimentos e mensagens",
          "Volume mensal com linhas de meta e de capacidade máxima",
          "Comparativo por especialidade — não por profissional nominal",
          "Adesão à agenda e fila de alertas: volume, tempo até conduta e desfecho",
          "Destaque de gargalos operacionais",
        ]}
      />
    </>
  );
}

export default EstatisticasOperacionaisPage;
