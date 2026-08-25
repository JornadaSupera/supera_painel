import { Construction, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Placeholder for a module that has not been built yet.
 *
 * It exists so the navigation is complete and walkable from day one: every
 * sidebar item leads to a real screen, with its final header and its permission
 * guard already active. Only the body arrives later.
 *
 * Each of these files is replaced by the real screen when its turn comes.
 */
export interface UnderConstructionProps {
  phase: number;
  /** Link to the matching screen in the official reference prototype. */
  prototypeUrl: string;
  /** What the phase delivers — the planned items. */
  deliverables: string[];
}

export function UnderConstruction({ phase, prototypeUrl, deliverables }: UnderConstructionProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
        <span className="bg-muted text-muted-foreground flex size-13 items-center justify-center rounded-full">
          <Construction size={24} aria-hidden="true" />
        </span>

        <div className="flex max-w-[52ch] flex-col gap-2">
          <p className="text-base font-semibold">Módulo previsto para a Fase {phase}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A navegação, o cabeçalho e a guarda de permissão desta tela já estão no lugar. O
            conteúdo chega na fase indicada.
          </p>
        </div>

        <ul className="text-muted-foreground flex max-w-[52ch] flex-col gap-1.5 text-left text-sm">
          {deliverables.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="text-primary">
                •
              </span>
              {item}
            </li>
          ))}
        </ul>

        {import.meta.env.DEV && (
          <Button variant="outline" size="sm" asChild>
            <a href={prototypeUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink />
              Abrir no protótipo
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default UnderConstruction;
