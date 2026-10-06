import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";

import { Loading } from "@/components/shared";
import { AvisoSessao } from "@/features/auth/components/AvisoSessao";
import { carriesRecoveryLink, recoveryLinkPurpose } from "@/features/auth/recovery-link";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { MfaPage } from "@/features/auth/pages/MfaPage";
import { NovaSenhaPage } from "@/features/auth/pages/NovaSenhaPage";
import { RecuperarSenhaPage } from "@/features/auth/pages/RecuperarSenhaPage";
import { PatientChatShortcut } from "@/features/clinico/components/PatientChatShortcut";
import { PatientRecordPanel } from "@/features/clinico/components/PatientRecordPanel";
import { AdminLayout } from "@/layouts/AdminLayout";
import { ClinicoLayout } from "@/layouts/ClinicoLayout";
import { ESPECIALIDADE_LABEL, type Especialidade } from "@/lib/enums";
import { PERMISSAO } from "@/lib/rbac";
import { AreaRoute } from "./AreaRoute";
import { HomeRedirect } from "./HomeRedirect";
import { NotFoundRoute } from "./NotFoundRoute";
import { PermissionRoute } from "./PermissionRoute";
import { ProtectedRoute } from "./ProtectedRoute";

/**
 * Route tree — the nine screens of the MVP + Médio scope.
 *
 * Every protected screen passes through three gates: `ProtectedRoute` requires
 * a session, `AreaRoute` requires the panel to be the account's own (the
 * administration or a clinical area, never both), and `PermissionRoute`
 * requires the module permission. Keeping them apart makes "not signed in",
 * "wrong panel" and "signed in but not allowed" legible at a glance.
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
const SatisfacaoPage = lazy(() => import("@/features/satisfaction/pages/SatisfacaoPage"));
const EstatisticasClinicasPage = lazy(
  () => import("@/features/estatisticas/pages/EstatisticasClinicasPage"),
);
const EstatisticasOperacionaisPage = lazy(
  () => import("@/features/estatisticas/pages/EstatisticasOperacionaisPage"),
);
const AuditoriaPage = lazy(() => import("@/features/auditoria/pages/AuditoriaPage"));
const ConfiguracoesPage = lazy(() => import("@/features/configuracoes/pages/ConfiguracoesPage"));
/* The account's own security screen, shared by both panels. */
const SegurancaContaPage = lazy(() => import("@/features/auth/pages/SegurancaContaPage"));

/* Painel clínico — fundação (PA-07). Um chunk por módulo, mesmo critério. */
const ClinicoDashboardPage = lazy(() => import("@/features/clinico/pages/ClinicoDashboardPage"));
const ClinicoPacientesPage = lazy(() => import("@/features/clinico/pages/ClinicoPacientesPage"));
const ClinicoAgendaPage = lazy(() => import("@/features/clinico/pages/ClinicoAgendaPage"));
const ClinicoChatPage = lazy(() => import("@/features/clinico/pages/ClinicoChatPage"));
const ClinicoAlertasPage = lazy(() => import("@/features/clinico/pages/ClinicoAlertasPage"));
const ClinicoCarteiraPage = lazy(() => import("@/features/clinico/pages/ClinicoCarteiraPage"));
const ClinicoConteudoPage = lazy(() => import("@/features/clinico/pages/ClinicoConteudoPage"));
const ClinicoOrientacaoPage = lazy(() => import("@/features/clinico/pages/ClinicoOrientacaoPage"));
const ClinicoPerfilPage = lazy(() => import("@/features/clinico/pages/ClinicoPerfilPage"));
/* Not a panel screen: its audience is app users, so it stays out of the bundle
   that panel staff load first. */
const PasswordRecoveryPage = lazy(() => import("@/features/auth/pages/PasswordRecoveryPage"));
/* Public legal documents. Same reasoning: their readers are app users, store
   reviewers and anyone following a link, not the panel's staff. */
const TermsOfUsePage = lazy(() => import("@/features/legal/pages/TermsOfUsePage"));
const PrivacyPolicyPage = lazy(() => import("@/features/legal/pages/PrivacyPolicyPage"));

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
 * A stray recovery link goes to the APP's page. The panel's own
 * `requestPasswordReset` names `/nova-senha` and lands there without passing
 * through here; the app asks for its e-mail without a destination, so its
 * links are the ones that arrive at the root. Sending a patient to the staff
 * page told them to sign in to a panel they have no access to.
 *
 * A staff invitation is the exception: it says `type=invite`, and choosing the
 * first password is the panel's screen.
 */
function needsRecoveryRescue(location: { pathname: string; search: string; hash: string }) {
  if (ROUTES_THAT_CONSUME_A_LINK.includes(location.pathname)) return false;
  return carriesRecoveryLink(location);
}

function rescueDestination(location: { search: string; hash: string }) {
  return recoveryLinkPurpose(location) === "invite" ? "/nova-senha" : "/redefinir-senha";
}

/**
 * The patient record, inside the clinical frame.
 *
 * Same page the administrative panel uses; the way back and the label above the
 * title change, so a professional never lands in the other panel's navigation by
 * opening a patient. It adds what only a professional needs: the shortcut to the
 * patient's chat and the multidisciplinary timeline, where they write in their
 * own area. Composed here because a feature does not import another feature.
 */
function ClinicoPacienteFicha() {
  const { especialidade, id } = useParams<{ especialidade: string; id: string }>();
  const area = especialidade as Especialidade;
  const base = `/clinico/${area}`;
  const chatHref = `${base}/chat?paciente=${id ?? ""}`;

  return (
    <PacienteFichaPage
      basePath={`${base}/pacientes`}
      eyebrow={ESPECIALIDADE_LABEL[area]}
      extraActions={<PatientChatShortcut href={chatHref} />}
    >
      {id && <PatientRecordPanel patientId={id} area={area} chatHref={chatHref} />}
    </PacienteFichaPage>
  );
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
        to={{
          pathname: rescueDestination(location),
          search: location.search,
          hash: location.hash,
        }}
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

          {/* Terms of use and privacy policy — the addresses the app, the
              stores and the sign-in footer link to. Outside every guard: a
              document someone must accept is readable before any account. */}
          <Route path="/termos" element={<TermsOfUsePage />} />
          <Route path="/privacidade" element={<PrivacyPolicyPage />} />
          <Route path="/termos-de-uso" element={<Navigate to="/termos" replace />} />
          <Route path="/politica-de-privacidade" element={<Navigate to="/privacidade" replace />} />

          {/* ---------------------------------------------------- protected */}
          <Route element={<ProtectedRoute />}>
            <Route
              element={
                <AreaRoute area="admin">
                  <AdminLayout />
                </AreaRoute>
              }
            >
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
                  It used to sit under `usuarios:manage`, which a person with
                  only `usuarios:read` (an individual grant, not a role) does
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
                {/* A MESMA tela, e não uma rota de detalhe: o relatório abre
                    numa janela sobre a lista. O que a rota acrescenta é o
                    endereço — é o "link interno" do escopo, que transforma um
                    resultado em algo que se manda para alguém. */}
                <Route path="/relatorios/:slug" element={<RelatoriosPage />} />
              </Route>

              <Route element={<PermissionRoute permission={PERMISSAO.SATISFACAO_READ} />}>
                <Route path="/satisfacao" element={<SatisfacaoPage />} />
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

              {/* Every administrator manages their own second factor: no module
                  permission, because it is the account's, not the panel's. */}
              <Route path="/seguranca" element={<SegurancaContaPage />} />

              {/* "Estatísticas" alone is not a screen: it leads to the first child. */}
              <Route
                path="/estatisticas"
                element={<Navigate to="/estatisticas/clinicas" replace />}
              />
            </Route>

            {/* ----------------------------------------------------- clínico */}
            {/* Foundation only (PA-07): routing, frame and navigation are
                real; the six screens still show what is missing instead of
                a number that isn't there yet. */}
            <Route
              path="/clinico/:especialidade"
              element={
                <AreaRoute area="clinico">
                  <ClinicoLayout />
                </AreaRoute>
              }
            >
              <Route index element={<ClinicoDashboardPage />} />
              <Route path="pacientes" element={<ClinicoPacientesPage />} />
              <Route element={<PermissionRoute permission={PERMISSAO.PACIENTES_READ} />}>
                <Route path="pacientes/:id" element={<ClinicoPacienteFicha />} />
              </Route>
              <Route path="agenda" element={<ClinicoAgendaPage />} />
              <Route path="chat" element={<ClinicoChatPage />} />
              <Route path="alertas" element={<ClinicoAlertasPage />} />
              <Route element={<PermissionRoute permission={PERMISSAO.ESTATISTICAS_READ_SELF} />}>
                <Route path="carteira" element={<ClinicoCarteiraPage />} />
              </Route>
              {/* Writing is the professional's, in their own area: the list and the
                  editor share the module permission, and the database still decides
                  who is the author. "nova" outranks ":id" by being static. */}
              <Route element={<PermissionRoute permission={PERMISSAO.CONTEUDO_WRITE} />}>
                <Route path="conteudo" element={<ClinicoConteudoPage />} />
                <Route path="conteudo/nova" element={<ClinicoOrientacaoPage />} />
                <Route path="conteudo/:id" element={<ClinicoOrientacaoPage />} />
              </Route>
              <Route path="perfil" element={<ClinicoPerfilPage />} />
              <Route path="seguranca" element={<SegurancaContaPage />} />
            </Route>
          </Route>

          {/* ------------------------------------------------------ default */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default AppRoutes;
