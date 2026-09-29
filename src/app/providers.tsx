import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ERROR_CODE, type ErrorCode } from "@/services/contracts";

/**
 * Provedores globais do painel.
 *
 * Ordem importa: o roteador envolve o `AuthProvider` porque as telas de
 * autenticação navegam, e os guardas de rota precisam do contexto de sessão.
 *
 * O tema não é provider: vive no store Zustand (`@/stores/theme`), que aplica a
 * classe `dark` direto no `<html>` — sem rerenderizar a árvore inteira.
 */

/** Códigos em que repetir a mesma requisição nunca muda o resultado. */
const NAO_RETENTAVEL: ErrorCode[] = [
  ERROR_CODE.UNAUTHORIZED,
  ERROR_CODE.FORBIDDEN,
  ERROR_CODE.NOT_FOUND,
  ERROR_CODE.VALIDATION,
  ERROR_CODE.NOT_IMPLEMENTED,
];

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Painel administrativo: dado desatualizado engana decisão.
        // 30 s evita refazer requisição a cada troca de aba.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        // The default ("online") pauses a query while the browser reports no
        // network. A paused first load is neither loading nor failed, and every
        // screen read that as an empty list: "0 patients", "no appointments".
        // Always fetching lets the failure reach the error state and its retry.
        networkMode: "always",
        retry: (failureCount, error) => {
          const codigo = (error as { code?: ErrorCode }).code;
          if (codigo && NAO_RETENTAVEL.includes(codigo)) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        // Escrita nunca é repetida sozinha: pode duplicar registro clínico,
        // convite por SMS ou log de auditoria.
        retry: false,
        // Same reason: a paused write left its button spinning with no
        // message. Failing lets the screen say the change did not go through.
        networkMode: "always",
      },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  // useState garante um único client por montagem do app.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider delayDuration={300}>
            {children}
            {/* Offset below the 60px top bar: at the default 24px the toast sat
                over the user menu, the one control someone may reach for
                right after an action. */}
            <Toaster position="top-right" offset={{ top: 72 }} richColors closeButton />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default AppProviders;
