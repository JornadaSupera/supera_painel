import { Construction, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Espaço reservado de um módulo ainda não construído.
 *
 * Existe para que a navegação da Fase 3 esteja completa e navegável desde já:
 * cada item da sidebar leva a uma tela real, com o cabeçalho definitivo e a
 * guarda de permissão já ativa. Só o miolo chega depois.
 *
 * Cada arquivo destes é substituído pela tela real na fase indicada.
 */
export interface ModuloEmConstrucaoProps {
  fase: number;
  /** Link da tela correspondente no protótipo oficial. */
  prototipo: string;
  /** O que a fase entrega — os itens do plano. */
  entrega: string[];
}

export function ModuloEmConstrucao({ fase, prototipo, entrega }: ModuloEmConstrucaoProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
        <span className="bg-muted text-muted-foreground flex size-13 items-center justify-center rounded-full">
          <Construction size={24} aria-hidden="true" />
        </span>

        <div className="flex max-w-[52ch] flex-col gap-2">
          <p className="text-base font-semibold">Módulo previsto para a Fase {fase}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A navegação, o cabeçalho e a guarda de permissão desta tela já estão no lugar. O
            conteúdo chega na fase indicada.
          </p>
        </div>

        <ul className="text-muted-foreground flex max-w-[52ch] flex-col gap-1.5 text-left text-sm">
          {entrega.map((item) => (
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
            <a href={prototipo} target="_blank" rel="noreferrer noopener">
              <ExternalLink />
              Abrir no protótipo
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default ModuloEmConstrucao;
