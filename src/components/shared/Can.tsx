import type { ReactNode } from "react";

import { useAuth } from "@/contexts/auth-context";
import type { Permissao } from "@/lib/rbac";

/**
 * Guarda de interface.
 *
 *   <Can permissao={PERMISSAO.PACIENTES_WRITE}>
 *     <Button>Novo paciente</Button>
 *   </Can>
 *
 * > [!] Esconder não é proteger.
 * Este componente evita que a pessoa veja uma ação que não pode executar — o
 * que reduz erro honesto e ruído na tela. Ele **não** impede quem abre o
 * DevTools. Toda ação protegida por `<Can>` precisa também de rota guardada
 * (`PermissionRoute`) e, na Fase 15, de política RLS no Postgres.
 *
 * @param permissao  uma ou várias — todas exigidas (E lógico)
 * @param alguma     lista alternativa — basta uma (OU lógico)
 * @param fallback   o que renderizar quando não há permissão
 */
export interface CanProps {
  permissao?: Permissao | readonly Permissao[];
  alguma?: readonly Permissao[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ permissao, alguma, fallback = null, children }: CanProps) {
  const { pode, podeAlguma } = useAuth();

  const autorizado = alguma ? podeAlguma(alguma) : permissao ? pode(permissao) : true;

  return <>{autorizado ? children : fallback}</>;
}

export default Can;
