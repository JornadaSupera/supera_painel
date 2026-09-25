import { Info, LoaderCircle, RotateCcw, Save } from "lucide-react";
import { useMemo, useState } from "react";

import { ErrorState, SkeletonTable } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
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

  if (isLoading) return <SkeletonTable columns={4} rows={10} />;
  if (isError || !matriz) return <ErrorState error={error} onRetry={() => void refetch()} />;

  /*
   * O editor só monta com a matriz em mãos, e inicializa o rascunho direto dela.
   *
   * Antes o rascunho nascia `null` e era copiado por efeito: a primeira
   * renderização COM dado ainda caía no esqueleto, e o efeito provocava um
   * commit a mais — além de deixar a sincronização do rascunho delicada, que é
   * a diferença entre descartar uma edição de propósito e descartá-la por
   * acidente.
   *
   * A `key` é a assinatura do CONTEÚDO, não o instante da resposta: refetch que
   * devolve a mesma matriz preserva o que a pessoa estava editando, e matriz que
   * mudou de verdade no servidor remonta o editor e descarta o rascunho —
   * salvar por cima da alteração de outra pessoa é o que isso evita.
   */
  return <EditorDaMatriz key={assinaturaDa(matriz)} matriz={matriz} />;
}

/** Assinatura estável do que está concedido, para a `key` do editor. */
function assinaturaDa(matriz: Matriz): string {
  return matriz.papeis
    .map((papel) => `${papel}:${[...(matriz.concedidas[papel] ?? [])].sort().join(",")}`)
    .join("|");
}

function EditorDaMatriz({ matriz }: { matriz: Matriz }) {
  const salvar = useSalvarMatriz();
  const [rascunho, setRascunho] = useState<Record<Papel, Permissao[]>>(matriz.concedidas);

  const alterado = useMemo(
    () =>
      matriz.papeis.some((papel) => {
        const antes = [...(matriz.concedidas[papel] ?? [])].sort();
        const agora = [...(rascunho[papel] ?? [])].sort();
        return antes.join("|") !== agora.join("|");
      }),
    [matriz, rascunho],
  );

  const alternar = (papel: Papel, permissao: Permissao) => {
    setRascunho((atual) => {
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

  // One role at a time on a phone: the matrix needs ~550px for three role
  // columns, and below that only the first one showed, cut in half.
  const compact = !useMediaQuery(BREAKPOINT.md);

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
        {compact ? (
          <PermissionsByRole
            matriz={matriz}
            grupos={grupos}
            rascunho={rascunho}
            onToggle={alternar}
          />
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
        )}

        <div
          className={cn(
            "border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-3",
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

/**
 * The matrix for a single role, as a list — the phone layout.
 *
 * It edits the same draft as the table, so switching the viewport mid-edit
 * keeps what was changed. Each row is a `<label>`: the whole line toggles the
 * switch, not only the 36px control.
 */
function PermissionsByRole({
  matriz,
  grupos,
  rascunho,
  onToggle,
}: {
  matriz: Matriz;
  grupos: ReturnType<typeof agruparPorSecao>;
  rascunho: Record<Papel, Permissao[]>;
  onToggle: (papel: Papel, permissao: Permissao) => void;
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
              const text = (
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm">{permissao.label}</span>
                  <span className="text-muted-foreground font-mono text-[11px] break-all">
                    {permissao.id}
                  </span>
                </span>
              );

              return (
                <li key={permissao.id}>
                  {exclusive ? (
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      {text}
                      <span className="text-muted-foreground shrink-0 text-[11px]">
                        só por especialidade
                      </span>
                    </div>
                  ) : (
                    <label className="hover:bg-muted/40 flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors">
                      {text}
                      <Switch
                        checked={(rascunho[role] ?? []).includes(permissao.id)}
                        onCheckedChange={() => onToggle(role, permissao.id)}
                        className="shrink-0"
                      />
                    </label>
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
