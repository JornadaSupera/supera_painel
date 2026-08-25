import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import { formatCpf, formatPhone } from "@/lib/mask";
import { PERMISSAO } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { CampoPii } from "@/types/paciente";
import { useRevelarPii } from "../hooks/usePacientes";

/**
 * Dado pessoal de paciente: mascarado por padrão, revelado sob ação explícita.
 *
 * O valor completo não está na tela esperando um clique — ele nem foi enviado
 * ao navegador. Clicar dispara `pacientes.revealPii`, que é a operação
 * auditada. É a diferença entre esconder e proteger.
 *
 * Quem não tem `pacientes:reveal_pii` não vê o botão e recebe o motivo no
 * tooltip: interface que some sem explicação vira chamado no suporte.
 */

const FORMATADOR: Record<CampoPii, (valor: string) => string> = {
  cpf: formatCpf,
  telefone: formatPhone,
  email: (valor) => valor,
};

const ROTULO: Record<CampoPii, string> = {
  cpf: "CPF",
  telefone: "telefone",
  email: "e-mail",
};

export interface CampoSensivelProps {
  pacienteId: string;
  campo: CampoPii;
  /** Valor já mascarado, como veio da camada de dados. */
  mascarado: string;
  /** Nome do paciente — entra no rótulo acessível do botão. */
  nomePaciente?: string;
  className?: string;
}

export function CampoSensivel({
  pacienteId,
  campo,
  mascarado,
  nomePaciente,
  className,
}: CampoSensivelProps) {
  const { can } = useAuth();
  const [revelado, setRevelado] = useState<string | null>(null);
  const revelar = useRevelarPii(pacienteId);

  const autorizado = can(PERMISSAO.PACIENTES_REVEAL_PII);
  const visivel = revelado !== null;

  const alternar = () => {
    if (visivel) {
      setRevelado(null);
      return;
    }

    revelar.mutate([campo], {
      onSuccess: (dados) => {
        const valor = dados[campo];
        if (valor) setRevelado(FORMATADOR[campo](valor));
      },
    });
  };

  const alvo = nomePaciente ? ` de ${nomePaciente}` : "";
  const Icone = revelar.isPending ? LoaderCircle : visivel ? EyeOff : Eye;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={cn("tabular-nums", visivel && "text-foreground font-medium")}>
        {revelado ?? mascarado}
      </span>

      {autorizado ? (
        <Tooltip>
          <TooltipTrigger
            type="button"
            onClick={alternar}
            disabled={revelar.isPending}
            aria-label={`${visivel ? "Ocultar" : "Revelar"} ${ROTULO[campo]}${alvo}`}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-5 shrink-0 items-center justify-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <Icone size={13} aria-hidden="true" className={cn(revelar.isPending && "animate-spin")} />
          </TooltipTrigger>

          <TooltipContent>
            {visivel ? "Ocultar" : `Revelar ${ROTULO[campo]}`} · registra auditoria
          </TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="text-muted-foreground/60 inline-flex size-5 shrink-0 items-center justify-center rounded-sm"
            >
              <EyeOff size={13} aria-hidden="true" />
              <span className="sr-only">Sem permissão para revelar o {ROTULO[campo]}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>Seu perfil não pode revelar dados pessoais completos.</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

export default CampoSensivel;
