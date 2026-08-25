import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";

/**
 * Aviso de sessão prestes a expirar.
 *
 * Um painel de dados de saúde precisa encerrar sessão ociosa — mas derrubar
 * alguém no meio de um cadastro, sem avisar, faz perder trabalho. O aviso dá a
 * chance de continuar com um clique.
 *
 * Montado uma vez, dentro da área autenticada.
 */
export function AvisoSessao() {
  const { expirandoEmBreve, segundosParaExpirar, renovarAtividade, autenticado } = useAuth();

  /** Evita reemitir o mesmo aviso a cada tick do relógio. */
  const avisoAtivo = useRef<string | number | null>(null);

  useEffect(() => {
    if (!autenticado) {
      avisoAtivo.current = null;
      return;
    }

    if (!expirandoEmBreve) {
      // Voltou a ter tempo: o aviso perdeu a razão de existir.
      if (avisoAtivo.current !== null) {
        toast.dismiss(avisoAtivo.current);
        avisoAtivo.current = null;
      }
      return;
    }

    if (avisoAtivo.current !== null) return;

    const minutos = Math.max(1, Math.ceil((segundosParaExpirar ?? 0) / 60));

    avisoAtivo.current = toast.warning("Sua sessão está prestes a expirar", {
      description: `Por inatividade, o acesso será encerrado em cerca de ${minutos} ${
        minutos === 1 ? "minuto" : "minutos"
      }.`,
      duration: Infinity,
      action: {
        label: "Continuar conectada",
        onClick: () => {
          renovarAtividade();
          avisoAtivo.current = null;
        },
      },
    });
  }, [autenticado, expirandoEmBreve, segundosParaExpirar, renovarAtividade]);

  return null;
}

export default AvisoSessao;
