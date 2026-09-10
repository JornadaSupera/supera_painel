import { cn } from "@/lib/utils";
import type { CruzamentoClinico } from "@/types/estatisticas";

/**
 * Mapa de calor Protocolo × Efeito.
 *
 * Quatro faixas de intensidade, como no protótipo. A cor NUNCA é o único
 * portador do significado: cada célula mostra o percentual escrito e traz um
 * `title` com o numerador e o denominador — quem não distingue as faixas de
 * verde lê o número, e quem desconfia do número vê de quantos pacientes ele
 * saiu.
 *
 * A tabela é semântica de verdade (`th` com `scope`), porque um mapa de calor
 * montado com `div` é ilegível por leitor de tela: sem cabeçalho de linha e de
 * coluna, "47%" não diz de qual protocolo nem de qual efeito.
 */

export interface MapaDeCalorProps {
  dados: CruzamentoClinico;
}

/** As quatro faixas do protótipo: 0-24, 25-39, 40-59, 60+. */
const FAIXAS = [
  { ate: 24, classe: "bg-chart-2/15 text-foreground", label: "0-24%" },
  { ate: 39, classe: "bg-chart-2/35 text-foreground", label: "25-39%" },
  { ate: 59, classe: "bg-chart-1/45 text-foreground", label: "40-59%" },
  { ate: 100, classe: "bg-chart-1/75 text-foreground", label: "60%+" },
] as const;

const FAIXA_MAXIMA = FAIXAS[FAIXAS.length - 1] as (typeof FAIXAS)[number];

function faixaDe(percentual: number) {
  return FAIXAS.find((faixa) => percentual <= faixa.ate) ?? FAIXA_MAXIMA;
}

export function MapaDeCalor({ dados }: MapaDeCalorProps) {
  const porChave = new Map(
    dados.celulas.map((celula) => [`${celula.protocolo} ${celula.sintoma_id}`, celula]),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-xs">
          <caption className="sr-only">
            Percentual de pacientes com o sintoma em grau {dados.grau_minimo} ou maior, por
            protocolo.
          </caption>

          <thead>
            <tr>
              <th scope="col" className="text-muted-foreground px-2 py-1 text-left font-medium">
                Protocolo
              </th>
              {dados.sintomas.map((sintoma) => (
                <th
                  key={sintoma.id}
                  scope="col"
                  className="text-muted-foreground px-2 py-1 text-center font-medium"
                >
                  {sintoma.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {dados.protocolos.map((protocolo) => (
              <tr key={protocolo}>
                <th
                  scope="row"
                  className="text-foreground max-w-40 truncate px-2 py-1 text-left text-xs font-medium"
                >
                  {protocolo}
                </th>

                {dados.sintomas.map((sintoma) => {
                  const celula = porChave.get(`${protocolo} ${sintoma.id}`);
                  const percentual = celula?.percentual ?? null;

                  if (percentual === null) {
                    return (
                      <td
                        key={sintoma.id}
                        className="text-muted-foreground bg-muted/40 rounded-md px-2 py-2 text-center"
                        title="Nenhum paciente neste protocolo no recorte atual."
                      >
                        —
                      </td>
                    );
                  }

                  return (
                    <td
                      key={sintoma.id}
                      className={cn(
                        "rounded-md px-2 py-2 text-center font-medium tabular-nums",
                        faixaDe(percentual).classe,
                      )}
                      title={`${celula?.pacientes_com ?? 0} de ${celula?.pacientes_total ?? 0} pacientes em ${protocolo} relataram ${sintoma.label} em grau ${dados.grau_minimo} ou maior.`}
                    >
                      {percentual}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-[11px]">
        <span>Intensidade:</span>
        {FAIXAS.map((faixa) => (
          <span key={faixa.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-3 rounded-sm", faixa.classe)} />
            {faixa.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default MapaDeCalor;
