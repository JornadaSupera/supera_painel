import { Link, useParams } from "react-router-dom";

import { EmptyState, ErrorState, PageHeader, SkeletonCards, StatusBadge } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { formatLongDate, formatTime } from "@/lib/format";
import { ESPECIALIDADE_LABEL } from "@/lib/enums";
import { PERMISSAO } from "@/lib/rbac";
import type { CompromissoAgenda } from "@/types/clinico";
import { useAgendaClinica } from "../hooks/useAgendaClinica";

/**
 * Agenda pessoal do profissional — a semana corrente. Cada compromisso abre a
 * ficha do paciente, dentro do painel clínico.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/farmaceutico/agenda/
 *
 * > [!] Primeira tela do painel clínico com dado real (fora do Fase 1)
 * `read_my_agenda` já recorta pelo profissional da sessão no banco — nada
 * aqui pede nem poderia pedir a agenda de outra pessoa. Nome do paciente,
 * tipo e status do compromisso são hidratados à parte: a função devolve a
 * linha crua de `appointments`. Ver `services/adapters/supabase/clinico.ts`.
 */

/** Segunda 00:00 até a segunda seguinte 00:00, no fuso local do navegador. */
function semanaCorrente(): { de: string; ate: string } {
  const hoje = new Date();
  const diaDaSemana = hoje.getDay(); // 0 = domingo
  const deslocamentoParaSegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana;

  const segunda = new Date(hoje);
  segunda.setHours(0, 0, 0, 0);
  segunda.setDate(segunda.getDate() + deslocamentoParaSegunda);

  const proximaSegunda = new Date(segunda);
  proximaSegunda.setDate(proximaSegunda.getDate() + 7);

  return { de: segunda.toISOString(), ate: proximaSegunda.toISOString() };
}

function agruparPorDia(compromissos: CompromissoAgenda[]): [string, CompromissoAgenda[]][] {
  const porDia = new Map<string, CompromissoAgenda[]>();

  for (const compromisso of compromissos) {
    const chave = compromisso.inicio.slice(0, 10);
    const lista = porDia.get(chave) ?? [];
    lista.push(compromisso);
    porDia.set(chave, lista);
  }

  return [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function ClinicoAgendaPage() {
  const { user, can } = useAuth();
  const { especialidade } = useParams<{ especialidade: string }>();
  const podeAbrirFicha = can(PERMISSAO.PACIENTES_READ);
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  const janela = semanaCorrente();
  const agenda = useAgendaClinica(janela);

  const dias = agruparPorDia(agenda.data ?? []);
  const vazio = !agenda.isLoading && !agenda.isError && dias.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={area} title="Agenda" subtitle="Seus compromissos desta semana" />

      {agenda.isLoading && <SkeletonCards count={3} />}

      {agenda.isError && <ErrorState error={agenda.error} onRetry={() => void agenda.refetch()} />}

      {vazio && (
        <EmptyState
          title="Nenhum compromisso nesta semana"
          description="Quando houver um compromisso marcado para você, ele aparece aqui, agrupado por dia."
        />
      )}

      {dias.map(([dia, compromissos]) => (
        <section key={dia} className="flex flex-col gap-3">
          <h2 className="text-foreground text-sm font-semibold capitalize">{formatLongDate(dia)}</h2>

          <div className="flex flex-col gap-2">
            {compromissos.map((compromisso) => {
              const conteudo = (
                <>
                  <div className="flex w-16 shrink-0 flex-col text-xs tabular-nums">
                    <span className="text-foreground font-medium">{formatTime(compromisso.inicio)}</span>
                    <span className="text-muted-foreground">{formatTime(compromisso.fim)}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">{compromisso.paciente_nome}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {compromisso.tipo_label}
                      {compromisso.local ? ` · ${compromisso.local}` : ""}
                    </p>
                  </div>

                  <StatusBadge tone={compromisso.status_tom} size="sm">
                    {compromisso.status_label}
                  </StatusBadge>
                </>
              );

              // A ficha exige leitura de paciente (mesma regra da rota): sem ela,
              // um link só levaria a "sem permissão".
              return podeAbrirFicha ? (
                <Link
                  key={compromisso.id}
                  to={`/clinico/${especialidade}/pacientes/${compromisso.paciente_id}`}
                  className="bg-card hover:bg-muted/50 focus-visible:ring-ring flex items-center gap-4 rounded-2xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {conteudo}
                </Link>
              ) : (
                <div
                  key={compromisso.id}
                  className="bg-card flex items-center gap-4 rounded-2xl border p-4"
                >
                  {conteudo}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default ClinicoAgendaPage;
