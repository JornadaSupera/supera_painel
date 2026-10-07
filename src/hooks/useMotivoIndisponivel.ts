import { useAuth } from "@/contexts/auth-context";
import { motivoIndisponivel } from "@/services/apiClient";

/**
 * Why the backend won't run an operation for whoever is signed in, or `null`.
 *
 * Same answer as `motivoIndisponivel`, plus what the backend refuses to this
 * session's role only — an operation the administrator runs and a professional
 * is still waiting for.
 */
export function useMotivoIndisponivel(operacao: string): string | null {
  const { user } = useAuth();
  return motivoIndisponivel(operacao, user?.papel);
}
