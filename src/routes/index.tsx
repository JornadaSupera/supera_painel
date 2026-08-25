import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { Loading } from "@/components/shared";
import { AvisoSessao } from "@/features/auth/components/AvisoSessao";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { MfaPage } from "@/features/auth/pages/MfaPage";
import { NovaSenhaPage } from "@/features/auth/pages/NovaSenhaPage";
import { RecuperarSenhaPage } from "@/features/auth/pages/RecuperarSenhaPage";
import { AdminLayout } from "@/layouts/AdminLayout";
import { PERMISSAO } from "@/lib/rbac";
import { PermissionRoute } from "./PermissionRoute";
import { ProtectedRoute } from "./ProtectedRoute";

/**
 * Route tree — the nine screens of the MVP + Médio scope.
 *
 * Every protected area passes through two gates: `ProtectedRoute` requires a
 * session, `PermissionRoute` requires the module permission. Keeping them apart
 * makes the difference between "not signed in" and "signed in but not allowed"
 * legible at a glance.
 *
 * See `src/layouts/navigation.ts` — the sidebar reads the same permission list,
 * so menu and route never disagree.
 */

/* One chunk per module: the panel loads only the screen being opened.
   The authentication screens stay in the main bundle — they are the first
   destination for anyone arriving, and an extra load there is visible
   friction. */
const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage"));
const PacientesPage = lazy(() => import("@/features/pacientes/pages/PacientesPage"));
const PacienteNovoPage = lazy(() => import("@/features/pacientes/pages/PacienteNovoPage"));
const PacienteFichaPage = lazy(() => import("@/features/pacientes/pages/PacienteFichaPage"));
const UsuariosPage = lazy(() => import("@/features/usuarios/pages/UsuariosPage"));
const UsuarioFormPage = lazy(() => import("@/features/usuarios/pages/UsuarioFormPage"));
const ConteudoPage = lazy(() => import("@/features/conteudo/pages/ConteudoPage"));
const RelatoriosPage = lazy(() => import("@/features/relatorios/pages/RelatoriosPage"));
const EstatisticasClinicasPage = lazy(
  () => import("@/features/estatisticas/pages/EstatisticasClinicasPage"),
);
const EstatisticasOperacionaisPage = lazy(
  () => import("@/features/estatisticas/pages/EstatisticasOperacionaisPage"),
);
const AuditoriaPage = lazy(() => import("@/features/auditoria/pages/AuditoriaPage"));
const ConfiguracoesPage = lazy(() => import("@/features/configuracoes/pages/ConfiguracoesPage"));
const DesignSystemPreview = lazy(() => import("@/app/DesignSystemPreview"));

export function AppRoutes() {
  return (
    <>
      <AvisoSessao />

      <Suspense fallback={<Loading />}>
        <Routes>
          {/* ------------------------------------------------------- public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/mfa" element={<MfaPage />} />
          <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
          <Route path="/nova-senha" element={<NovaSenhaPage />} />

          {/* ---------------------------------------------------- protected */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route element={<PermissionRoute permission={PERMISSAO.DASHBOARD_READ} />}>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>

              {/* Creating requires write access, not read — hence its own
                  group. The Router picks the most specific route, so
                  "/pacientes/novo" beats "/pacientes/:id" regardless of the
                  order the two appear in. */}
              <Route element={<PermissionRoute permission={PERMISSAO.PACIENTES_WRITE} />}>
                <Route path="/pacientes/novo" element={<PacienteNovoPage />} />
              </Route>

              <Route element={<PermissionRoute permission={PERMISSAO.PACIENTES_READ} />}>
                <Route path="/pacientes" element={<PacientesPage />} />
                <Route path="/pacientes/:id" element={<PacienteFichaPage />} />
              </Route>

              {/* Creating and editing a professional is access management: it
                  requires `usuarios:manage`, not the list read. */}
              <Route element={<PermissionRoute permission={PERMISSAO.USUARIOS_MANAGE} />}>
                <Route path="/usuarios/novo" element={<UsuarioFormPage />} />
                <Route path="/usuarios/:id" element={<UsuarioFormPage />} />
              </Route>

              <Route element={<PermissionRoute permission={PERMISSAO.USUARIOS_READ} />}>
                <Route path="/usuarios" element={<UsuariosPage />} />
              </Route>

              <Route element={<PermissionRoute permission={PERMISSAO.CONTEUDO_READ} />}>
                <Route path="/conteudo" element={<ConteudoPage />} />
              </Route>

              <Route element={<PermissionRoute permission={PERMISSAO.RELATORIOS_READ} />}>
                <Route path="/relatorios" element={<RelatoriosPage />} />
              </Route>

              <Route
                element={<PermissionRoute permission={PERMISSAO.ESTATISTICAS_CLINICAS_READ} />}
              >
                <Route path="/estatisticas/clinicas" element={<EstatisticasClinicasPage />} />
              </Route>

              <Route
                element={
                  <PermissionRoute
                    anyOf={[PERMISSAO.ESTATISTICAS_READ_ALL, PERMISSAO.ESTATISTICAS_READ_SELF]}
                  />
                }
              >
                <Route
                  path="/estatisticas/operacionais"
                  element={<EstatisticasOperacionaisPage />}
                />
              </Route>

              <Route element={<PermissionRoute permission={PERMISSAO.AUDITORIA_READ} />}>
                <Route path="/auditoria" element={<AuditoriaPage />} />
              </Route>

              <Route element={<PermissionRoute permission={PERMISSAO.CONFIGURACOES_READ} />}>
                <Route path="/configuracoes" element={<ConfiguracoesPage />} />
              </Route>

              {/* Component gallery — internal tool. */}
              {import.meta.env.DEV && (
                <Route path="/design-system" element={<DesignSystemPreview />} />
              )}

              {/* "Estatísticas" alone is not a screen: it leads to the first child. */}
              <Route
                path="/estatisticas"
                element={<Navigate to="/estatisticas/clinicas" replace />}
              />
            </Route>
          </Route>

          {/* ------------------------------------------------------ default */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default AppRoutes;
