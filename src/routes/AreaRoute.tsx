import { useEffect, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

import { ErrorState, Loading } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { defaultHomePath, panelAreaOf, type PanelArea } from "./home-path";

/**
 * Keeps each panel for the accounts it was made for.
 *
 * Permissions alone cannot draw this line. A professional holds
 * `pacientes:read`, `relatorios:read` and `conteudo:read` for their own work,
 * and with only `PermissionRoute` in the way those opened the administration's
 * patient base, reports and editorial queue. An administrator, in turn, opened
 * every clinical area with the professional's actions in hand.
 *
 * Wraps the panel's layout rather than sitting above it, so the frame of the
 * wrong panel never mounts — not even for the frame it takes to redirect.
 *
 * Someone in the wrong panel is sent to their own home — the same place
 * sign-in picks for them — and told so. A redirect with no word reads as a link
 * that broke or a screen that vanished. An account with no panel at all gets
 * "forbidden": redirecting it would only bounce between the two.
 */
const AVISO_DE_OUTRO_PAINEL: Record<PanelArea, string> = {
  admin: "Esse endereço é do painel administrativo, que não faz parte do seu acesso.",
  clinico: "Esse endereço é do painel clínico. Você está no painel administrativo.",
};

function RedirecionarAvisando({ to, aviso }: { to: string; aviso: string }) {
  // O mesmo `id` impede o aviso duplicado quando o efeito roda duas vezes.
  useEffect(() => {
    toast.info(aviso, { id: "outro-painel" });
  }, [aviso]);

  return <Navigate to={to} replace />;
}

export function AreaRoute({ area, children }: { area: PanelArea; children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Loading message="Verificando acesso…" />;

  const own = panelAreaOf(user);
  if (own === area) return children;
  if (own === null) return <ErrorState variant="forbidden" />;

  return <RedirecionarAvisando to={defaultHomePath(user)} aviso={AVISO_DE_OUTRO_PAINEL[area]} />;
}

export default AreaRoute;
