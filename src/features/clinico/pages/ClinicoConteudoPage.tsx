import { BackendPendente, PageHeader } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { ESPECIALIDADE_LABEL } from "@/lib/enums";

/**
 * Autoria de orientações — editor, upload de imagem/PDF, embed de vídeo,
 * marcação por CID e especialidade.
 *
 * Fundação — Fase 1 do painel clínico. Ver ClinicoDashboardPage.
 *
 * > [!] É a metade "painel clínico" do PA-06
 * Redigir uma orientação é ato do profissional, no espaço dele — o painel
 * administrativo só revisa e aprova (`ConteudoPage.tsx`, já pronto). O editor
 * em si ainda não foi construído aqui; falta compor a tela real (o protótipo
 * lista "Conteúdo" no menu, mas ainda não foi aberto — ver PA-07) e a
 * política de RLS de `content_items`, que já exige o autor-profissional como
 * quem grava.
 */
export function ClinicoConteudoPage() {
  const { user } = useAuth();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area}
        title="Conteúdo"
        subtitle="Minhas orientações · editor, marcação por CID e especialidade"
      />

      <BackendPendente
        titulo="Editor de orientações"
        motivo="A redação de orientações (editor, upload de imagem/PDF, embed de vídeo, marcação por CID/especialidade) ainda não existe no backend. A revisão já existe do lado administrativo; o editor em si entra numa próxima fase."
        altura={280}
      />
    </div>
  );
}

export default ClinicoConteudoPage;
