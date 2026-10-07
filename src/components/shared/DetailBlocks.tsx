import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Blocos de leitura de uma ficha — o cartão com título e o par rótulo/valor.
 *
 * Vivem aqui porque mais de um domínio os usa: a ficha do paciente e a do
 * profissional mostram coisas diferentes com a mesma anatomia. Duas cópias da
 * mesma anatomia divergem no primeiro ajuste de espaçamento, e o painel passa a
 * ter duas fichas que se parecem só de longe.
 */

export function DetailField({ rotulo, children }: { rotulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        {rotulo}
      </dt>
      {/*
        `??` e não `||`: um valor legítimo que seja string vazia ou zero — uma
        contagem de zero, por exemplo — não deve virar travessão.
      */}
      <dd className="text-sm">{children ?? "—"}</dd>
    </div>
  );
}

export function DetailSection({
  titulo,
  icone,
  children,
}: {
  titulo: string;
  icone: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true" className="text-primary-ink">
            {icone}
          </span>
          {titulo}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * The small uppercase heading of a record block — "DIAGNÓSTICO & TRATAMENTO",
 * "PRÓXIMOS COMPROMISSOS". It names a group without competing with the title of
 * the page, so it reads as a label, not as a headline.
 */
export function SectionHeading({
  children,
  id,
  className,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={cn(
        "text-muted-foreground text-xs font-medium tracking-wider uppercase",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** A card opened by a `SectionHeading`: the record's reading blocks, side by side or full width. */
export function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <SectionHeading>{title}</SectionHeading>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * A label beside its value. `DetailField` stacks the two; this keeps them on one
 * line, so a block of short facts reads down a single column of values.
 */
export function DetailRow({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-baseline gap-3">
      <dt className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        {label}
      </dt>
      <dd className="text-sm">{children ?? "—"}</dd>
    </div>
  );
}
