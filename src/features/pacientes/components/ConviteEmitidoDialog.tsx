import { Check, Copy, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import type { ResultadoConvite } from "@/types/paciente";

/**
 * O código de ativação, mostrado uma única vez.
 *
 * Diálogo e não notificação: a notificação some sozinha, e este código não tem
 * segunda via — o backend guarda só o hash dele. Quem fechar a tela sem anotar
 * precisa emitir outro convite, o que invalida este.
 *
 * > [!] Por que o código aparece no painel
 * Não há provedor de envio contratado ainda. Até haver, quem está na recepção
 * lê o código para o paciente digitar no aplicativo — é o que mantém a ativação
 * testável em vez de bloqueada por uma credencial de terceiro. Quando o envio
 * automático existir, este diálogo deixa de exibir o código e passa a confirmar
 * o disparo.
 *
 * O código sozinho não abre a ficha de ninguém: o aceite exige também CPF e
 * data de nascimento do titular.
 */
export interface ConviteEmitidoDialogProps {
  convite: ResultadoConvite | null;
  onClose: () => void;
}

export function ConviteEmitidoDialog({ convite, onClose }: ConviteEmitidoDialogProps) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    if (!convite?.token) return;

    try {
      await navigator.clipboard.writeText(convite.token);
      setCopiado(true);
      // Volta ao estado normal: o "copiado" é confirmação do gesto, não um
      // estado permanente do botão.
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Área de transferência bloqueada pelo navegador. O código continua na
      // tela, selecionável — que é o caminho que sempre funciona.
      setCopiado(false);
    }
  };

  return (
    <Dialog
      open={convite !== null}
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convite emitido</DialogTitle>
          <DialogDescription>
            {convite?.destino
              ? `Registrado para ${convite.destino}.`
              : "Registrado na ficha do paciente."}
          </DialogDescription>
        </DialogHeader>

        {convite?.token ? (
          <div className="flex flex-col gap-3">
            <div className="border-border bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                Código de ativação
              </p>

              <div className="flex items-start gap-2">
                <code className="text-foreground min-w-0 flex-1 font-mono text-xs break-all">
                  {convite.token}
                </code>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void copiar()}
                  aria-label="Copiar código de ativação"
                >
                  {copiado ? <Check /> : <Copy />}
                </Button>
              </div>
            </div>

            <p className="text-muted-foreground flex gap-2 text-xs">
              <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                <span className="text-foreground font-medium">
                  Este código não aparece de novo.
                </span>{" "}
                Anote ou copie agora. Emitir um novo convite invalida este.
                {convite.expira_em ? ` Válido até ${formatDateTime(convite.expira_em)}.` : ""}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            O convite foi registrado. Esta origem de dados não devolve o código de ativação.
          </p>
        )}

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Já anotei
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConviteEmitidoDialog;
