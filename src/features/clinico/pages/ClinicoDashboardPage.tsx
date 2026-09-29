import { BackendPendente, EmptyState, ErrorState, PageHeader, SkeletonCards, StatusBadge } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { ESPECIALIDADE_LABEL } from "@/lib/enums";
import { formatTime } from "@/lib/format";
import { useAgendaClinica } from "../hooks/useAgendaClinica";

/**
 * Painel do dia — a tela de entrada do painel clínico.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/farmaceutico/
 *
 * "Pacientes de hoje" já é real — reaproveita `read_my_agenda`, recortado
 * para o dia corrente. "Mensagens não respondidas" e "fila de alertas"
 * continuam honestas sobre o que falta: pedem a leitura de Chat e Alertas,
 * que ainda não foram construídas — ver PA-07.
 */

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function hoje(): { de: string; ate: string } {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);
  return { de: inicio.toISOString(), ate: fim.toISOString() };
}

export function ClinicoDashboardPage() {
  const { user } = useAuth();
  const primeiroNome = user?.nome.split(" ")[0] ?? "";
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  const agendaDeHoje = useAgendaClinica(hoje());
  const compromissos = agendaDeHoje.data ?? [];
  const vazio = !agendaDeHoje.isLoading && !agendaDeHoje.isError && compromissos.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area}
        title={`${saudacao()}${primeiroNome ? `, ${primeiroNome}` : ""}`}
        subtitle="Painel do dia · pacientes agendados, mensagens e alertas da sua área"
      />

      <section className="bg-card rounded-2xl border p-5">
        <h2 className="text-foreground mb-3 text-sm font-semibold">Pacientes de hoje</h2>

        {agendaDeHoje.isLoading && <SkeletonCards count={2} />}

        {agendaDeHoje.isError && (
          <ErrorState compact error={agendaDeHoje.error} onRetry={() => void agendaDeHoje.refetch()} />
        )}

        {vazio && (
          <EmptyState
            compact
            title="Nenhum compromisso hoje"
            description="Quando houver um compromisso marcado para hoje, ele aparece aqui."
          />
        )}

        {compromissos.length > 0 && (
          <ul className="flex flex-col gap-2">
            {compromissos.map((compromisso) => (
              <li
                key={compromisso.id}
                className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm"
              >
                <span className="text-foreground w-12 shrink-0 font-medium tabular-nums">
                  {formatTime(compromisso.inicio)}
                </span>
                <span className="min-w-0 flex-1 truncate">{compromisso.paciente_nome}</span>
                <StatusBadge tone={compromisso.status_tom} size="sm">
                  {compromisso.status_label}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BackendPendente
        titulo="Mensagens não respondidas e fila de alertas"
        motivo="Essas duas seções pedem a leitura de Chat e de Alertas, que ainda não foram construídas neste painel. Ver PA-07."
        altura={140}
      />
    </div>
  );
}

export default ClinicoDashboardPage;
