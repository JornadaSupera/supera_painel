import { BackendPendente, PageHeader } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { ESPECIALIDADE_LABEL } from "@/lib/enums";

/**
 * Fila de alertas de sintomas graves, priorizada por gravidade.
 *
 * Fundação — Fase 1 do painel clínico. Ver ClinicoDashboardPage.
 *
 * > [!] A concessão de `alerts.triage` já existe no painel administrativo
 * `Usuários` já grava essa permissão por profissional — falta cadastrar ao
 * menos um gatilho de criticidade em Configurações para a fila sair do
 * silêncio (mesma causa raiz do relatório #09, ver PA-04). O badge "IA" que o
 * protótipo mostra ao lado da severidade é pergunta em aberto: decoração ou
 * classificação real — ver PA-04 e PA-07.
 */
export function ClinicoAlertasPage() {
  const { user } = useAuth();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={area} title="Alertas" subtitle="Fila priorizada por gravidade · assumir e resolver" />

      <BackendPendente
        titulo="Fila de alertas"
        motivo="A concessão de alerts.triage por profissional já existe no painel administrativo. Falta: um gatilho de criticidade cadastrado em Configurações (sem isso a fila fica sempre vazia) e a leitura da fila recortada para este profissional. Ver PA-04."
        altura={280}
      />
    </div>
  );
}

export default ClinicoAlertasPage;
