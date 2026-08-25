import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina classes Tailwind resolvendo conflitos.
 *
 * `clsx` monta a lista condicional; `twMerge` garante que a última classe
 * conflitante vença — sem ela, `cn("p-2", "p-4")` deixaria as duas no DOM e a
 * ordem no CSS decidiria, não a intenção de quem chamou.
 *
 * É o utilitário que o shadcn/ui espera em `@/lib/utils`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
