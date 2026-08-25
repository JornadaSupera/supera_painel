import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle, MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

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
import { authApi, call } from "@/services/apiClient";
import { recuperarSenhaSchema, type RecuperarSenhaForm } from "../schemas";

/**
 * Recuperação de senha.
 *
 * Responde sempre a mesma coisa, exista ou não o e-mail. Confirmar que uma
 * conta existe transforma esta tela em verificador de e-mails válidos da
 * clínica — insumo direto para phishing dirigido.
 */
export function RecuperarSenhaPage() {
  const [enviado, setEnviado] = useState<string | null>(null);

  const form = useForm<RecuperarSenhaForm>({
    resolver: zodResolver(recuperarSenhaSchema),
    defaultValues: { email: "" },
  });

  const enviar = async (dados: RecuperarSenhaForm) => {
    try {
      await call(() => authApi.requestPasswordReset({ email: dados.email }));
    } catch {
      // Falha de rede também não muda a resposta: qualquer diferença de
      // comportamento vira sinal para quem estiver sondando contas.
    } finally {
      setEnviado(dados.email);
    }
  };

  if (enviado) {
    return (
      <AuthLayout
        titulo="Confira seu e-mail"
        descricao={
          <>
            Se houver uma conta ativa para{" "}
            <strong className="text-foreground font-mono">{enviado}</strong>, o link de redefinição
            chega em alguns minutos.
          </>
        }
        rodape={
          <Link to="/login" className="hover:text-foreground inline-flex items-center gap-2 underline underline-offset-4">
            <ArrowLeft size={14} aria-hidden="true" />
            Voltar para o acesso
          </Link>
        }
      >
        <div className="border-border flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center">
          <span className="bg-success-bg text-success flex size-12 items-center justify-center rounded-full">
            <MailCheck size={22} aria-hidden="true" />
          </span>
          <p className="text-muted-foreground text-sm leading-relaxed">
            O link vale por 30 minutos e só pode ser usado uma vez. Não recebeu? Verifique a caixa
            de spam antes de tentar de novo.
          </p>
          <Button variant="outline" size="sm" onClick={() => setEnviado(null)}>
            Usar outro e-mail
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const enviando = form.formState.isSubmitting;

  return (
    <AuthLayout
      titulo="Recuperar senha"
      descricao="Informe seu e-mail corporativo e enviaremos um link para criar uma nova senha."
      rodape={
        <Link to="/login" className="hover:text-foreground inline-flex items-center gap-2 underline underline-offset-4">
          <ArrowLeft size={14} aria-hidden="true" />
          Voltar para o acesso
        </Link>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(enviar)} className="flex flex-col gap-5" noValidate>
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

          <Button type="submit" disabled={enviando} className="w-full">
            {enviando && <LoaderCircle className="animate-spin" />}
            Enviar link de redefinição
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}

export default RecuperarSenhaPage;
