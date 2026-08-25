import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { iniciais } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Avatar de pessoa, com iniciais e cor estável.
 *
 * A cor é derivada do nome: a mesma pessoa tem sempre a mesma cor em qualquer
 * tela, sem precisar guardar isso no banco. Usa a paleta de gráficos para não
 * inventar cor fora do sistema.
 */

const TAMANHOS = {
  xs: "size-6 text-2xs",
  sm: "size-7.5 text-xs",
  md: "size-9.5 text-sm",
  lg: "size-12 text-base",
  xl: "size-18 text-xl",
} as const;

export type AvatarSize = keyof typeof TAMANHOS;

function corDoNome(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i += 1) {
    hash = (hash * 31 + nome.charCodeAt(i)) % 997;
  }
  return `var(--chart-${(hash % 5) + 1})`;
}

export interface UserAvatarProps {
  /** Obrigatório: gera iniciais, cor e texto alternativo. */
  nome: string;
  src?: string;
  size?: AvatarSize;
  /** Deriva a cor do nome em vez de usar a primária. */
  colorido?: boolean;
  className?: string;
}

export function UserAvatar({
  nome,
  src,
  size = "md",
  colorido = false,
  className,
}: UserAvatarProps) {
  return (
    <Avatar className={cn(TAMANHOS[size], className)} title={nome || undefined}>
      {src && <AvatarImage src={src} alt={nome} />}
      <AvatarFallback
        className="font-semibold tracking-wide text-white"
        style={{ backgroundColor: colorido ? corDoNome(nome) : "var(--primary)" }}
      >
        {iniciais(nome)}
      </AvatarFallback>
    </Avatar>
  );
}

export interface Pessoa {
  id: string;
  nome: string;
  src?: string;
}

/** Avatares empilhados com contador de excedente. */
export function AvatarGroup({
  pessoas = [],
  max = 4,
  size = "sm",
  className,
}: {
  pessoas?: Pessoa[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  const visiveis = pessoas.slice(0, max);
  const excedente = pessoas.length - visiveis.length;

  return (
    <span className={cn("inline-flex items-center *:not-first:-ml-2", className)}>
      {visiveis.map((pessoa) => (
        <UserAvatar
          key={pessoa.id}
          nome={pessoa.nome}
          src={pessoa.src}
          size={size}
          colorido
          className="border-card border-2"
        />
      ))}

      {excedente > 0 && (
        <span
          title={`mais ${excedente}`}
          className={cn(
            "bg-muted text-muted-foreground border-card inline-flex items-center justify-center rounded-full border-2 font-semibold",
            TAMANHOS[size],
          )}
        >
          +{excedente}
        </span>
      )}
    </span>
  );
}
