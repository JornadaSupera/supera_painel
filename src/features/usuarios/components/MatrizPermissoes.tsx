import { Info, LoaderCircle, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ErrorState, SkeletonTable } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PAPEL_LABEL, type Papel } from "@/lib/enums";
import type { Permissao } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { MatrizPermissoes as Matriz } from "@/types/usuario";
import { useMatrizPermissoes, useSalvarMatriz } from "../hooks/useUsuarios";

/**
 * Editor da matriz papel × permissão.
 *
 * O escopo contratado pede o editor de permissões por papel; o protótipo não o
 * desenha. Fica como uma aba da tela de Usuários — que é onde a pergunta "quem
 * pode o quê" aparece — em vez de virar uma décima rota fora do escopo.
 *
 * > [!] Permissão exclusiva de especialidade não é editável aqui.
 * O sigilo de Psicologia pertence à especialidade, não ao papel. A linha
 * aparece marcada como tal e sem caixas — esconder a regra faria alguém
 * procurar por ela em vão.
 */

export function MatrizPermissoes() {
  const { data: matriz, isLoading, isError, error, refetch } = useMatrizPermissoes();
  const salvar = useSalvarMatriz();

  const [rascunho, setRascunho] = useState<Record<Papel, Permissao[]> | null>(null);

  // O rascunho nasce do que veio do servidor e é descartado a cada nova carga:
  // editar por cima de uma matriz desatualizada apagaria a alteração de outra
  // pessoa sem aviso.
  useEffect(() => {
    if (matriz) setRascunho(matriz.concedidas);
  }, [matriz]);

  const alterado = useMemo(() => {
    if (!matriz || !rascunho) return false;

    return matriz.papeis.some((papel) => {
      const antes = [...(matriz.concedidas[papel] ?? [])].sort();
      const agora = [...(rascunho[papel] ?? [])].sort();
      return antes.join("|") !== agora.join("|");
    });
  }, [matriz, rascunho]);

  if (isLoading) return <SkeletonTable columns={4} rows={10} />;
  if (isError || !matriz) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!rascunho) return <SkeletonTable columns={4} rows={10} />;

  const alternar = (papel: Papel, permissao: Permissao) => {
    setRascunho((atual) => {
      if (!atual) return atual;
      const lista = atual[papel] ?? [];

      return {
        ...atual,
        [papel]: lista.includes(permissao)
          ? lista.filter((item) => item !== permissao)
          : [...lista, permissao],
      };
    });
  };

  const grupos = agruparPorSecao(matriz);

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Info />
        <AlertTitle>As mudanças valem no próximo acesso</AlertTitle>
        <AlertDescription>
          Quem já está com o painel aberto continua com as permissões da sessão atual até sair e
          entrar de novo. Permissões concedidas individualmente a uma pessoa ficam na ficha dela.
        </AlertDescription>
      </Alert>

      <div className="bg-card overflow-hidden rounded-2xl border">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Permissões concedidas a cada papel do painel administrativo.
            </caption>

            <thead>
              <tr className="bg-muted/30 border-b">
                <th
                  scope="col"
                  className="text-muted-foreground h-9 px-4 text-left text-[10px] font-medium tracking-wider uppercase"
                >
                  Permissão
                </th>

                {matriz.papeis.map((papel) => (
                  <th
                    key={papel}
                    scope="col"
                    className="text-muted-foreground h-9 w-32 px-2 text-center text-[10px] font-medium tracking-wider uppercase"
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
                        <td key={papel} className="px-2 py-2 text-center">
                          {exclusiva ? (
                            <span className="text-muted-foreground text-[11px]">
                              só por especialidade
                            </span>
                          ) : (
                            <Checkbox
                              checked={(rascunho[papel] ?? []).includes(permissao.id)}
                              onCheckedChange={() => alternar(papel, permissao.id)}
                              aria-label={`${permissao.label} para ${PAPEL_LABEL[papel]}`}
                            />
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

        <div
          className={cn(
            "border-border flex items-center justify-between gap-4 border-t px-4 py-3",
            alterado && "bg-primary/5",
          )}
        >
          <p className="text-muted-foreground text-xs">
            {alterado ? "Há alterações não salvas." : "Nenhuma alteração pendente."}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!alterado || salvar.isPending}
              onClick={() => setRascunho(matriz.concedidas)}
            >
              <RotateCcw />
              Descartar
            </Button>

            <Button
              size="sm"
              disabled={!alterado || salvar.isPending}
              onClick={() => salvar.mutate(rascunho)}
            >
              {salvar.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}
              Salvar permissões
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
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
