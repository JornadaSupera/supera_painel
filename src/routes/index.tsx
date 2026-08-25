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
 * Árvore de rotas — as 9 telas do escopo MVP + Médio.
 *
 * Cada área protegida passa por dois portões: `ProtectedRoute` exige sessão,
 * `PermissionRoute` exige a permissão do módulo. Manter os dois separados
 * deixa clara, na leitura, a diferença entre "não está logada" e "está logada
 * mas não pode".
 *
 * Ver `src/layouts/navegacao.ts` — a sidebar sai da mesma lista de permissões,
 * para que menu e rota nunca discordem.
 */

/* Cada módulo em seu próprio chunk: o painel carrega só a tela aberta.
   As telas de autenticação ficam no bundle principal — são o primeiro
   destino de quem chega, e um carregamento extra ali é atrito visível. */
const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage"));
const PacientesPage = lazy(() => import("@/features/pacientes/pages/PacientesPage"));
const UsuariosPage = lazy(() => import("@/features/usuarios/pages/UsuariosPage"));
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
          {/* ------------------------------------------------------ público */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/mfa" element={<MfaPage />} />
          <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
          <Route path="/nova-senha" element={<NovaSenhaPage />} />

          {/* ---------------------------------------------------- protegido */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route element={<PermissionRoute permissao={PERMISSAO.DASHBOARD_READ} />}>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>

              <Route element={<PermissionRoute permissao={PERMISSAO.PACIENTES_READ} />}>
                <Route path="/pacientes" element={<PacientesPage />} />
              </Route>

              <Route element={<PermissionRoute permissao={PERMISSAO.USUARIOS_READ} />}>
                <Route path="/usuarios" element={<UsuariosPage />} />
              </Route>

              <Route element={<PermissionRoute permissao={PERMISSAO.CONTEUDO_READ} />}>
                <Route path="/conteudo" element={<ConteudoPage />} />
              </Route>

              <Route element={<PermissionRoute permissao={PERMISSAO.RELATORIOS_READ} />}>
                <Route path="/relatorios" element={<RelatoriosPage />} />
              </Route>

              <Route
                element={<PermissionRoute permissao={PERMISSAO.ESTATISTICAS_CLINICAS_READ} />}
              >
                <Route path="/estatisticas/clinicas" element={<EstatisticasClinicasPage />} />
              </Route>

              <Route
                element={
                  <PermissionRoute
                    alguma={[PERMISSAO.ESTATISTICAS_READ_ALL, PERMISSAO.ESTATISTICAS_READ_SELF]}
                  />
                }
              >
                <Route
                  path="/estatisticas/operacionais"
                  element={<EstatisticasOperacionaisPage />}
                />
              </Route>

              <Route element={<PermissionRoute permissao={PERMISSAO.AUDITORIA_READ} />}>
                <Route path="/auditoria" element={<AuditoriaPage />} />
              </Route>

              <Route element={<PermissionRoute permissao={PERMISSAO.CONFIGURACOES_READ} />}>
                <Route path="/configuracoes" element={<ConfiguracoesPage />} />
              </Route>

              {/* Galeria de componentes — ferramenta interna. */}
              {import.meta.env.DEV && (
                <Route path="/design-system" element={<DesignSystemPreview />} />
              )}

              {/* "Estatísticas" sozinho não é tela: leva ao primeiro filho. */}
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
