import { ShieldOff } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog, ErrorState, PageHeader, SkeletonCards, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useGarantiaDaSessao } from "@/hooks/useGarantiaDaSessao";
import { MFA_REQUIRED } from "@/lib/env";
import { PAPEL } from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import { CadastroAutenticador } from "../components/CadastroAutenticador";
import { useRemoverSegundoFator, useSegundoFator } from "../hooks/useSegundoFator";

/**
 * Segurança da conta — o aplicativo autenticador de quem está logado.
 *
 * Uma tela só para os dois painéis, porque a conta é a mesma coisa dos dois
 * lados. O que muda é a regra: para o administrador o segundo fator é exigido e
 * não se remove; para o profissional é opcional, e quem o cadastrou passa a
 * informar o código a cada acesso.
 *
 * Só a PRÓPRIA conta: o fator de outra pessoa não passa por aqui.
 */
export function SegurancaContaPage() {
  const { user } = useAuth();
  const fator = useSegundoFator();
  const garantia = useGarantiaDaSessao();
  const remover = useRemoverSegundoFator();
  const [removendo, setRemovendo] = useState(false);

  const admin = user?.papel === PAPEL.ADMIN;

  // Remover o fator de quem o painel exige só trocaria a conta por um bloqueio:
  // no próximo acesso a moldura recusaria abrir e levaria ao cadastro de novo.
  const exigido = admin && (garantia.data?.exigido === true || MFA_REQUIRED);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Segurança da conta"
        subtitle="Verificação em duas etapas no seu acesso ao painel"
      />

      {fator.isLoading && <SkeletonCards count={1} />}

      {fator.isError && <ErrorState error={fator.error} onRetry={() => void fator.refetch()} />}

      {fator.data && (
        <section className="bg-card flex max-w-2xl flex-col gap-5 rounded-2xl border p-5">
          <header className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
            <div>
              <h2 className="text-foreground text-sm font-semibold">Aplicativo autenticador</h2>
              <p className="text-muted-foreground text-xs">
                {admin
                  ? "Exigido para o acesso administrativo."
                  : MFA_REQUIRED
                    ? "Opcional. Com ele, o login passa a pedir o código do aplicativo depois da senha."
                    : "Opcional. O login ainda não pede o código neste ambiente."}
              </p>
            </div>

            <StatusBadge
              tone={fator.data.cadastrado ? "success" : "warning"}
              size="sm"
              dot
              className="shrink-0"
            >
              {fator.data.cadastrado ? "Ativo" : "Não cadastrado"}
            </StatusBadge>
          </header>

          {fator.data.cadastrado ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-foreground text-sm">
                {MFA_REQUIRED
                  ? "Este acesso pede o código do aplicativo depois da senha"
                  : "O aplicativo está vinculado à conta"}
                {fator.data.cadastrado_em
                  ? `, desde ${formatDateTime(fator.data.cadastrado_em)}`
                  : ""}
                {MFA_REQUIRED ? "." : ". O login ainda não pede o código neste ambiente."}
              </p>

              {exigido ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  O autenticador não pode ser removido: o acesso administrativo exige o segundo
                  fator.
                </p>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setRemovendo(true)}
                  disabled={remover.isPending || !fator.data.fator_id}
                >
                  <ShieldOff />
                  Remover autenticador
                </Button>
              )}
            </div>
          ) : (
            <CadastroAutenticador />
          )}
        </section>
      )}

      <ConfirmDialog
        open={removendo}
        onOpenChange={setRemovendo}
        tone="warning"
        title="Remover o autenticador?"
        description="O aplicativo deixa de estar vinculado à conta. Se o celular foi perdido ou trocado, cadastre o novo depois de remover."
        confirmLabel="Remover"
        loading={remover.isPending}
        onConfirm={({ reason }) => {
          if (fator.data?.fator_id) {
            remover.mutate({ fator_id: fator.data.fator_id, motivo: reason });
          }
          setRemovendo(false);
        }}
      />
    </div>
  );
}

export default SegurancaContaPage;
