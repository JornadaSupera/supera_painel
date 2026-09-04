import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation } from "react-router-dom";
import type { Location as RouterLocation } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { AuthLayout } from "@/layouts/AuthLayout";
import { ERROR_CODE } from "@/services/contracts";
import { loginSchema, type LoginForm } from "../schemas";

/**
 * Login com e-mail corporativo e senha.
 *
 * Não conclui o acesso: o segundo fator é obrigatório (PDF §5). Um login bem
 * sucedido leva sempre a `/login/mfa`.
 */
export function LoginPage() {
  const { signIn, isAuthenticated, mfaChallenge } = useAuth();
  const location = useLocation();
  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", senha: "" },
  });

  if (isAuthenticated) {
    const destino = (location.state as { from?: RouterLocation } | null)?.from?.pathname ?? "/dashboard";
    return <Navigate to={destino} replace />;
  }

  // Recarregar a página no meio do fluxo não deve reabrir o formulário de
  // credenciais com um desafio de MFA já em curso.
  if (mfaChallenge) return <Navigate to="/login/mfa" replace state={location.state} />;

  const enviar = async (dados: LoginForm) => {
    setErro(null);
    try {
      await signIn({ email: dados.email, password: dados.senha });
    } catch (e) {
      const codigo = (e as { code?: string }).code;

      // Mensagem única para credencial errada: distinguir "e-mail não existe"
      // de "senha errada" entrega uma lista de contas válidas da clínica.
      setErro(
        codigo === ERROR_CODE.UNAUTHORIZED
          ? "E-mail ou senha inválidos."
          : ((e as Error).message ?? "Não foi possível entrar. Tente novamente."),
      );
    }
  };

  const enviando = form.formState.isSubmitting;

  return (
    <AuthLayout
      title="Entrar no painel"
      description="Use seu e-mail corporativo. Depois da senha, pediremos o código de verificação."
      footer={
        <p>
          Problemas para acessar?{" "}
          <Link to="/recuperar-senha" className="text-primary font-medium underline underline-offset-4">
            Recuperar senha
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(enviar)} className="flex flex-col gap-5" noValidate>
          {erro && (
            <Alert variant="destructive" role="alert">
              <CircleAlert />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail corporativo</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="username"
                    autoFocus
                    placeholder="nome.sobrenome@cosc.com.br"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="senha"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Senha</FormLabel>
                  <Link
                    to="/recuperar-senha"
                    className="text-muted-foreground hover:text-primary text-xs underline underline-offset-4"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <FormControl>
                  {/* `current-password` faz o gerenciador de senhas do
                      navegador se comportar corretamente. */}
                  <Input {...field} type="password" autoComplete="current-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={enviando} className="w-full">
            {enviando && <LoaderCircle className="animate-spin" />}
            Continuar
          </Button>
        </form>
      </Form>

    </AuthLayout>
  );
}

export default LoginPage;
