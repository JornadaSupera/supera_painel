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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CONDUTA_ALERTA, CONDUTA_ALERTA_LABEL, type CondutaAlerta } from "@/lib/enums";
import type { AlertaClinico } from "@/types/clinico";

/**
 * Confirmação da conduta ao resolver um alerta.
 *
 * A conduta é obrigatória — "resolvido" sem dizer o que foi feito não serve
 * para ninguém que reveja o caso depois. A observação é livre, para o
 * contexto que nenhuma das três categorias cobre sozinha.
 */

export interface DialogResolverAlertaProps {
  alerta: AlertaClinico | null;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  onConfirmar: (params: { conduta: CondutaAlerta; notas: string }) => void;
  enviando?: boolean;
}

const OPCOES: CondutaAlerta[] = [
  CONDUTA_ALERTA.ORIENTACAO,
  CONDUTA_ALERTA.AGENDAMENTO,
  CONDUTA_ALERTA.ENCAMINHAMENTO,
];

export function DialogResolverAlerta({
  alerta,
  aberto,
  onOpenChange,
  onConfirmar,
  enviando,
}: DialogResolverAlertaProps) {
  const [conduta, setConduta] = useState<CondutaAlerta | "">("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (aberto) {
      setConduta("");
      setNotas("");
    }
  }, [aberto, alerta?.id]);

  if (!alerta) return null;

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolver alerta · {alerta.paciente_nome}</DialogTitle>
          <DialogDescription>
            {alerta.sintoma_label} — grau {alerta.grau}. Registre a conduta tomada antes de fechar o
            alerta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conduta-alerta">
              Conduta <span className="text-destructive">*</span>
            </Label>
            <Select value={conduta} onValueChange={(valor) => setConduta(valor as CondutaAlerta)}>
              <SelectTrigger id="conduta-alerta" className="w-full">
                <SelectValue placeholder="Selecione a conduta" />
              </SelectTrigger>
              <SelectContent>
                {OPCOES.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {CONDUTA_ALERTA_LABEL[opcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notas-alerta">
              Observações <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="notas-alerta"
              rows={3}
              value={notas}
              onChange={(evento) => setNotas(evento.target.value)}
              placeholder="O que foi orientado, agendado ou para onde foi encaminhado."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            disabled={enviando || !conduta}
            onClick={() => conduta && onConfirmar({ conduta, notas: notas.trim() })}
          >
            {enviando ? "Registrando…" : "Resolver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DialogResolverAlerta;
