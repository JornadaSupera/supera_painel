import { IS_DEV } from "@/lib/env";
import { ERROR_CODE, fail } from "@/services/contracts";
import { RESOURCES, type Adapter, type ResourceName } from "@/services/contracts/resources";

/**
 * Montagem de adapter a partir do inventário de RESOURCES.
 *
 * Garante que os dois adapters — mock e supabase — tenham exatamente a mesma
 * superfície. Operação ainda não escrita não vira `undefined is not a
 * function` no meio de uma tela: vira um erro do contrato, com código estável,
 * que o `ErrorState` sabe renderizar.
 *
 * Em desenvolvimento, expõe `__pendentes` — o checklist vivo do que falta.
 */

type Implemented = Partial<Record<ResourceName, Record<string, unknown>>>;

export interface BuildAdapterConfig {
  name: "mock" | "supabase";
  implemented?: Implemented;
}

export type BuiltAdapter = Adapter & { readonly __pendentes?: readonly string[] };

export function buildAdapter({ name, implemented = {} }: BuildAdapterConfig): BuiltAdapter {
  const adapter: Record<string, Record<string, unknown>> = {};
  const pendentes: string[] = [];

  for (const [resource, def] of Object.entries(RESOURCES)) {
    const impl = implemented[resource as ResourceName] ?? {};
    const bucket: Record<string, unknown> = {};

    for (const operation of def.operations) {
      const fn = impl[operation];

      if (typeof fn === "function") {
        bucket[operation] = fn;
      } else {
        bucket[operation] = makeStub({ name, resource, operation, fase: def.fase });
        pendentes.push(`${resource}.${operation}`);
      }
    }

    adapter[resource] = bucket;
  }

  if (IS_DEV && pendentes.length > 0) {
    Object.defineProperty(adapter, "__pendentes", {
      value: Object.freeze(pendentes),
      enumerable: false,
    });
  }

  // A construção é dinâmica (percorre RESOURCES em runtime), então o
  // compilador não consegue provar a forma final. A garantia vem do laço
  // acima, que preenche toda operação declarada — com stub, se preciso.
  return Object.freeze(adapter) as unknown as BuiltAdapter;
}

function makeStub({
  name,
  resource,
  operation,
  fase,
}: {
  name: string;
  resource: string;
  operation: string;
  fase: number;
}) {
  return async function notImplemented() {
    return fail(
      ERROR_CODE.NOT_IMPLEMENTED,
      `Ainda não disponível: "${resource}.${operation}" (fase ${fase}).`,
      { adapter: name, resource, operation, fase },
    );
  };
}
