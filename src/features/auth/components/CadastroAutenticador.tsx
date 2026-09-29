import { Copy, LoaderCircle, QrCode, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import type { CadastroTotp } from "@/types/auth";
import {
  useCancelarCadastro,
  useConfirmarCadastro,
  useIniciarCadastro,
} from "../hooks/useSegundoFator";
import { mfaSchema } from "../schemas";
import { AuthErrorAlert } from "./AuthErrorAlert";

/**
 * O cadastro do aplicativo autenticador, do QR code ao primeiro código.
 *
 * Serve à tela de Segurança e à recusa de sessão sem segundo fator — nos dois
 * lugares é o mesmo fluxo, para que quem está trancado para fora não precise de
 * um caminho diferente de quem só quer proteger a própria conta.
 *
 * > [!] O fator só vale depois do primeiro código.
 * Escanear o QR code não ativa nada: o servidor só passa a exigir o autenticador
 * quando a pessoa prova que o aplicativo gera códigos que ele aceita. Fechar a
 * tela no meio não deixa a conta exigindo um código que ninguém tem.
 */

const TAMANHO_CODIGO = 6;

/** O segredo em grupos de quatro: é digitado à mão, e um bloco só é fácil de errar. */
function agrupar(segredo: string): string {
  return segredo.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export function CadastroAutenticador({ onConcluido }: { onConcluido?: () => void }) {
  const iniciar = useIniciarCadastro();
  const confirmar = useConfirmarCadastro();
  const cancelar = useCancelarCadastro();

  const [cadastro, setCadastro] = useState<CadastroTotp | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const comecar = () => {
    setErro(null);
    setCodigo("");
    iniciar.mutate(undefined, { onSuccess: (dados) => dados && setCadastro(dados) });
  };

  const desistir = () => {
    if (cadastro) cancelar.mutate({ fator_id: cadastro.fator_id });
    setCadastro(null);
    setCodigo("");
    setErro(null);
  };

  const ativar = (valor: string) => {
    if (!cadastro) return;

    const conferido = mfaSchema.safeParse({ codigo: valor });
    if (!conferido.success) {
      setErro(conferido.error.issues[0]?.message ?? "Código inválido.");
      return;
    }

    setErro(null);
    confirmar.mutate(
      { fator_id: cadastro.fator_id, codigo: conferido.data.codigo },
      {
        onSuccess: () => {
          setCadastro(null);
          onConcluido?.();
        },
        onError: (falha) => {
          setErro(falha.message);
          // Recomeça do zero, sem apagar dígito por dígito.
          setCodigo("");
        },
      },
    );
  };

  /* Envia sozinho ao completar os 6 dígitos, como a tela do login. */
  const aoMudar = (valor: string) => {
    setCodigo(valor);
    if (valor.length === TAMANHO_CODIGO && !confirmar.isPending) ativar(valor);
  };

  const copiarSegredo = async () => {
    if (!cadastro) return;

    try {
      await navigator.clipboard.writeText(cadastro.segredo);
      toast.success("Segredo copiado");
    } catch {
      toast.error("Não foi possível copiar", { description: "Selecione o texto e copie à mão." });
    }
  };

  if (!cadastro) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Button onClick={comecar} disabled={iniciar.isPending}>
          {iniciar.isPending ? <LoaderCircle className="animate-spin" /> : <QrCode />}
          Cadastrar aplicativo autenticador
        </Button>

        <p className="text-muted-foreground text-xs leading-relaxed">
          Funciona com Google Authenticator, Microsoft Authenticator, Authy, 1Password e
          similares. Não tem custo e não usa SMS.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="text-foreground flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>Abra o aplicativo autenticador no celular e escolha adicionar uma conta.</li>
        <li>Aponte a câmera para o QR code abaixo, ou digite o segredo à mão.</li>
        <li>Digite o código de {TAMANHO_CODIGO} dígitos que o aplicativo mostrar.</li>
      </ol>

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <img
          src={cadastro.qr_code}
          alt="QR code para cadastrar o aplicativo autenticador"
          className="size-40 shrink-0 rounded-lg border bg-white p-2"
        />

        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-muted-foreground text-xs">Sem câmera? Digite este segredo:</span>
          <code className="bg-muted rounded-md px-2.5 py-1.5 font-mono text-xs break-all select-all">
            {agrupar(cadastro.segredo)}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => void copiarSegredo()}
          >
            <Copy />
            Copiar segredo
          </Button>
        </div>
      </div>

      <AuthErrorAlert message={erro} />

      <div className="flex flex-col gap-3">
        <Label htmlFor="codigo-cadastro">Código do aplicativo</Label>

        <InputOTP
          id="codigo-cadastro"
          maxLength={TAMANHO_CODIGO}
          value={codigo}
          onChange={aoMudar}
          disabled={confirmar.isPending}
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

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => ativar(codigo)}
          disabled={codigo.length !== TAMANHO_CODIGO || confirmar.isPending}
        >
          {confirmar.isPending ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
          Ativar
        </Button>

        <Button variant="ghost" onClick={desistir} disabled={confirmar.isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export default CadastroAutenticador;
