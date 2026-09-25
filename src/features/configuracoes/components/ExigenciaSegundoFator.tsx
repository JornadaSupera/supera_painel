import { ShieldCheck } from "lucide-react";

import { ErrorState, Footnote, SkeletonCards, StatusBadge } from "@/components/shared";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useGarantiaDaSessao } from "@/hooks/useGarantiaDaSessao";
import { formatDateTime } from "@/lib/format";
import { useSeguranca, useSetExigirMfa } from "../hooks/useConfiguracoes";

/**
 * A exigência de segundo fator no acesso administrativo.
 *
 * > [!] Ligar é o ato mais perigoso deste painel.
 * A partir dele, todo administrador sem autenticador cadastrado perde o acesso
 * — e conceder acesso também é ato de administrador, então não há caminho de
 * volta pelo próprio painel. O backend impõe a única proteção que funciona:
 * **só liga quem já está com o segundo fator verificado na própria sessão**,
 * provando no ato que consegue voltar a entrar.
 *
 * Desligar não exige o mesmo, pela razão oposta: a saída de emergência não pode
 * depender da porta que emperrou.
 *
 * A tela repete a guarda para explicar antes de a pessoa tentar. A barreira que
 * vale continua sendo a do banco: uma trava que mora só no cliente protege
 * apenas quem usa o cliente.
 */

export function ExigenciaSegundoFator() {
  const seguranca = useSeguranca();
  const garantia = useGarantiaDaSessao();
  const alterar = useSetExigirMfa();

  if (seguranca.isLoading) return <SkeletonCards count={1} />;

  if (seguranca.isError) {
    return <ErrorState error={seguranca.error} onRetry={() => void seguranca.refetch()} />;
  }

  const exige = seguranca.data?.exige_mfa;
  const sessaoTemFator = garantia.data?.nivel === "aal2";

  // Ligar exige sessão de dois fatores; desligar, não.
  const podeAlternar = exige === true || sessaoTemFator;

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card rounded-2xl border p-5">
        {/* On a phone the badge goes above the title: beside it, it squeezed
            the heading into three lines. */}
        <header className="mb-4 flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
          <div>
            <h2 className="text-foreground text-sm font-semibold">
              Verificação em duas etapas no acesso administrativo
            </h2>
            <p className="text-muted-foreground text-xs">
              Exige que a sessão tenha passado pelo aplicativo autenticador, e não apenas pela senha
            </p>
          </div>

          <StatusBadge tone={exige ? "success" : "warning"} size="sm" dot className="shrink-0">
            {exige === null ? "Não foi possível ler" : exige ? "Exigido" : "Não exigido"}
          </StatusBadge>
        </header>

        {exige === null ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Esta sessão não consegue ler a configuração de segurança. É o esperado para quem não tem
            perfil administrativo — a exigência se aplica apenas a ele.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Switch
                id="exigir-mfa"
                checked={exige}
                disabled={!podeAlternar || alterar.isPending}
                onCheckedChange={(marcado) => alterar.mutate({ exigir: marcado })}
              />
              <Label htmlFor="exigir-mfa" className="text-xs">
                Exigir segundo fator de todo acesso administrativo
              </Label>
            </div>

            {seguranca.data?.atualizado_em && (
              <p className="text-muted-foreground mt-3 text-[11px]">
                Última alteração em {formatDateTime(seguranca.data.atualizado_em)}
                {seguranca.data.atualizado_por && ` · por ${seguranca.data.atualizado_por}`}
              </p>
            )}
          </>
        )}
      </section>

      {/* A guarda do backend, dita antes de a pessoa esbarrar nela. */}
      {exige === false && !sessaoTemFator && (
        <div className="border-warning/30 bg-warning-bg text-warning-foreground flex gap-3 rounded-2xl border p-4">
          <ShieldCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium">Esta sessão não pode ligar a exigência</p>
            <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
              Você entrou apenas com a senha. Ligar a partir daqui trancaria a clínica do lado de
              fora — inclusive você, já que conceder acesso também é ato de administrador. Entre de
              novo usando o aplicativo autenticador e a opção fica disponível.
            </p>
          </div>
        </div>
      )}

      <Footnote>
        Com a exigência ligada, quem entra apenas com a senha continua com sessão válida e deixa de
        ser reconhecido como administrador — o painel bloqueia e explica, em vez de abrir todas as
        telas zeradas. Administrador sem autenticador cadastrado perde o acesso até cadastrar um, e
        o cadastro do fator ainda não acontece por esta tela.
      </Footnote>
    </div>
  );
}

export default ExigenciaSegundoFator;
