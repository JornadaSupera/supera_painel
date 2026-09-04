import { ArrowLeft, CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import type { Location as RouterLocation } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { AuthLayout } from "@/layouts/AuthLayout";

/**
 * Segundo fator — obrigatório.
 *
 * O PDF §5 é explícito: "Login com segundo fator obrigatório". Não existe
 * caminho que chegue ao painel sem passar por aqui; quem tenta acessar a rota
 * sem um desafio em curso volta para o login.
 */

const TAMANHO_CODIGO = 6;

export function MfaPage() {
  const { mfaChallenge, confirmMfa, cancelMfa, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);

  /* Contagem regressiva de validade do código. */
  useEffect(() => {
    if (!mfaChallenge) return undefined;

    const atualizar = () => {
      const restante = Math.max(
        0,
        Math.round((new Date(mfaChallenge.expira_em).getTime() - Date.now()) / 1000),
      );
      setSegundosRestantes(restante);
    };

    atualizar();
    const timer = setInterval(atualizar, 1000);
    return () => clearInterval(timer);
  }, [mfaChallenge]);

  const confirmar = async (valor: string) => {
    setErro(null);
    setEnviando(true);

    try {
      await confirmMfa(valor);
    } catch (e) {
      setErro((e as Error).message ?? "Código inválido.");
      // Limpa para que a próxima tentativa comece do zero, sem apagar dígito
      // por dígito.
      setCodigo("");
    } finally {
      setEnviando(false);
    }
  };

  /* Submete sozinho ao completar os 6 dígitos — o botão vira confirmação
     explícita para quem prefere, e caminho de repetição após erro. */
  const aoMudar = (valor: string) => {
    setCodigo(valor);
    if (valor.length === TAMANHO_CODIGO && !enviando) void confirmar(valor);
  };

  const voltar = () => {
    cancelMfa();
    navigate("/login", { replace: true, state: location.state });
  };

  if (isAuthenticated) {
    const destino = (location.state as { from?: RouterLocation } | null)?.from?.pathname ?? "/dashboard";
    return <Navigate to={destino} replace />;
  }

  if (!mfaChallenge) return <Navigate to="/login" replace />;

  const expirado = segundosRestantes === 0;
  const minutos = Math.floor((segundosRestantes ?? 0) / 60);
  const segundos = String((segundosRestantes ?? 0) % 60).padStart(2, "0");

  return (
    <AuthLayout
      title="Verificação em duas etapas"
      description={
        mfaChallenge.metodo === "totp" ? (
          <>
            Abra <strong className="text-foreground">{mfaChallenge.destino}</strong> e informe o
            código de {TAMANHO_CODIGO} dígitos.
          </>
        ) : (
          <>
            Enviamos um código de {TAMANHO_CODIGO} dígitos para{" "}
            <strong className="text-foreground font-mono">{mfaChallenge.destino}</strong>.
          </>
        )
      }
      footer={
        <button
          type="button"
          onClick={voltar}
          className="hover:text-foreground inline-flex items-center gap-2 underline underline-offset-4"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Usar outra conta
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        {erro && (
          <Alert variant="destructive" role="alert">
            <CircleAlert />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <Label htmlFor="codigo-mfa">Código de verificação</Label>

          <InputOTP
            id="codigo-mfa"
            maxLength={TAMANHO_CODIGO}
            value={codigo}
            onChange={aoMudar}
            disabled={enviando || expirado}
            autoFocus
            containerClassName="justify-center"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>

          <p className="text-muted-foreground text-center text-xs" aria-live="polite">
            {expirado ? (
              "O código expirou. Volte e entre novamente."
            ) : (
              <>
                Expira em{" "}
                <span className="text-foreground font-mono">
                  {minutos}:{segundos}
                </span>
              </>
            )}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => void confirmar(codigo)}
          disabled={codigo.length !== TAMANHO_CODIGO || enviando || expirado}
          className="w-full"
        >
          {enviando ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
          Confirmar acesso
        </Button>

        <p className="text-muted-foreground text-xs leading-relaxed">
          A verificação em duas etapas é obrigatória para todo acesso ao painel, por se tratar de
          dados de saúde.
        </p>
      </div>
    </AuthLayout>
  );
}

export default MfaPage;
