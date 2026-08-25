import { UnderConstruction, PageHeader } from "@/components/shared";

/**
 * Aprovação de conteúdo
 *
 * Esqueleto criado na Fase 3 (AdminLayout). O conteúdo chega na Fase 7.
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/conteudo/
 */
export function ConteudoPage() {
  return (
    <>
      <PageHeader
        title="Aprovação de conteúdo"
        subtitle="Workflow editorial · orientações esperam aprovação antes de chegar aos pacientes"
      />

      <UnderConstruction
        phase={7}
        prototypeUrl="https://strawti.com.br/prototipos/jornada-supera/admin/conteudo/"
        deliverables={[
          "Fila \"Aguardando revisão\" com autor, especialidade, versão e horário",
          "Ações por item: Aprovar, Revisar texto e Rejeitar, com comentário do revisor",
          "Tabela \"Publicados\" com título, categoria e visualizações",
          "Editor com formatação rica, upload de imagem e PDF e embed de vídeo",
          "Marcação por CID e especialidade, versionamento e despublicação",
        ]}
      />
    </>
  );
}

export default ConteudoPage;
