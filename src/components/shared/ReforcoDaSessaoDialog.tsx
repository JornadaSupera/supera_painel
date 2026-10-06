import { LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

/**
 * Pede o código do autenticador no momento de uma ação que o exige.
 *
 * O login do painel não pede o segundo fator (ainda), mas algumas ações do
 * banco só aceitam a sessão que o verificou — cadastrar alguém da equipe,
 * redefinir o autenticador de outra pessoa. Em vez de recusar com "sem
 * permissão" depois de a pessoa preencher um formulário, a tela pede o código
 * antes, e a ação segue de onde parou.
 *
 * Duas situações, porque duas são as saídas:
 *  - a conta TEM autenticador: basta o código de agora;
 *  - a conta NÃO tem: não há código a digitar, e a saída é cadastrar um.
 *
 * Só apresentação: quem verifica o código, e o que acontece depois, é do hook
 * `useReforcoDaSessao`.
 */

const TAMANHO_CODIGO = 6;

export interface ReforcoDaSessaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A conta não tem autenticador cadastrado. */
  semFator: boolean;
  verificando: boolean;
  /** Mensagem da última tentativa recusada. */
  erro: string | null;
  onVerificar: (codigo: string) => void;
  onCadastrar: () => void;
}

export function ReforcoDaSessaoDialog({
  open,
  onOpenChange,
  semFator,
  verificando,
  erro,
  onVerificar,
  onCadastrar,
}: ReforcoDaSessaoDialogProps) {
  const [codigo, setCodigo] = useState("");

  // O código de uma tentativa não vale para a seguinte.
  useEffect(() => {
    if (open) setCodigo("");
  }, [open]);

  // Recusado, recomeça do zero em vez de pedir para apagar dígito por dígito.
  useEffect(() => {
    if (erro) setCodigo("");
  }, [erro]);

  const enviar = (valor: string) => {
    if (!/^\d{6}$/.test(valor) || verificando) return;
    onVerificar(valor);
  };

  const aoMudar = (valor: string) => {
    setCodigo(valor);
    if (valor.length === TAMANHO_CODIGO) enviar(valor);
  };

  return (
    <Dialog open={open} onOpenChange={(proximo) => !verificando && onOpenChange(proximo)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex gap-4">
            <span
              aria-hidden="true"
              className="bg-primary/10 text-primary-ink flex size-10 shrink-0 items-center justify-center rounded-full"
            >
              {semFator ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
            </span>

            <div className="flex min-w-0 flex-col gap-2 text-left">
              <DialogTitle>
                {semFator ? "Falta o aplicativo autenticador" : "Confirme sua identidade"}
              </DialogTitle>
              <DialogDescription>
                {semFator
                  ? "Esta ação só é aceita em uma sessão com o segundo fator verificado, e a sua conta ainda não tem aplicativo autenticador. Cadastre um na tela Segurança e volte."
                  : "Esta ação altera o acesso de alguém da equipe e exige o segundo fator. Digite o código de 6 dígitos que o aplicativo autenticador mostra agora."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!semFator && (
          <div className="flex flex-col gap-3">
            {erro && (
              <p role="alert" className="text-destructive text-sm">
                {erro}
              </p>
            )}

            <Label htmlFor="codigo-reforco">Código do aplicativo</Label>
            <InputOTP
              id="codigo-reforco"
              maxLength={TAMANHO_CODIGO}
              value={codigo}
              onChange={aoMudar}
              disabled={verificando}
              autoFocus
              containerClassName="justify-start"
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
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={verificando}>
            Cancelar
          </Button>

          {semFator ? (
            <Button onClick={onCadastrar}>Cadastrar autenticador</Button>
          ) : (
            <Button onClick={() => enviar(codigo)} disabled={codigo.length !== TAMANHO_CODIGO || verificando}>
              {verificando && <LoaderCircle className="animate-spin" />}
              Verificar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReforcoDaSessaoDialog;
