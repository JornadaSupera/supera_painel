import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

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
      <dt className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
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
          <span aria-hidden="true" className="text-primary">
            {icone}
          </span>
          {titulo}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}
