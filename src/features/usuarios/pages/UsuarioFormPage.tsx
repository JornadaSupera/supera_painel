import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Info, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

import {
  BackendPendente,
  ErrorState,
  FormSelect,
  PageHeader,
  SkeletonForm,
  StatusBadge,
} from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  CONSELHO_POR_ESPECIALIDADE,
  ESPECIALIDADE_LABEL,
  PAPEL,
  PAPEL_LABEL,
  type Especialidade,
} from "@/lib/enums";
import { PERMISSAO_LABEL } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { motivoIndisponivel } from "@/services/apiClient";
import {
  useAtualizarUsuario,
  useContasSemPerfil,
  useCriarUsuario,
  useUsuario,
} from "../hooks/useUsuarios";
import { paraEntrada, usuarioSchema, VALORES_INICIAIS, type UsuarioForm as Valores } from "../schemas";

/**
 * Concessão e correção de perfil no painel.
 *
 * > [!] Este formulário NÃO cria acesso.
 * Ele concede um perfil a uma conta que já existe. A conta nasce quando a
 * própria pessoa se cadastra — o painel roda no navegador, com chave pública, e
 * criar conta de terceiro exigiria a chave de serviço, que nunca entra num
 * bundle. Além disso, quem escolhe a senha tem que ser o titular: administrador
 * que define senha alheia quebra o não repúdio da trilha.
 *
 * > [!] Ninguém concede a si mesmo.
 * O backend recusa o ato reflexivo em qualquer operação de perfil profissional.
 * A razão é a psicologia: a especialidade decide sigilo para a plataforma
 * inteira, e quem se autoconcedesse aquela área leria o que a clínica decidiu
 * que a administração não lê. Acumular os dois papéis continua possível — só
 * que por mão de outro administrador, e com dois nomes na trilha.
 *
 * O papel define o que a pessoa pode; a especialidade define onde ela trabalha
 * e concede o que nenhum papel herda. A tela resume, ao final, o acesso que a
 * combinação produz.
 */

const ESPECIALIDADES = Object.keys(ESPECIALIDADE_LABEL) as Especialidade[];

/** Um botão de área. Selecionar é conceder leitura — por isso o rótulo é claro. */
function ChipEspecialidade({
  especialidade,
  ativa,
  onClick,
}: {
  especialidade: Especialidade;
  ativa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={cn(
        "focus-visible:ring-ring/50 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
        ativa
          ? "border-primary/30 bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted border-border",
      )}
    >
      {ESPECIALIDADE_LABEL[especialidade]}
    </button>
  );
}

export function UsuarioFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const edicao = Boolean(id);

  const { data: usuario, isLoading, isError, error, refetch } = useUsuario(id);
  const contas = useContasSemPerfil(!edicao);
  const criar = useCriarUsuario();
  const atualizar = useAtualizarUsuario(id ?? "");

  const form = useForm<Valores>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: VALORES_INICIAIS,
    mode: "onBlur",
  });

  // O formulário monta antes da resposta chegar; `reset` preenche quando ela
  // chega, sem descartar o que a pessoa já tenha digitado depois disso.
  useEffect(() => {
    if (!usuario) return;

    form.reset({
      account_id: usuario.id,
      papel: usuario.papel === PAPEL.ADMIN ? PAPEL.ADMIN : PAPEL.PROFISSIONAL,
      especialidades: usuario.especialidades,
      especialidade_principal: usuario.especialidade ?? "",
      registro: usuario.registro ?? "",
    });
  }, [usuario, form]);

  const papel = form.watch("papel");
  const especialidades = form.watch("especialidades");
  const principal = form.watch("especialidade_principal");
  const salvando = criar.isPending || atualizar.isPending;

  if (edicao && isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader eyebrow="Gestão" title="Editar profissional" />
        <SkeletonForm fields={5} className="max-w-2xl" />
      </div>
    );
  }

  if (edicao && (isError || !usuario)) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  // A rota é alcançável pela URL mesmo com o botão desabilitado na listagem.
  const indisponivel = motivoIndisponivel(edicao ? "usuarios.update" : "usuarios.create");

  const cabecalho = (
    <PageHeader
      eyebrow="Gestão"
      title={edicao ? `Editar ${usuario?.nome}` : "Conceder perfil"}
      breadcrumb={[
        { label: "Usuários", to: "/usuarios" },
        { label: edicao ? (usuario?.nome ?? "Editar") : "Conceder perfil" },
      ]}
      subtitle={
        edicao
          ? "Alterações de área e registro ficam na trilha de auditoria."
          : "O perfil é concedido a uma conta que já existe. Quem cria a conta é a própria pessoa."
      }
    />
  );

  if (indisponivel) {
    return (
      <div className="flex flex-col gap-5">
        {cabecalho}
        <BackendPendente
          titulo={edicao ? "Edição de profissional" : "Concessão de perfil"}
          motivo={indisponivel}
        />
      </div>
    );
  }

  const enviar = (valores: Valores) => {
    const entrada = paraEntrada(valores);

    if (edicao) {
      // Conta e papel não mudam pela edição: os dois primeiros campos são
      // leitura. O que o backend aceita corrigir é registro e áreas.
      atualizar.mutate(
        {
          registro: entrada.registro,
          especialidades: entrada.especialidades,
          especialidade_principal: entrada.especialidade_principal,
        },
        { onSuccess: () => navigate("/usuarios") },
      );
      return;
    }

    criar.mutate(entrada, { onSuccess: () => navigate("/usuarios") });
  };

  const areaPrincipal = (principal || especialidades[0]) as Especialidade | undefined;
  const conselho = areaPrincipal ? CONSELHO_POR_ESPECIALIDADE[areaPrincipal] : null;
  const clinico = papel === PAPEL.PROFISSIONAL;

  const opcoesDeConta = (contas.data ?? []).map((conta) => ({
    value: conta.id,
    label: `${conta.nome} · ${conta.email}`,
  }));

  return (
    <div className="flex flex-col gap-5">
      {cabecalho}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(enviar)}
          noValidate
          className="flex max-w-2xl flex-col gap-5"
        >
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              {edicao ? (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Conta</FormLabel>
                  <FormControl>
                    <Input value={`${usuario?.nome} · ${usuario?.email}`} disabled readOnly />
                  </FormControl>
                  <FormDescription>
                    Nome e e-mail são da conta, e quem os corrige é a própria pessoa.
                  </FormDescription>
                </FormItem>
              ) : (
                <FormField
                  control={form.control}
                  name="account_id"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Conta que recebe o perfil</FormLabel>
                      <FormSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder={
                          contas.isLoading ? "Carregando contas…" : "Selecione a pessoa"
                        }
                        options={opcoesDeConta}
                      />
                      <FormDescription>
                        {contas.isError
                          ? "Não foi possível carregar as contas disponíveis."
                          : opcoesDeConta.length === 0 && !contas.isLoading
                            ? "Nenhuma conta sem perfil. A pessoa precisa se cadastrar antes de receber um."
                            : "Só aparecem contas ativas que ainda não têm perfil no painel."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="papel"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Papel</FormLabel>
                    <FormSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={edicao}
                      options={[
                        { value: PAPEL.PROFISSIONAL, label: PAPEL_LABEL[PAPEL.PROFISSIONAL] },
                        { value: PAPEL.ADMIN, label: PAPEL_LABEL[PAPEL.ADMIN] },
                      ]}
                    />
                    <FormDescription>
                      {edicao
                        ? "Trocar de papel é ato próprio, não edição de cadastro."
                        : "Administrador opera o painel; profissional trabalha nas áreas escolhidas abaixo."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {clinico && (
                <>
                  <FormField
                    control={form.control}
                    name="especialidades"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Áreas de atuação</FormLabel>
                        <FormControl>
                          <fieldset className="flex flex-wrap gap-1.5">
                            <legend className="sr-only">Áreas de atuação</legend>
                            {ESPECIALIDADES.map((especialidade) => (
                              <ChipEspecialidade
                                key={especialidade}
                                especialidade={especialidade}
                                ativa={field.value.includes(especialidade)}
                                onClick={() =>
                                  field.onChange(
                                    field.value.includes(especialidade)
                                      ? field.value.filter((atual) => atual !== especialidade)
                                      : [...field.value, especialidade],
                                  )
                                }
                              />
                            ))}
                          </fieldset>
                        </FormControl>
                        <FormDescription>
                          Cada área abre a leitura daquele espaço de trabalho. Retirar uma
                          encerra a vigência e mantém o histórico.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="especialidade_principal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Área principal</FormLabel>
                        <FormSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          emptyLabel="A primeira escolhida"
                          options={especialidades.map((especialidade) => ({
                            value: especialidade,
                            label: ESPECIALIDADE_LABEL[especialidade],
                          }))}
                        />
                        <FormDescription>Agrupa a carteira da pessoa.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="registro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registro no conselho</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={conselho ? `${conselho}/SC 00000` : "—"} />
                        </FormControl>
                        <FormDescription>Obrigatório para o perfil clínico.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <div className="border-border bg-muted/40 text-muted-foreground flex gap-2.5 rounded-lg border p-3 text-xs sm:col-span-2">
                <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                <p>
                  Tratamento, janela de atendimento no chat e segundo fator não são
                  configurados aqui: os dois primeiros não têm onde ser guardados, e o
                  terceiro é gerenciado pela própria pessoa, no autenticador dela.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Resumo do acesso: o que este papel realmente abre. */}
          {edicao && usuario && (
            <Alert>
              <ShieldCheck />
              <AlertTitle>
                Acesso efetivo · {usuario.permissoes_efetivas.length} permissões
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {usuario.permissoes_efetivas.map((permissao) => (
                    <li key={permissao}>
                      <StatusBadge tone="neutral" size="sm">
                        {PERMISSAO_LABEL[permissao]}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={() => navigate("/usuarios")}>
              Cancelar
            </Button>

            <Button type="submit" disabled={salvando}>
              {salvando ? <LoaderCircle className="animate-spin" /> : <Check />}
              {edicao ? "Salvar alterações" : "Conceder perfil"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default UsuarioFormPage;
