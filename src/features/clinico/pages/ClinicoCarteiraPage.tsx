import { Link, useParams, useSearchParams } from "react-router-dom";

import {
  BarChart,
  ChartCard,
  EmptyState,
  ErrorState,
  Footnote,
  PageHeader,
  SkeletonCards,
  StatCard,
  StatusBadge,
} from "@/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { ESPECIALIDADE_LABEL, FASE_TRATAMENTO_LABEL } from "@/lib/enums";
import { formatNumber, pluralize } from "@/lib/format";
import type { MotivoDeAtencao } from "@/types/clinico";
import { useCarteira } from "../hooks/useCarteira";

/**
 * Carteira do profissional — Mapa §4 (Médio).
 *
 * "Carteira" é o que a leitura sustenta: os pacientes com compromisso na agenda
 * DESTA pessoa, nos últimos dias escolhidos. O banco não guarda um vínculo
 * profissional ↔ paciente, e a tela não inventa um: a definição vem escrita no
 * cabeçalho.
 *
 * Quem "pede atenção" é sempre por um critério que a própria linha diz — alerta
 * aberto, ou falta no período. Não há escore nem ordem de prioridade calculada:
 * o painel não classifica paciente.
 *
 * Fora, com o motivo dito no rodapé: o tempo de resposta próprio, a média da
 * especialidade e o filtro por risco. Nenhum deles tem leitura que o sustente
 * sem ler conteúdo de mensagem ou dado de outros profissionais.
 */

const PERIODOS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 180 dias" },
];
const PERIODO_PADRAO = "90";

const MOTIVO_LABEL: Record<MotivoDeAtencao, string> = {
  alerta_ativo: "Alerta aberto",
  faltou: "Faltou no período",
};

export function ClinicoCarteiraPage() {
  const { user } = useAuth();
  const { especialidade } = useParams<{ especialidade: string }>();
  const [params, setParams] = useSearchParams();

  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  // O período vem do endereço, como nos relatórios: um link copiado abre a mesma
  // carteira, e o botão de voltar desfaz a troca.
  const pedido = params.get("dias");
  const periodo = PERIODOS.some((item) => item.value === pedido) ? (pedido as string) : PERIODO_PADRAO;
  const dias = Number(periodo);

  const carteira = useCarteira(dias);
  const dados = carteira.data;

  const trocarPeriodo = (valor: string) => {
    const query = new URLSearchParams(params);
    if (valor === PERIODO_PADRAO) query.delete("dias");
    else query.set("dias", valor);
    setParams(query);
  };

  const vazio = !carteira.isLoading && !carteira.isError && dados?.pacientes === 0;
  const base = `/clinico/${especialidade}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area}
        title="Carteira"
        level="Médio"
        subtitle={`Pacientes que você atendeu nos últimos ${dias} dias, pela sua agenda`}
        actions={
          <Select value={periodo} onValueChange={trocarPeriodo}>
            <SelectTrigger size="sm" aria-label="Período" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {carteira.isLoading && <SkeletonCards count={4} />}

      {carteira.isError && (
        <ErrorState error={carteira.error} onRetry={() => void carteira.refetch()} />
      )}

      {vazio && (
        <EmptyState
          title="Nenhum paciente atendido no período"
          description="A carteira sai da sua agenda. Quando houver compromissos seus nestes dias, os números aparecem aqui."
        />
      )}

      {dados && dados.pacientes > 0 && (
        <>
          <section aria-label="Resumo da carteira" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Pacientes na carteira"
              value={formatNumber(dados.pacientes)}
              context={`${formatNumber(dados.pacientes_ativos)} com a ficha ativa`}
            />
            <StatCard
              label="Compromissos"
              value={formatNumber(dados.compromissos.total)}
              context={`${pluralize(dados.compromissos.realizados, "realizado", "realizados")} · ${pluralize(dados.compromissos.faltas, "falta", "faltas")}`}
            />
            <StatCard
              label="Sem desfecho registrado"
              value={formatNumber(dados.compromissos.sem_desfecho)}
              context="já passaram e seguem como agendados"
              invertColor
            />
            <StatCard
              label="Alertas tratados"
              value={`${dados.alertas_tratados.limitado ? "≥ " : ""}${formatNumber(dados.alertas_tratados.total)}`}
              context={
                dados.alertas_tratados.limitado
                  ? "leitura limitada a 200, pode haver mais"
                  : "resolvidos por você no período"
              }
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Pacientes por fase" description="Fase do tratamento hoje, entre quem você atendeu">
              <BarChart
                data={dados.por_fase
                  .filter((item) => item.total > 0)
                  .map((item) => ({
                    fase: item.fase ? FASE_TRATAMENTO_LABEL[item.fase] : "Sem fase registrada",
                    pacientes: item.total,
                  }))}
                xKey="fase"
                series={[{ key: "pacientes", label: "Pacientes" }]}
                integerAxis
                height={220}
              />
            </ChartCard>

            <section className="bg-card rounded-2xl border p-5" aria-labelledby="titulo-atencao">
              <h2 id="titulo-atencao" className="text-foreground text-sm font-semibold">
                Pedem atenção
              </h2>
              <p className="text-muted-foreground mb-3 text-xs">
                Alerta aberto ou falta no período. Não é uma classificação de risco.
              </p>

              {dados.atencao.length === 0 ? (
                <EmptyState
                  compact
                  title="Ninguém da carteira pede atenção"
                  description="Nenhum paciente seu tem alerta aberto ou faltou no período."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {dados.atencao.map((paciente) => (
                    <li key={paciente.paciente_id}>
                      <Link
                        to={`${base}/pacientes/${paciente.paciente_id}`}
                        className="hover:bg-muted/50 flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors"
                      >
                        <span className="min-w-0 flex-1 truncate">{paciente.paciente_nome}</span>
                        {paciente.motivos.map((motivo) => (
                          <StatusBadge
                            key={motivo}
                            tone={motivo === "alerta_ativo" ? "danger" : "warning"}
                            size="sm"
                          >
                            {MOTIVO_LABEL[motivo]}
                          </StatusBadge>
                        ))}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {dados.lista_limitada && (
            <p className="text-muted-foreground text-[11px]" role="status">
              A lista de pacientes foi lida até o teto: parte da carteira pode aparecer em “Sem fase
              registrada”.
            </p>
          )}
        </>
      )}

      <Footnote>
        Ainda não aparecem aqui o tempo de resposta por profissional, a comparação com a média da
        especialidade e o filtro por risco. O resumo de resposta do banco é por equipe, e calculá-lo
        por pessoa exigiria ler o conteúdo das conversas; a média dos colegas pede um agregado
        anônimo do banco; e risco depende de uma definição com a clínica.
      </Footnote>
    </div>
  );
}

export default ClinicoCarteiraPage;
