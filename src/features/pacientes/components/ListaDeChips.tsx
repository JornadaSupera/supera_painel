import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Lista de termos curtos — alergias, no cadastro do paciente.
 *
 * Texto livre porque não existe catálogo fechado de alergia que dê conta da
 * realidade da clínica; obrigar a escolher de uma lista faria a enfermagem
 * anotar no campo de observações, que é onde a informação se perde.
 *
 * Enter adiciona. É o gesto que a pessoa já tenta.
 */
export interface ListaDeChipsProps {
  valores: string[];
  onChange: (valores: string[]) => void;
  placeholder?: string;
  /** Nome acessível do campo de entrada. */
  label: string;
  className?: string;
}

export function ListaDeChips({
  valores,
  onChange,
  placeholder,
  label,
  className,
}: ListaDeChipsProps) {
  const [rascunho, setRascunho] = useState("");

  const adicionar = () => {
    const termo = rascunho.trim();
    if (!termo) return;

    // Comparação sem caixa: "Dipirona" e "dipirona" são a mesma alergia, e
    // duas linhas iguais na ficha só atrapalham quem lê com pressa.
    const jaExiste = valores.some((valor) => valor.toLowerCase() === termo.toLowerCase());
    if (!jaExiste) onChange([...valores, termo]);

    setRascunho("");
  };

  const remover = (termo: string) => onChange(valores.filter((valor) => valor !== termo));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <Input
          value={rascunho}
          onChange={(evento) => setRascunho(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key !== "Enter") return;
            // Sem isto, Enter envia o formulário inteiro em vez de adicionar.
            evento.preventDefault();
            adicionar();
          }}
          placeholder={placeholder}
          aria-label={label}
          maxLength={60}
        />

        <Button type="button" variant="outline" size="icon" onClick={adicionar} aria-label="Adicionar">
          <Plus />
        </Button>
      </div>

      {valores.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {valores.map((valor) => (
            <li key={valor}>
              <span className="bg-muted text-foreground inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs">
                {valor}
                <button
                  type="button"
                  onClick={() => remover(valor)}
                  aria-label={`Remover ${valor}`}
                  className="text-muted-foreground hover:bg-background hover:text-foreground flex size-4 items-center justify-center rounded-full transition-colors"
                >
                  <X size={11} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Seleção múltipla a partir de um catálogo fechado — as reações prévias vêm dos
 * 12 sintomas que o Diário do app registra.
 *
 * Catálogo fechado aqui porque o mesmo termo precisa cruzar com o dado do app
 * na Fase 12: "náusea" digitada à mão nunca casaria com "Náusea" do Diário.
 */
export function SelecaoDeCatalogo({
  opcoes,
  selecionadas,
  onChange,
  legenda,
}: {
  opcoes: { id: string; nome: string }[];
  selecionadas: string[];
  onChange: (valores: string[]) => void;
  legenda: string;
}) {
  const alternar = (nome: string) =>
    onChange(
      selecionadas.includes(nome)
        ? selecionadas.filter((valor) => valor !== nome)
        : [...selecionadas, nome],
    );

  return (
    <fieldset className="flex flex-wrap gap-1.5">
      <legend className="sr-only">{legenda}</legend>

      {opcoes.map((opcao) => {
        const ativa = selecionadas.includes(opcao.nome);

        return (
          <button
            key={opcao.id}
            type="button"
            onClick={() => alternar(opcao.nome)}
            aria-pressed={ativa}
            className={cn(
              "focus-visible:ring-ring/50 rounded-full border px-2.5 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
              ativa
                ? "border-primary/30 bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted border-border",
            )}
          >
            {opcao.nome}
          </button>
        );
      })}
    </fieldset>
  );
}
