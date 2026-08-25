import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Person avatar, with initials and a stable colour.
 *
 * The colour is derived from the name: the same person always gets the same
 * colour on every screen, with nothing stored in the database. It draws from
 * the chart palette so no colour is invented outside the system.
 */

const SIZES = {
  xs: "size-6 text-2xs",
  sm: "size-7.5 text-xs",
  md: "size-9.5 text-sm",
  lg: "size-12 text-base",
  xl: "size-18 text-xl",
} as const;

export type AvatarSize = keyof typeof SIZES;

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  return `var(--chart-${(hash % 5) + 1})`;
}

export interface UserAvatarProps {
  /** Required: drives the initials, the colour and the alt text. */
  name: string;
  src?: string;
  size?: AvatarSize;
  /** Derives the colour from the name instead of using the primary. */
  colorful?: boolean;
  /**
   * `soft` is the reference default: tinted background with full-colour
   * initials. In a twenty-row list, twenty solid circles compete with the name
   * — which is the data the person is looking for. `solid` is for when the
   * avatar is the subject itself.
   */
  tone?: "soft" | "solid";
  className?: string;
}

export function UserAvatar({
  name,
  src,
  size = "md",
  colorful = false,
  tone = "soft",
  className,
}: UserAvatarProps) {
  const color = colorful ? colorFromName(name) : "var(--primary)";

  return (
    <Avatar className={cn(SIZES[size], className)} title={name || undefined}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback
        className="font-semibold tracking-wide"
        style={
          tone === "soft"
            ? // `color-mix` instead of a `bg-*/10` class because the colour can
              // come from the name, and Tailwind generates no utility for a
              // dynamic value.
              { backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)`, color }
            : { backgroundColor: color, color: "var(--primary-foreground)" }
        }
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export interface Person {
  id: string;
  name: string;
  src?: string;
}

/** Stacked avatars with an overflow counter. */
export function AvatarGroup({
  people = [],
  max = 4,
  size = "sm",
  className,
}: {
  people?: Person[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <span className={cn("inline-flex items-center *:not-first:-ml-2", className)}>
      {visible.map((person) => (
        <UserAvatar
          key={person.id}
          name={person.name}
          src={person.src}
          size={size}
          colorful
          className="border-card border-2"
        />
      ))}

      {overflow > 0 && (
        <span
          title={`mais ${overflow}`}
          className={cn(
            "bg-muted text-muted-foreground border-card inline-flex items-center justify-center rounded-full border-2 font-semibold",
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
