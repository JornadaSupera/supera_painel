import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, KeyRound, Link2Off, LoaderCircle, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PublicLayout } from "@/layouts/PublicLayout";
import { cn } from "@/lib/utils";
import { ApiException, ERROR_CODE } from "@/services/contracts";
import type { RecoveryCredential } from "@/services/contracts/operations";
import { AuthErrorAlert } from "../components/AuthErrorAlert";
import { PasswordInput } from "../components/PasswordInput";
import { usePasswordRecovery } from "../hooks/usePasswordRecovery";
import { readRecoveryLink } from "../recovery-link";
import { APP_PASSWORD_MIN_LENGTH, appPasswordSchema, type AppPasswordForm } from "../schemas";

/**
 * Password reset for app accounts — patients and caregivers arriving from the
 * "forgot my password" e-mail.
 *
 * This page is a dead end on purpose. It never creates a panel session, never
 * links to sign-in or to any other route, and ends by sending the person back
 * to the app. A panel account using the same kind of link gets the same
 * treatment: the password changes, nothing opens.
 */

type Phase = "form" | "success" | "expired" | "invalid";

const PAGE_TITLE = "Redefinir senha · Jornada Supera";

export function PasswordRecoveryPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Read once: the URL is cleaned right after, and the credential stays only
  // in this component's memory.
  const [link] = useState(() => readRecoveryLink(location));
  const [phase, setPhase] = useState<Phase>(link.status === "ready" ? "form" : link.status);

  useEffect(() => {
    // The token must not linger in the address bar or the browser history.
    if (location.search || location.hash) {
      navigate({ pathname: location.pathname }, { replace: true });
    }
  }, [location.search, location.hash, location.pathname, navigate]);

  useDocumentTitle(PAGE_TITLE);

  return (
    <PublicLayout>
      {/* `key` replays the entrance animation on every change of step. */}
      <div key={phase} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        {phase === "form" && link.status === "ready" && (
          <RecoveryForm
            credential={link.credential}
            onChanged={() => setPhase("success")}
            onLinkSpent={() => setPhase("expired")}
          />
        )}
        {phase === "success" && <SuccessStep />}
        {(phase === "expired" || phase === "invalid") && <LinkProblemStep reason={phase} />}
      </div>
    </PublicLayout>
  );
}

/* -------------------------------------------------------------------------
   FORM
   ------------------------------------------------------------------------- */

function RecoveryForm({
  credential,
  onChanged,
  onLinkSpent,
}: {
  credential: RecoveryCredential;
  onChanged: () => void;
  onLinkSpent: () => void;
}) {
  const recovery = usePasswordRecovery();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AppPasswordForm>({
    resolver: zodResolver(appPasswordSchema),
    defaultValues: { password: "", confirmation: "" },
    // Errors wait for the first submit: a field turning red mid-word reads as
    // a mistake that was not made.
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const password = form.watch("password") ?? "";
  const confirmation = form.watch("confirmation") ?? "";
  const matches = confirmation.length > 0 && confirmation === password;

  const submit = form.handleSubmit(async ({ password: newPassword }) => {
    setError(null);

    try {
      await recovery.mutateAsync({ credential, password: newPassword });
      // The password leaves memory as soon as it is no longer needed.
      form.reset();
      onChanged();
    } catch (caught) {
      const code = caught instanceof ApiException ? caught.code : null;

      if (code === ERROR_CODE.UNAUTHORIZED) {
        form.reset();
        onLinkSpent();
        return;
      }

      setError(
        code === ERROR_CODE.VALIDATION || code === ERROR_CODE.RATE_LIMITED
          ? (caught as Error).message
          : "Não foi possível salvar agora. Verifique sua conexão e tente de novo.",
      );
    }
  });

  const isSaving = recovery.isPending;

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        icon={KeyRound}
        tone="primary"
        title="Crie sua nova senha"
        description="Escolha uma senha que você não usa em outros lugares. Depois, é só voltar ao aplicativo e entrar com ela."
      />

      <Form {...form}>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <AuthErrorAlert message={error} />

          <FormField
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Nova senha</FormLabel>
                <FormControl>
                  <PasswordInput
                    {...field}
                    autoComplete="new-password"
                    disabled={isSaving}
                    className="h-11 text-base sm:text-sm"
                  />
                </FormControl>
                {/* The hint and the error say the same thing; show one. */}
                {fieldState.error ? (
                  <FormMessage />
                ) : (
                  <FormDescription>Mínimo de {APP_PASSWORD_MIN_LENGTH} caracteres.</FormDescription>
                )}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repita a nova senha</FormLabel>
                <FormControl>
                  <PasswordInput
                    {...field}
                    autoComplete="new-password"
                    disabled={isSaving}
                    className="h-11 text-base sm:text-sm"
                  />
                </FormControl>
                {matches ? (
                  <p className="text-success flex items-center gap-1.5 text-xs" aria-live="polite">
                    <CircleCheck size={13} aria-hidden="true" />
                    As senhas coincidem
                  </p>
                ) : (
                  <FormMessage />
                )}
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" disabled={isSaving} className="h-12 w-full text-base">
            {isSaving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {isSaving ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </form>
      </Form>
    </div>
  );
}

/* -------------------------------------------------------------------------
   OUTCOMES
   ------------------------------------------------------------------------- */

function SuccessStep() {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        icon={CircleCheck}
        tone="success"
        title="Senha alterada!"
        description="Sua nova senha já está valendo. Volte ao aplicativo Jornada Supera e entre com seu e-mail e a nova senha."
      />

      <p className="text-muted-foreground text-center text-sm">Você já pode fechar esta página.</p>

      <p className="border-border text-muted-foreground border-t pt-5 text-center text-xs leading-relaxed">
        Não foi você quem pediu esta troca? Fale com a equipe do Centro de Oncologia o quanto antes.
      </p>
    </div>
  );
}

const APP_STEPS = [
  "Abra o aplicativo Jornada Supera",
  "Na tela de entrada, toque em “Esqueci minha senha”",
  "Abra o e-mail novo e toque no link",
] as const;

function LinkProblemStep({ reason }: { reason: "expired" | "invalid" }) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        icon={Link2Off}
        tone="warning"
        title={reason === "expired" ? "Este link expirou" : "Não conseguimos abrir este link"}
        description={
          reason === "expired"
            ? "Por segurança, o link de troca de senha vale por pouco tempo e só pode ser usado uma vez."
            : "O endereço está incompleto ou já foi usado. Isso costuma acontecer quando o link é aberto pela segunda vez."
        }
      />

      <div className="bg-muted/60 flex flex-col gap-4 rounded-xl p-5">
        <p className="text-sm font-medium">Peça um novo link pelo aplicativo:</p>
        <ol className="flex flex-col gap-3">
          {APP_STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-sm">
              <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold">
                {index + 1}
              </span>
              <span className="pt-0.5 leading-snug">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   PIECES
   ------------------------------------------------------------------------- */

const TONES = {
  primary: "bg-primary/10 text-primary ring-primary/15",
  success: "bg-success-bg text-success ring-success/20",
  warning: "bg-warning-bg text-warning ring-warning/20",
} as const;

function StepHeading({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  description: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span
        className={cn(
          "animate-in zoom-in-50 flex size-16 items-center justify-center rounded-full ring-8 duration-500",
          TONES[tone],
        )}
      >
        <Icon size={30} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">{description}</p>
      </div>
    </div>
  );
}

export default PasswordRecoveryPage;
