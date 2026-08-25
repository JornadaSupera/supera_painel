import { ModuloEmConstrucao, PageHeader, StatusBadge } from "@/components/shared";

/**
 * Auditoria & logs
 *
 * Esqueleto criado na Fase 3 (AdminLayout). O conteúdo chega na Fase 10.
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/auditoria/
 */
export function AuditoriaPage() {
  return (
    <>
      <PageHeader
        titulo="Auditoria & logs"
        subtitulo="Rastro de acesso a dados sensíveis · retenção de 5 anos · registros imutáveis"
        badge={
          <StatusBadge tone="primary" pill size="sm">
            MÉDIO
          </StatusBadge>
        }
      />

      <ModuloEmConstrucao
        fase={10}
        prototipo="https://strawti.com.br/prototipos/jornada-supera/admin/auditoria/"
        entrega={[
          "Contadores de 24 h: leitura, edição, exclusão, sigiloso e exportação",
          "Tabela com usuário, ação, dado acessado, horário e IP",
          "Filtros por usuário, paciente, período e tipo de ação",
          "Identificação das ações do cuidador e da integração Gemed",
          "Exportação em CSV e JSON para o relatório do DPO",
        ]}
      />
    </>
  );
}

export default AuditoriaPage;
