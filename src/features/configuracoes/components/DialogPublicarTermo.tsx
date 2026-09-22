import { useEffect, useState } from "react";

import { TriangleAlert } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import type { VersaoLegal } from "@/types/configuracao";
import { usePublicarTermo } from "../hooks/useConfiguracoes";

/**
 * Publicar uma versão nova de termo de uso ou de política de privacidade.
 *
 * > [!] Não é editar o texto vigente — é publicar outro.
 * O aceite é versionado por desenho: quem aceitou a v1 não aceitou a v2.
 * Alterar o texto da versão em vigor apagaria a prova do que a pessoa aceitou,
 * então o caminho é sempre uma versão nova, com data, e a anterior vira
 * histórico.
 *
 * O campo abre com o texto em vigor quando existe um, porque a correção de uma
 * frase é o caso comum. Na primeira publicação ele abre vazio: não há de onde
 * copiar, e alguém precisa decidir qual é o texto de registro.
 */

export interface DialogPublicarTermoProps {
  tipo: VersaoLegal["tipo"];
  tipoLabel: string;
  /** A versão em vigor desta espécie, quando há uma. */
  vigente: VersaoLegal | null;
  aberto: boolean;
  onFechar: () => void;
}

/** Quantos caracteres separam "colou o documento" de "colou um parágrafo". */
const MINIMO_PLAUSIVEL = 200;

export function DialogPublicarTermo({
  tipo,
  tipoLabel,
  vigente,
  aberto,
  onFechar,
}: DialogPublicarTermoProps) {
  const publicar = usePublicarTermo();
  const [corpo, setCorpo] = useState("");

  /**
   * O campo recomeça do texto em vigor a cada abertura.
   *
   * Reabrir depois de fechar sem publicar não traz de volta o rascunho
   * descartado — e um rascunho de documento legal não sobrevive à aba, porque
   * `localStorage` está fora de questão para conteúdo que vira aceite.
   */
  useEffect(() => {
    if (aberto) setCorpo(vigente?.corpo ?? "");
  }, [aberto, vigente?.corpo]);

  const proximaVersao = (vigente?.versao ?? 0) + 1;
  const texto = corpo.trim();
  const curtoDemais = texto !== "" && texto.length < MINIMO_PLAUSIVEL;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        if (!estado) onFechar();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Publicar {tipoLabel.toLowerCase()} · versão {proximaVersao}
          </DialogTitle>
          <DialogDescription>
            {vigente
              ? `A versão ${vigente.versao} vira histórico no mesmo ato. O texto dela vem preenchido abaixo para ser corrigido.`
              : "Não há versão publicada desta espécie. Esta será a primeira, e é ela que o aplicativo passa a exibir no aceite."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="corpo-do-documento" className="text-xs">
            Texto do documento
          </Label>

          <Textarea
            id="corpo-do-documento"
            className="min-h-64 font-mono text-xs leading-relaxed"
            value={corpo}
            placeholder="Cole aqui o texto revisado do documento."
            onChange={(evento) => setCorpo(evento.target.value)}
            aria-describedby="corpo-ajuda"
          />

          <p id="corpo-ajuda" className="text-muted-foreground text-[11px] leading-relaxed">
            {curtoDemais
              ? "O texto está curto para um documento inteiro. Confira se não colou apenas um trecho — é ele que passa a valer juridicamente."
              : "Texto puro. Parágrafos separados por linha em branco; o aplicativo cuida da formatação."}
          </p>
        </div>

        {/* A consequência não cabe em letra miúda: publicar derruba o aceite de
            toda a base de pacientes, e quem clica precisa saber disso antes. */}
        <div className="border-warning/30 bg-warning-bg text-warning-foreground flex gap-3 rounded-xl border p-3">
          <TriangleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
          <p className="text-[11px] leading-relaxed">
            Publicar exige <strong>novo aceite de todos os pacientes</strong>: quem aceitou a versão
            anterior não aceitou esta, e o aplicativo volta a pedir a concordância antes de liberar o
            uso. Não há como desfazer — corrigir depois significa publicar mais uma versão.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={publicar.isPending}>
            Cancelar
          </Button>

          <Button
            disabled={texto === "" || publicar.isPending}
            onClick={() =>
              publicar.mutate({ tipo, corpo: texto }, { onSuccess: () => onFechar() })
            }
          >
            {publicar.isPending ? "Publicando…" : `Publicar versão ${proximaVersao}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DialogPublicarTermo;
