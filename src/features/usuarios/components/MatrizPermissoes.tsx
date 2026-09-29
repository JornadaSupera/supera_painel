import { Check, Info, Minus } from "lucide-react";
import { useState } from "react";

import { ErrorState, SkeletonTable } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
import { PAPEL_LABEL, type Papel } from "@/lib/enums";
import type { Permissao } from "@/lib/rbac";
import type { MatrizPermissoes as Matriz } from "@/types/usuario";
import { useMatrizPermissoes } from "../hooks/useUsuarios";

/**
 * Matriz papel × permissão, somente leitura.
 *
 * O escopo contratado pede que se veja quem pode o quê; o protótipo não desenha
 * a tela. Fica como uma aba de Usuários — que é onde a pergunta aparece — em vez
 * de virar uma décima rota fora do escopo.
 *
 * > [!] A matriz por papel é regra de código, não dado do banco.
 * Ela é a mesma fonte que `lib/rbac.ts` usa para decidir o que `<Can>` mostra, e
 * o banco não tem onde gravá-la. Deixá-la editável só fazia a tela aceitar uma
 * alteração e falhar ao salvar. O que se concede pessoa a pessoa é outro eixo,
 * e mora na ficha de cada profissional.
 *
 * > [!] Permissão exclusiva de especialidade não pertence a papel nenhum.
 * O sigilo de Psicologia é da especialidade. A linha aparece marcada como tal —
 * esconder a regra faria alguém procurar por ela em vão.
 */

export function MatrizPermissoes() {
  const { data: matriz, isLoading, isError, error, refetch } = useMatrizPermissoes();

  if (isLoading) return <SkeletonTable columns={4} rows={10} />;
  if (isError || !matriz) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return <MatrizSomenteLeitura matriz={matriz} />;
}

/**
 * A marca de uma célula. Ícone e texto juntos: a cor sozinha não pode carregar
 * o significado, e o texto de leitor de tela é o que a caixa de seleção dava.
 */
function Concessao({ concedida }: { concedida: boolean }) {
  return concedida ? (
    <>
      <Check aria-hidden className="text-primary size-4" />
      <span className="sr-only">Concedida</span>
    </>
  ) : (
    <>
      <Minus aria-hidden className="text-muted-foreground/60 size-4" />
      <span className="sr-only">Não concedida</span>
    </>
  );
}

function MatrizSomenteLeitura({ matriz }: { matriz: Matriz }) {
  const grupos = agruparPorSecao(matriz);

  // One role at a time on a phone: the matrix needs ~550px for three role
  // columns, and below that only the first one showed, cut in half.
  const compact = !useMediaQuery(BREAKPOINT.md);

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Info />
        <AlertTitle>Somente leitura</AlertTitle>
        <AlertDescription>
          Esta matriz mostra o que cada papel alcança nas telas do painel. Ela é uma regra do
          próprio painel, e não se edita aqui. Para dar uma permissão a uma pessoa em particular,
          abra a ficha dela em Usuários e use “Permissões restritas”.
        </AlertDescription>
      </Alert>

      <div className="bg-card overflow-hidden rounded-2xl border">
        {compact ? (
          <PermissionsByRole matriz={matriz} grupos={grupos} />
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Permissões concedidas a cada papel do painel administrativo.
              </caption>

              <thead>
                <tr className="bg-muted/30 border-b">
                  <th
                    scope="col"
                    className="text-muted-foreground h-9 px-4 text-left text-[11px] font-medium tracking-wider uppercase"
                  >
                    Permissão
                  </th>

                  {matriz.papeis.map((papel) => (
                    <th
                      key={papel}
                      scope="col"
                      className="text-muted-foreground h-9 w-32 px-2 text-center text-[11px] font-medium tracking-wider uppercase"
                    >
                      {PAPEL_LABEL[papel]}
                    </th>
                  ))}
                </tr>
              </thead>

              {grupos.map((grupo) => (
                <tbody key={grupo.titulo}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={matriz.papeis.length + 1}
                      className="bg-muted/15 text-muted-foreground border-b px-4 py-1.5 text-left text-[11px] font-semibold"
                    >
                      {grupo.titulo}
                    </th>
                  </tr>

                  {grupo.permissoes.map((permissao) => {
                    const exclusiva = matriz.exclusivas_de_especialidade.includes(permissao.id);

                    return (
                      <tr key={permissao.id} className="hover:bg-muted/40 border-b transition-colors">
                        <td className="px-4 py-2">
                          <span>{permissao.label}</span>
                          <span className="text-muted-foreground ml-2 font-mono text-[11px]">
                            {permissao.id}
                          </span>
                        </td>

                        {matriz.papeis.map((papel) => (
                          <td key={papel} className="p-0 text-center">
                            {exclusiva ? (
                              <span className="text-muted-foreground block px-2 py-2 text-[11px]">
                                só por especialidade
                              </span>
                            ) : (
                              <span className="flex h-10 items-center justify-center px-2">
                                <Concessao concedida={concedeA(matriz, papel, permissao.id)} />
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The matrix for a single role, as a list — the phone layout.
 */
function PermissionsByRole({
  matriz,
  grupos,
}: {
  matriz: Matriz;
  grupos: ReturnType<typeof agruparPorSecao>;
}) {
  const [role, setRole] = useState<Papel | undefined>(matriz.papeis[0]);

  if (!role) return null;

  return (
    <div className="flex flex-col">
      <div className="bg-muted/30 border-b px-4 py-3">
        <Select value={role} onValueChange={(value) => setRole(value as Papel)}>
          <SelectTrigger aria-label="Papel" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {matriz.papeis.map((papel) => (
              <SelectItem key={papel} value={papel}>
                {PAPEL_LABEL[papel]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {grupos.map((grupo) => (
        <section key={grupo.titulo} aria-label={grupo.titulo}>
          <h3 className="bg-muted/15 text-muted-foreground border-b px-4 py-1.5 text-[11px] font-semibold">
            {grupo.titulo}
          </h3>

          <ul className="divide-border divide-y border-b">
            {grupo.permissoes.map((permissao) => {
              const exclusive = matriz.exclusivas_de_especialidade.includes(permissao.id);

              return (
                <li
                  key={permissao.id}
                  className="flex min-h-12 items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm">{permissao.label}</span>
                    <span className="text-muted-foreground font-mono text-[11px] break-all">
                      {permissao.id}
                    </span>
                  </span>

                  {exclusive ? (
                    <span className="text-muted-foreground shrink-0 text-[11px]">
                      só por especialidade
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center">
                      <Concessao concedida={concedeA(matriz, role, permissao.id)} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function concedeA(matriz: Matriz, papel: Papel, permissao: Permissao): boolean {
  return (matriz.concedidas[papel] ?? []).includes(permissao);
}

/** Agrupa as permissões pelas seções que a camada de dados já rotulou. */
function agruparPorSecao(matriz: Matriz) {
  const porGrupo = new Map<string, Matriz["permissoes"]>();

  for (const permissao of matriz.permissoes) {
    const atual = porGrupo.get(permissao.grupo) ?? [];
    atual.push(permissao);
    porGrupo.set(permissao.grupo, atual);
  }

  return [...porGrupo.entries()].map(([titulo, permissoes]) => ({ titulo, permissoes }));
}

export default MatrizPermissoes;
