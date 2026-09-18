import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { Loading } from "@/components/shared";
import { AvisoSessao } from "@/features/auth/components/AvisoSessao";
import { carriesRecoveryLink } from "@/features/auth/recovery-link";
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
const UsuarioDetalhePage = lazy(() => import("@/features/usuarios/pages/UsuarioDetalhePage"));
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
/* Not a panel screen: its audience is app users, so it stays out of the bundle
   that panel staff load first. */
const PasswordRecoveryPage = lazy(() => import("@/features/auth/pages/PasswordRecoveryPage"));
const DesignSystemPreview = lazy(() => import("@/app/DesignSystemPreview"));

/**
 * Routes that CONSUME a recovery link. The gate below leaves them alone.
 *
 * Two of them, because they serve two audiences: `/nova-senha` belongs to the
 * panel's staff and its link is issued from here, with a destination we choose;
 * `/redefinir-senha` belongs to patients and caregivers, and its link comes
 * from the app.
 */
const ROUTES_THAT_CONSUME_A_LINK = ["/redefinir-senha", "/nova-senha"];

/**
 * Rescues a recovery link that landed outside a recovery screen.
 *
 * The link does not necessarily arrive where it should: the destination is the
 * `redirect_to` of the e-mail template, and when that address is missing from
 * the project's allow-list Supabase silently falls back to the Site URL, which
 * is the panel's root.
 *
 * And the root redirects to the dashboard. **A redirect discards the query and
 * the fragment**, so the credential was destroyed on the way and the person
 * ended up on a sign-in screen that explained nothing.
 *
 * Here the link is forwarded whole, before any route can lose it — which keeps
 * the flow working whatever the template is set to. It does not excuse leaving
 * the template unconfigured; it stops a configuration mistake from surfacing as
 * an invalid token.
 *
 * It forwards to the PANEL's page. A stray link can no longer say who it was
 * for, and the only flow in this codebase that targets this origin is the
 * panel's own `requestPasswordReset`. The app's link names
 * `/redefinir-senha` explicitly and lands there without passing through here.
 */
function needsRecoveryRescue(location: { pathname: string; search: string; hash: string }) {
  if (ROUTES_THAT_CONSUME_A_LINK.includes(location.pathname)) return false;
  return carriesRecoveryLink(location);
}

export function AppRoutes() {
  const location = useLocation();

  /* Returning here, instead of rendering the redirect beside `<Routes>`.
     `<Navigate>` navigates from an effect, and a rescue rendered as a sibling
     mounts in the same commit as the route that matched the address the link
     arrived at — `/`, which answers with its own `<Navigate to="/dashboard">`.
     Both effects fire, the later one in tree order wins, and that was the
     dashboard: the link reached the sign-in screen anyway, which is the exact
     failure this gate exists to prevent. Leaving early keeps the competing
     route from ever mounting. */
  if (needsRecoveryRescue(location)) {
    return (
      <Navigate
        to={{ pathname: "/nova-senha", search: location.search, hash: location.hash }}
        replace
      />
    );
  }

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

          {/* App accounts (patients and caregivers) land here from the
              recovery e-mail. Outside every guard and layout of the panel:
              the page changes the password and leads nowhere else. */}
          <Route path="/redefinir-senha" element={<PasswordRecoveryPage />} />

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
                <Route path="/usuarios/:id/editar" element={<UsuarioFormPage />} />
              </Route>

              {/* The record is READ, and it belongs with the list.
                  It used to sit under `usuarios:manage`, which the gestor does
                  not hold: they saw the list, clicked a row and were blocked by
                  the guard — a screen that offers a link it will refuse. The
                  form keeps its own route above, so editing stays behind
                  `manage`. */}
              <Route element={<PermissionRoute permission={PERMISSAO.USUARIOS_READ} />}>
                <Route path="/usuarios" element={<UsuariosPage />} />
                <Route path="/usuarios/:id" element={<UsuarioDetalhePage />} />
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
