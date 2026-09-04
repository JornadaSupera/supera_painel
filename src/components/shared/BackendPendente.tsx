import { Construction } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Aviso de operação que o backend ainda não executa.
 *
 * Diferente de `UnderConstruction`, que fala de uma TELA inteira ainda não
 * construída. Este fala de uma tela pronta cujo dado ou cuja ação depende de
 * algo que o backend não expõe — o caso em que a interface existe, funciona, e
 * precisa dizer com todas as letras o que não vai acontecer.
 *
 * O texto é sempre o motivo concreto, nunca "indisponível no momento": quem
 * opera o painel precisa saber o que pedir e a quem.
 */
export interface BackendPendenteProps {
  /** O que não está disponível: "Sessões de quimioterapia". */
  titulo?: string;
  /** Por quê. Vem de `motivoIndisponivel()` ou do texto da própria tela. */
  motivo: string;
  /** Ocupa a altura de um gráfico, para o cartão não colapsar. */
  altura?: number;
  className?: string;
}

export function BackendPendente({ titulo, motivo, altura, className }: BackendPendenteProps) {
  return (
    <div
      className={cn(
        "border-border/70 text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center",
        className,
      )}
      style={altura ? { minHeight: altura } : undefined}
    >
      <Construction size={20} aria-hidden="true" className="opacity-70" />

      <p className="text-foreground text-sm font-medium">
        {titulo ? `${titulo} · ainda em desenvolvimento` : "Ainda em desenvolvimento"}
      </p>
      <p className="max-w-[46ch] text-xs leading-relaxed">{motivo}</p>
    </div>
  );
}

export default BackendPendente;
