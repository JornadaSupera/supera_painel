import { BackendPendente, PageHeader } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { ESPECIALIDADE_LABEL } from "@/lib/enums";

/**
 * Chat com pacientes, organizado por assunto e por atribuição.
 *
 * Fundação — Fase 1 do painel clínico. Ver ClinicoDashboardPage.
 */
export function ClinicoChatPage() {
  const { user } = useAuth();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={area} title="Chat" subtitle="Conversas por assunto · encaminhamento entre profissionais" />

      <BackendPendente
        titulo="Conversas"
        motivo="Lista de conversas atribuídas a este profissional, com encaminhamento para outra especialidade quando o assunto foge da área — pede leitura de mensagens recortada por profissional, ainda não construída. Ver PA-07."
        altura={280}
      />
    </div>
  );
}

export default ClinicoChatPage;
