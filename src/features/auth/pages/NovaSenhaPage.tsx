import { zodResolver } from "@hookform/resolvers/zod";
import { Check, CircleCheck, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";

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
import { ApiException, ERROR_CODE } from "@/services/contracts";
import type { RecoveryCredential } from "@/services/contracts/operations";
import { AuthErrorAlert } from "../components/AuthErrorAlert";
import { usePasswordRecovery } from "../hooks/usePasswordRecovery";
import { readRecoveryLink } from "../recovery-link";
import { novaSenhaSchema, REGRAS_SENHA, type NovaSenhaForm } from "../schemas";

/**
 * Definição de nova senha da equipe do painel, a partir do link do e-mail.
 *
 * > [!] O link NÃO chega como `?token=`.
 * Supabase entrega a prova em uma de três formas, e qual delas depende do
 * modelo de e-mail configurado no projeto — não do painel:
 *
 *   #access_token=…&refresh_token=…   modelo padrão (fluxo implícito)
 *   ?token_hash=…&type=recovery       modelo personalizado
 *   #error=…&error_code=otp_expired   o próprio Supabase já recusou o link
 *
 * Ler só `?token` fazia a tela recusar TODO link válido: o parâmetro nunca
 * existe, e a pessoa via "link inválido" logo depois de pedir o link. Quem lê
 * as três formas é `readRecoveryLink`, a mesma função que atende os pacientes
 * em `/redefinir-senha`.
 *
 * A lista de requisitos é viva: marca o que já foi cumprido enquanto a pessoa
 * digita. Descobrir a regra só ao errar produz tentativa e erro — e senhas
 * piores, porque a pessoa acaba escolhendo o mínimo que passou.
 */
export function NovaSenhaPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  // Lido uma vez: a URL é limpa logo em seguida, e a credencial fica só na
  // memória deste componente.
  const [link] = useState(() => readRecoveryLink(location));
  const [gasto, setGasto] = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    // O token não pode ficar na barra de endereços nem no histórico.
    if (location.search || location.hash) {
      navigate({ pathname: location.pathname }, { replace: true });
    }
  }, [location.search, location.hash, location.pathname, navigate]);

  const recuperacao = usePasswordRecovery();

  const form = useForm<NovaSenhaForm>({
    resolver: zodResolver(novaSenhaSchema),
    defaultValues: { senha: "", confirmacao: "" },
    mode: "onChange",
  });

  const senhaAtual = form.watch("senha");

  const enviar = async (dados: NovaSenhaForm) => {
    if (link.status !== "ready") return;

    setErro(null);

    try {
      await recuperacao.mutateAsync({
        credential: link.credential satisfies RecoveryCredential,
        password: dados.senha,
      });

      form.reset();
      setConcluido(true);
    } catch (capturado) {
      const codigo = capturado instanceof ApiException ? capturado.code : null;

      // Link gasto ou expirado não é erro de formulário: nenhuma tentativa
      // nesta tela resolve, e insistir no campo só esconde o que fazer.
      if (codigo === ERROR_CODE.UNAUTHORIZED) {
        form.reset();
        setGasto(true);
        return;
      }

      setErro(
        codigo === ERROR_CODE.VALIDATION || codigo === ERROR_CODE.RATE_LIMITED
          ? (capturado as Error).message
          : "Não foi possível salvar agora. Verifique sua conexão e tente de novo.",
      );
    }
  };

  /* Confirmação em tela, e não um retorno à entrada do painel.
     Trocar a senha e cair no formulário de login não distingue "deu certo" de
     "falhou e voltou ao começo" — a pessoa reabre o e-mail, clica no link de
     novo e aí sim encontra um link gasto. Quem chega aqui muitas vezes só
     precisava recuperar o acesso, não entrar agora: a tela diz que acabou e
     libera fechar a página. Entrar continua a um clique, no rodapé. */
  if (concluido) {
    return (
      <AuthLayout
        title="Senha alterada!"
        description="Sua nova senha já está valendo."
        footer={
          <Link to="/login" className="text-primary font-medium underline underline-offset-4">
            Entrar no painel agora
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 text-center" role="status">
          <span className="bg-success-bg text-success flex size-12 items-center justify-center rounded-full">
            <CircleCheck size={26} aria-hidden="true" />
          </span>

          <p className="text-muted-foreground text-sm leading-relaxed">
            Você já pode fechar esta página. Da próxima vez que entrar no painel, use a senha
            que acabou de criar.
          </p>

          <p className="border-border text-muted-foreground w-full border-t pt-5 text-xs leading-relaxed">
            Não foi você quem pediu esta troca? Fale com a equipe do Centro de Oncologia o quanto
            antes.
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (gasto || link.status !== "ready") {
    const expirado = gasto || link.status === "expired";

    return (
      <AuthLayout
        title={expirado ? "Este link expirou" : "Link inválido"}
        description={
          expirado
            ? "Por segurança, o link de troca de senha vale por pouco tempo e só pode ser usado uma vez."
            : "O endereço está incompleto ou já foi usado."
        }
        footer={
          <Link
            to="/recuperar-senha"
            className="text-primary font-medium underline underline-offset-4"
          >
            Solicitar um novo link
          </Link>
        }
      >
        <AuthErrorAlert message="Peça um link novo e abra-o pelo próprio e-mail, sem copiar e colar o endereço." />
      </AuthLayout>
    );
  }

  const enviando = recuperacao.isPending;

  return (
    <AuthLayout
      title="Criar nova senha"
      description="Escolha uma senha que você não use em outro serviço."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(enviar)} className="flex flex-col gap-5" noValidate>
          <AuthErrorAlert message={erro} />

          <FormField
            control={form.control}
            name="senha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova senha</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    disabled={enviando}
                  />
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
                  <Input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    disabled={enviando}
                  />
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
