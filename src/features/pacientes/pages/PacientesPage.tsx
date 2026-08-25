import { ModuloEmConstrucao, PageHeader } from "@/components/shared";

/**
 * Pacientes
 *
 * Esqueleto criado na Fase 3 (AdminLayout). O conteúdo chega na Fase 5.
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/pacientes/
 */
export function PacientesPage() {
  return (
    <>
      <PageHeader
        titulo="Pacientes"
        subtitulo="81 pacientes cadastrados · convite por SMS no cadastro"
      />

      <ModuloEmConstrucao
        fase={5}
        prototipo="https://strawti.com.br/prototipos/jornada-supera/admin/pacientes/"
        entrega={[
          "Lista com busca por nome, CPF ou código e filtros por protocolo, CID, fase e risco",
          "Colunas do protótipo: Paciente, CID, Protocolo, Fase e Status",
          "Cadastro completo: diagnóstico, estadiamento, protocolo, alergias e reações",
          "Convite por SMS, edição da ficha e desativação com registro de auditoria",
          "Exportação da lista filtrada em CSV",
        ]}
      />
    </>
  );
}

export default PacientesPage;
