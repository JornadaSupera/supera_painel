import { zodResolver } from "@hookform/resolvers/zod";
import { Check, CircleAlert, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

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
import { AuthLayout } from "@/layouts/AuthLayout";
import { cn } from "@/lib/utils";
import { authApi, call } from "@/services/apiClient";
import { novaSenhaSchema, REGRAS_SENHA, type NovaSenhaForm } from "../schemas";

/**
 * Definição de nova senha, a partir do link enviado por e-mail.
 *
 * A lista de requisitos é viva: marca o que já foi cumprido enquanto a pessoa
 * digita. Descobrir a regra só ao errar produz tentativa e erro — e senhas
 * piores, porque a pessoa acaba escolhendo o mínimo que passou.
 */
export function NovaSenhaPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  const token = searchParams.get("token") ?? "";

  const form = useForm<NovaSenhaForm>({
    resolver: zodResolver(novaSenhaSchema),
    defaultValues: { senha: "", confirmacao: "" },
    mode: "onChange",
  });

  const senhaAtual = form.watch("senha");

  const enviar = async (dados: NovaSenhaForm) => {
    setErro(null);
    try {
      await call(() => authApi.resetPassword({ token, senha: dados.senha }));
      navigate("/login", { replace: true, state: { senhaAlterada: true } });
    } catch (e) {
      setErro((e as Error).message ?? "Não foi possível alterar a senha.");
    }
  };

  if (!token) {
    return (
      <AuthLayout
        title="Link inválido"
        description="Este link de redefinição não é válido ou já foi usado."
        footer={
          <Link to="/recuperar-senha" className="text-primary font-medium underline underline-offset-4">
            Solicitar um novo link
          </Link>
        }
      >
        <Alert variant="destructive" role="alert">
          <CircleAlert />
          <AlertDescription>
            Por segurança, cada link vale por 30 minutos e só pode ser usado uma vez.
          </AlertDescription>
        </Alert>
      </AuthLayout>
    );
  }

  const enviando = form.formState.isSubmitting;

  return (
    <AuthLayout title="Criar nova senha" description="Escolha uma senha que você não use em outro serviço.">
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
            name="senha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova senha</FormLabel>
                <FormControl>
                  <Input {...field} type="password" autoComplete="new-password" autoFocus />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Lista viva de requisitos. `aria-live` mantém quem usa leitor de
              tela ciente do progresso sem precisar submeter. */}
          <ul className="flex flex-col gap-1.5" aria-live="polite">
            {REGRAS_SENHA.map((regra) => {
              const cumprida = regra.teste(senhaAtual ?? "");

              return (
                <li
                  key={regra.id}
                  className={cn(
                    "flex items-center gap-2 text-xs transition-colors",
                    cumprida ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {cumprida ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <X size={13} aria-hidden="true" />
                  )}
                  {regra.label}
                  <span className="sr-only">{cumprida ? "— cumprido" : "— pendente"}</span>
                </li>
              );
            })}
          </ul>

          <FormField
            control={form.control}
            name="confirmacao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repita a nova senha</FormLabel>
                <FormControl>
                  <Input {...field} type="password" autoComplete="new-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={enviando} className="w-full">
            {enviando && <LoaderCircle className="animate-spin" />}
            Salvar nova senha
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}

export default NovaSenhaPage;
