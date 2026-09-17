import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CelulaCruzamento, CruzamentoClinico } from "@/types/estatisticas";

/**
 * Mapa de calor Protocolo × Efeito.
 *
 * Quatro faixas de intensidade, como no protótipo. A cor NUNCA é o único
 * portador do significado: cada célula mostra o número escrito e traz um `title`
 * com o que o número mede — quem não distingue as faixas de verde lê o valor, e
 * quem desconfia do valor vê de onde ele saiu.
 *
 * A tabela é semântica de verdade (`th` com `scope`), porque um mapa de calor
 * montado com `div` é ilegível por leitor de tela: sem cabeçalho de linha e de
 * coluna, "47%" não diz de qual protocolo nem de qual efeito.
 *
 * > [!] O mapa tem DUAS medidas, e ela não é escolha de estilo
 * Com denominador, a célula é **prevalência** — quantos por cento dos pacientes
 * do protocolo relataram o efeito. Sem denominador, é **carga de relato** —
 * quantos registros houve. São perguntas diferentes, e a legenda diz qual está
 * sendo respondida. O que não acontece é a tela chamar uma de outra: percentual
 * calculado sobre denominador ausente é número inventado com aparência de
 * medição, e é o modo de errar que mais custa numa reunião.
 */

export interface MapaDeCalorProps {
  dados: CruzamentoClinico;
}

/** As quatro faixas do protótipo, em fração da escala — 25 %, 40 %, 60 %, resto. */
const FAIXAS = [
  { ate: 0.24, classe: "bg-chart-2/15 text-foreground" },
  { ate: 0.39, classe: "bg-chart-2/35 text-foreground" },
  { ate: 0.59, classe: "bg-chart-1/45 text-foreground" },
  { ate: 1, classe: "bg-chart-1/75 text-foreground" },
] as const;

const FAIXA_MAXIMA = FAIXAS[FAIXAS.length - 1] as (typeof FAIXAS)[number];

function faixaDe(fracao: number) {
  return FAIXAS.find((faixa) => fracao <= faixa.ate) ?? FAIXA_MAXIMA;
}

/**
 * A medida que o mapa está desenhando.
 *
 * `escala` é o topo da régua: 100 no modo de prevalência, o maior valor do mapa
 * no modo de contagem — sem ele, uma clínica com no máximo 4 registros por
 * célula desenharia um mapa inteiramente pálido e outra com 400 um mapa
 * inteiramente escuro, e nenhum dos dois mostraria onde está a concentração.
 */
interface Medida {
  escala: number;
  valorDe: (celula: CelulaCruzamento) => number | null;
  escrever: (valor: number) => string;
  legenda: (fracao: number) => string;
  descricao: string;
}

function medidaDe(dados: CruzamentoClinico): Medida {
  if (dados.prevalencia_disponivel) {
    return {
      escala: 100,
      valorDe: (celula) => celula.percentual,
      escrever: (valor) => `${valor}%`,
      legenda: (fracao) => `${Math.round(fracao * 100)}%`,
      descricao: `Percentual de pacientes com o efeito em grau ${dados.grau_minimo} ou maior, por protocolo.`,
    };
  }

  const maior = Math.max(1, ...dados.celulas.map((celula) => celula.registros));

  return {
    escala: maior,
    valorDe: (celula) => celula.registros,
    escrever: (valor) => formatNumber(valor),
    legenda: (fracao) => `até ${formatNumber(Math.round(fracao * maior))}`,
    descricao: `Registros de efeito em grau ${dados.grau_minimo} ou maior, por protocolo.`,
  };
}

function tituloDaCelula(
  dados: CruzamentoClinico,
  celula: CelulaCruzamento,
  protocolo: string,
  sintoma: string,
): string {
  const grau = `em grau ${dados.grau_minimo} ou maior`;

  if (dados.prevalencia_disponivel) {
    return `${formatNumber(celula.pacientes_com)} de ${formatNumber(celula.pacientes_total ?? 0)} pacientes em ${protocolo} relataram ${sintoma} ${grau}.`;
  }

  const pacientes = celula.pacientes_exato
    ? `${formatNumber(celula.pacientes_com)} pacientes`
    : `ao menos ${formatNumber(celula.pacientes_com)} pacientes`;

  return `${formatNumber(celula.registros)} registros de ${sintoma} ${grau} em ${protocolo}, de ${pacientes}.`;
}

export function MapaDeCalor({ dados }: MapaDeCalorProps) {
  const medida = medidaDe(dados);

  const porChave = new Map(
    dados.celulas.map((celula) => [`${celula.protocolo}\u0000${celula.sintoma_id}`, celula]),
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Sem denominador o mapa troca de medida, e isso vem ANTES da tabela:
          quem lê "18" precisa saber que são registros, não por cento, antes de
          tirar conclusão do número. */}
      {!dados.prevalencia_disponivel && dados.motivo_sem_prevalencia && (
        <p className="border-border bg-muted/40 text-muted-foreground rounded-xl border px-4 py-3 text-[11px] leading-relaxed">
          <strong className="text-foreground font-medium">
            O mapa mostra contagem de registros, não prevalência.
          </strong>{" "}
          {dados.motivo_sem_prevalencia}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-xs">
          <caption className="sr-only">{medida.descricao}</caption>

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
                  title={protocolo}
                >
                  {protocolo}
                </th>

                {dados.sintomas.map((sintoma) => {
                  const celula = porChave.get(`${protocolo}\u0000${sintoma.id}`);
                  const valor = celula ? medida.valorDe(celula) : null;

                  if (!celula || valor === null) {
                    return (
                      <td
                        key={sintoma.id}
                        className="text-muted-foreground bg-muted/40 rounded-md px-2 py-2 text-center"
                        title={
                          dados.prevalencia_disponivel
                            ? "Nenhum paciente neste protocolo no recorte atual."
                            : "Nenhum registro deste efeito neste protocolo no recorte atual."
                        }
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
                        faixaDe(valor / medida.escala).classe,
                      )}
                      title={tituloDaCelula(dados, celula, protocolo, sintoma.label)}
                    >
                      {medida.escrever(valor)}
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
          <span key={faixa.ate} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-3 rounded-sm", faixa.classe)} />
            {medida.legenda(faixa.ate)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default MapaDeCalor;
