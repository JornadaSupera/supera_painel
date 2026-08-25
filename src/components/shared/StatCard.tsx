import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { NivelBadge } from "./PageHeader";
import { cn } from "@/lib/utils";

/**
 * Cartão de indicador (KPI).
 *
 * Estrutura do protótipo, de cima para baixo:
 *
 *     ┌──────────────────────────────┐
 *     │ [ícone]            [+8 mês]  │  ← acento à esquerda, variação à direita
 *     │                              │
 *     │ PACIENTES ATIVOS             │  ← rótulo, maiúsculo e pequeno
 *     │ 127                          │  ← valor, o único elemento grande
 *     │ em tratamento                │  ← contexto
 *     └──────────────────────────────┘
 *
 * O valor usa `tabular-nums`, não fonte monoespaçada: mantém a face Geist do
 * resto da interface e ainda assim alinha os dígitos em coluna entre cartões.
 */

export interface StatCardProps {
  label: string;
  valor?: string | number;
  /** Sufixo colado ao valor: "%", "min". */
  unidade?: string;
  /** Variação: positivo sobe, negativo desce. */
  variacao?: number;
  /**
   * Unidade da variação. "%" percentual · "pp" pontos percentuais ·
   * "" absoluto. Somar pontos percentuais como se fossem porcentagem é um erro
   * clássico de leitura — por isso a distinção é explícita.
   */
  variacaoUnidade?: string;
  /** Base de comparação, exibida dentro da pílula: "mês", "semana". */
  periodo?: string;
  /** Linha sob o valor: "em tratamento". */
  contexto?: string;
  /** Quando cair é bom — alertas ativos, tempo de resposta. */
  inverterCor?: boolean;
  icone?: ReactNode;
  /** Classes do acento do ícone: `bg-supera-uniao/10 text-supera-uniao`. */
  acento?: string;
  /**
   * Nível do escopo. Indicador de nível Médio recebe a pílula do protótipo no
   * canto do cartão — é assim que o cliente confere o que foi contratado.
   */
  nivel?: "mvp" | "medio";
  /** Drill-down para o relatório correspondente. */
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}

const BASE = "bg-card text-card-foreground flex min-w-0 flex-col rounded-2xl border p-4";

export function StatCard({
  label,
  valor,
  unidade,
  variacao,
  variacaoUnidade = "%",
  periodo,
  contexto,
  inverterCor = false,
  icone,
  acento = "bg-primary/10 text-primary",
  nivel,
  onClick,
  loading = false,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      // Mesma altura do conteúdo final: a linha de KPIs não "pula" quando os
      // dados chegam.
      <div className={cn(BASE, className)} aria-busy="true">
        <div className="flex items-start justify-between">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="h-4 w-14 rounded-md" />
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <span className="sr-only">Carregando indicador</span>
      </div>
    );
  }

  const temVariacao = typeof variacao === "number" && Number.isFinite(variacao);
  const subiu = temVariacao && variacao > 0;
  const caiu = temVariacao && variacao < 0;
  const bom = inverterCor ? caiu : subiu;
  const ruim = inverterCor ? subiu : caiu;

  const TrendIcon = subiu ? TrendingUp : caiu ? TrendingDown : Minus;

  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-2">
        {icone && (
          <span aria-hidden="true" className={cn("rounded-lg p-1.5 [&_svg]:size-4", acento)}>
            {icone}
          </span>
        )}

        {temVariacao && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold [&_svg]:size-3",
              // A escala de grau do projeto: mood-1 é o verde-limão do "bom",
              // mood-5 o vermelho do "ruim".
              bom
                ? "bg-mood-1/10 text-mood-1"
                : ruim
                  ? "bg-mood-5/10 text-mood-5"
                  : "bg-muted text-muted-foreground",
            )}
          >
            <TrendIcon aria-hidden="true" />
            {variacao > 0 ? "+" : ""}
            {variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
            {variacaoUnidade}
            {periodo && ` ${periodo}`}
          </span>
        )}
      </div>

      <div className="mt-3 min-w-0">
        <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums">
          {valor}
          {unidade}
        </p>
        {contexto && <p className="text-muted-foreground text-[11px]">{contexto}</p>}
      </div>
    </>
  );

  const cartao = onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        BASE,
        "hover:border-primary/40 h-full w-full cursor-pointer text-left transition-[border-color,box-shadow] hover:shadow-sm",
        !nivel && className,
      )}
    >
      {conteudo}
    </button>
  ) : (
    <div className={cn(BASE, "h-full", !nivel && className)}>{conteudo}</div>
  );

  if (nivel !== "medio") return cartao;

  // A pílula de nível flutua sobre o canto do cartão, como no protótipo.
  // O wrapper `relative` existe só para ancorá-la.
  return (
    <div className={cn("relative", className)}>
      {cartao}
      <NivelBadge nivel="Médio" className="absolute right-2 bottom-2" />
    </div>
  );
}

export default StatCard;
