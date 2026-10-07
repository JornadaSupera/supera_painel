import { zodResolver } from "@hookform/resolvers/zod";
import { Check, CircleCheck, LoaderCircle, Send, ShieldCheck, Stethoscope } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

import {
  BackendPendente,
  DetailRow,
  ErrorState,
  Footnote,
  FormSection,
  FormSelect,
  PageHeader,
  SectionHeading,
  SkeletonForm,
  StatusBadge,
} from "@/components/shared";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReforcoDaSessao } from "@/hooks/useReforcoDaSessao";
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
  useConvidarUsuario,
  useCriarUsuario,
  useUsuario,
} from "../hooks/useUsuarios";
import {
  MODO_CADASTRO,
  paraConvite,
  paraEntrada,
  usuarioSchema,
  VALORES_INICIAIS,
  type ModoCadastro,
  type UsuarioForm as Valores,
} from "../schemas";

/**
 * Cadastro de equipe e correção de perfil no painel.
 *
 * > [!] Nenhum dos dois caminhos escolhe a senha de ninguém.
 * **Convidar** manda um e-mail para a pessoa criar a própria senha; a conta é
 * criada no servidor, por Edge Function, porque criar conta de terceiro exige a
 * chave de serviço, que nunca entra num bundle. **Conceder** dá o perfil a uma
 * conta que já existe. Administrador que define senha alheia quebra o não
 * repúdio da trilha.
 *
 * > [!] Convidar exige o segundo fator.
 * O banco só aceita o cadastro de equipe em sessão com o segundo fator
 * verificado. O painel pede o código no clique em "Enviar convite", e o convite
 * segue de onde parou.
 *
 * > [!] Ninguém concede a si mesmo.
 * O backend recusa o ato reflexivo em qualquer operação de perfil profissional.
 * A razão é a psicologia: a especialidade decide sigilo para a plataforma
 * inteira, e quem se autoconcedesse aquela área leria o que a clínica decidiu
 * que a administração não lê. Acumular os dois papéis continua possível — só
 * que por mão de outro administrador, e com dois nomes na trilha.
 *
 * O papel define o que a pessoa pode; a especialidade define onde ela trabalha
 * e concede o que nenhum papel herda. A coluna de resumo repete a combinação
 * escolhida e diz o que acontece no clique; na edição, mostra o acesso efetivo.
 */

const ESPECIALIDADES = Object.keys(ESPECIALIDADE_LABEL) as Especialidade[];

/**
 * Form on the left, summary on the right from xl up. The form takes whatever
 * the page has — up to ~1000px on a wide monitor — and the summary keeps a
 * fixed column, so the submit button stays beside the fields instead of under
 * a card that ends halfway across the screen.
 */
const GRADE =
  "grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]";

const OPCOES_DE_PAPEL = [
  {
    value: PAPEL.PROFISSIONAL,
    descricao: "Atende nas áreas escolhidas, com registro no conselho.",
    Icone: Stethoscope,
  },
  {
    value: PAPEL.ADMIN,
    descricao: "Opera o painel da clínica, sem área de atuação.",
    Icone: ShieldCheck,
  },
] as const;

/**
 * Um bloco de área. Selecionar é conceder leitura — por isso o bloco diz o
 * conselho que a área exige, e não só o nome.
 */
function BlocoEspecialidade({
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
        "focus-visible:ring-ring/50 flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        ativa ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
          ativa ? "border-primary bg-primary text-primary-foreground" : "border-input",
        )}
      >
        {ativa && <Check size={12} strokeWidth={3} />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={cn("text-sm", ativa && "font-medium")}>
          {ESPECIALIDADE_LABEL[especialidade]}
        </span>
        <span className="text-muted-foreground text-[11px]">
          Registro {CONSELHO_POR_ESPECIALIDADE[especialidade]}
        </span>
      </span>
    </button>
  );
}

/** Um passo numerado do que acontece depois do clique. */
function Passos({ itens }: { itens: string[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {itens.map((item, indice) => (
        <li key={item} className="flex gap-3 text-xs leading-relaxed">
          <span
            aria-hidden="true"
            className="bg-primary/10 text-primary-ink flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums"
          >
            {indice + 1}
          </span>
          <span className="text-muted-foreground pt-px">{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function UsuarioFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const edicao = Boolean(id);

  const { data: usuario, isLoading, isError, error, refetch } = useUsuario(id);
  const contas = useContasSemPerfil(!edicao);
  const criar = useCriarUsuario();
  const convidar = useConvidarUsuario();
  const atualizar = useAtualizarUsuario(id ?? "");
  const { exigir, dialogo } = useReforcoDaSessao();

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
      modo: MODO_CADASTRO.CONCESSAO,
      account_id: usuario.id,
      nome: "",
      email: "",
      papel: usuario.papel === PAPEL.ADMIN ? PAPEL.ADMIN : PAPEL.PROFISSIONAL,
      especialidades: usuario.especialidades,
      especialidade_principal: usuario.especialidade ?? "",
      registro: usuario.registro ?? "",
    });
  }, [usuario, form]);

  const papel = form.watch("papel");
  const especialidades = form.watch("especialidades");
  const principal = form.watch("especialidade_principal");
  const modo = form.watch("modo");
  const nome = form.watch("nome");
  const contaEscolhida = form.watch("account_id");
  const registro = form.watch("registro");
  const convite = !edicao && modo === MODO_CADASTRO.CONVITE;
  const salvando = criar.isPending || atualizar.isPending || convidar.isPending;

  if (edicao && isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader eyebrow="Gestão" title="Editar profissional" />
        <div className={GRADE}>
          <SkeletonForm fields={5} />
          <Skeleton className="h-72 rounded-xl" />
        </div>
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
      title={edicao ? `Editar ${usuario?.nome}` : "Novo usuário"}
      // A back button and no trail: the header only shows the back button on
      // a phone when there is a trail, and here the trail just repeated the title.
      backTo="/usuarios"
      backLabel="Usuários"
      subtitle={
        edicao
          ? "Alterações de área e registro ficam na trilha de auditoria."
          : convite
            ? "A pessoa recebe um e-mail para criar a própria senha. O acesso vale quando ela abrir o link."
            : "O perfil é concedido a uma conta que já existe. Nome e e-mail são do titular."
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

    if (valores.modo === MODO_CADASTRO.CONVITE) {
      // O banco só aceita o cadastro de equipe em sessão com o segundo fator
      // verificado: o código é pedido agora, e o convite segue depois dele.
      void exigir(() =>
        convidar.mutate(paraConvite(valores), {
          onSuccess: () => navigate("/usuarios"),
          // Conta e perfil ficaram criados e só o e-mail não saiu: a lista tem
          // a linha, com "Reenviar convite" — ficar aqui convidaria a
          // cadastrar de novo.
          onError: (falha) => {
            const sentinela = (falha as { details?: { sentinela?: string } }).details?.sentinela;
            if (sentinela === "invite_failed") navigate("/usuarios");
          },
        }),
      );
      return;
    }

    criar.mutate(entrada, { onSuccess: () => navigate("/usuarios") });
  };

  const trocarModo = (proximo: string) => {
    form.clearErrors();
    form.setValue("modo", proximo as ModoCadastro);
  };

  const areaPrincipal = (principal || especialidades[0]) as Especialidade | undefined;
  const conselho = areaPrincipal ? CONSELHO_POR_ESPECIALIDADE[areaPrincipal] : null;
  const clinico = papel === PAPEL.PROFISSIONAL;

  const opcoesDeConta = (contas.data ?? []).map((conta) => ({
    value: conta.id,
    label: `${conta.nome} · ${conta.email}`,
  }));

  const pessoa = edicao
    ? usuario?.nome
    : convite
      ? nome.trim() || undefined
      : opcoesDeConta.find((opcao) => opcao.value === contaEscolhida)?.label;

  const passos = convite
    ? [
        "O painel pede o código do seu aplicativo autenticador.",
        "A pessoa recebe o e-mail e cria a própria senha.",
        "O perfil fica pendente e passa a valer quando ela abre o link.",
      ]
    : [
        "O perfil passa a valer na hora para a conta escolhida.",
        "O segundo fator é cadastrado pela própria pessoa e, se ela o perder, é redefinido na lista de usuários.",
      ];

  return (
    <div className="flex flex-col gap-5">
      {cabecalho}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(enviar)} noValidate className={GRADE}>
          <Card>
            <CardContent className="divide-border flex flex-col divide-y">
              {!edicao && (
                <FormSection title="Como a pessoa entra">
                  <Tabs value={modo} onValueChange={trocarModo}>
                    {/* The labels wrap on a phone instead of pushing the card
                        past the screen edge. */}
                    <TabsList
                      aria-label="Como a pessoa entra"
                      className="w-full group-data-[orientation=horizontal]/tabs:h-auto"
                    >
                      <TabsTrigger
                        value={MODO_CADASTRO.CONVITE}
                        className="min-h-8 whitespace-normal"
                      >
                        Convidar pessoa nova
                      </TabsTrigger>
                      <TabsTrigger
                        value={MODO_CADASTRO.CONCESSAO}
                        className="min-h-8 whitespace-normal"
                      >
                        Conceder a quem já tem conta
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FormSection>
              )}

              <FormSection title="Identificação">
                <div className="grid items-start gap-4 md:grid-cols-2">
                  {edicao ? (
                    // Read-only and not a form field: the form parts need a
                    // `FormField` around them and would throw here, so it is a
                    // plain label + input.
                    <div className="grid gap-2 md:col-span-2">
                      <Label htmlFor="conta-do-usuario">Conta</Label>
                      <Input
                        id="conta-do-usuario"
                        aria-describedby="conta-do-usuario-descricao"
                        value={`${usuario?.nome} · ${usuario?.email}`}
                        disabled
                        readOnly
                      />
                      <p id="conta-do-usuario-descricao" className="text-muted-foreground text-sm">
                        Nome e e-mail são da conta, e quem os corrige é a própria pessoa.
                      </p>
                    </div>
                  ) : convite ? (
                    <>
                      <FormField
                        control={form.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome completo</FormLabel>
                            <FormControl>
                              <Input {...field} autoComplete="off" placeholder="Maria da Silva" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                                autoComplete="off"
                                placeholder="nome@clinica.com.br"
                              />
                            </FormControl>
                            <FormDescription>
                              O convite é enviado para este endereço.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  ) : (
                    <FormField
                      control={form.control}
                      name="account_id"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
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
                </div>
              </FormSection>

              <FormSection
                title="Papel"
                description={
                  edicao ? "Trocar de papel é ato próprio, não edição de cadastro." : undefined
                }
              >
                <FormField
                  control={form.control}
                  name="papel"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        {/* Native radios: arrow keys and the checked state come
                            from the browser, the cards are only their labels. */}
                        <fieldset disabled={edicao} className="grid gap-3 md:grid-cols-2">
                          <legend className="sr-only">Papel</legend>
                          {OPCOES_DE_PAPEL.map(({ value, descricao, Icone }) => {
                            const escolhido = field.value === value;

                            return (
                              <label
                                key={value}
                                className={cn(
                                  "has-focus-visible:ring-ring/50 flex cursor-pointer items-center gap-3.5 rounded-xl border px-4 py-3.5 transition-colors has-focus-visible:ring-2 has-disabled:cursor-not-allowed",
                                  escolhido
                                    ? "border-primary bg-primary/5"
                                    : "border-border bg-card hover:border-primary/40 has-disabled:opacity-50 has-disabled:hover:border-border",
                                )}
                              >
                                <input
                                  type="radio"
                                  name={field.name}
                                  value={value}
                                  checked={escolhido}
                                  onChange={() => field.onChange(value)}
                                  onBlur={field.onBlur}
                                  className="sr-only"
                                />
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors",
                                    escolhido
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  <Icone size={18} />
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <span className="text-sm font-medium">{PAPEL_LABEL[value]}</span>
                                  <span className="text-muted-foreground text-xs leading-relaxed">
                                    {descricao}
                                  </span>
                                </span>
                                {escolhido && (
                                  <CircleCheck
                                    size={18}
                                    aria-hidden="true"
                                    className="text-primary-ink shrink-0"
                                  />
                                )}
                              </label>
                            );
                          })}
                        </fieldset>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>

              {clinico && (
                <FormSection
                  title="Áreas de atuação"
                  description="Cada área abre a leitura daquele espaço de trabalho. Retirar uma encerra a vigência e mantém o histórico."
                >
                  <FormField
                    control={form.control}
                    name="especialidades"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <fieldset className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
                            <legend className="sr-only">Áreas de atuação</legend>
                            {ESPECIALIDADES.map((especialidade) => (
                              <BlocoEspecialidade
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid items-start gap-4 md:grid-cols-2">
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
                            <Input
                              {...field}
                              placeholder={conselho ? `${conselho}/SC 00000` : "Escolha uma área"}
                            />
                          </FormControl>
                          <FormDescription>Obrigatório para o perfil clínico.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </FormSection>
              )}
            </CardContent>
          </Card>

          {/* Resumo: o que a combinação produz e o que acontece no clique. */}
          <aside aria-label="Resumo" className="flex flex-col gap-4 xl:sticky xl:top-6">
            <Card className="divide-border gap-0 divide-y py-0">
              <div className="flex flex-col gap-3 px-5 py-4">
                <SectionHeading>Resumo</SectionHeading>
                <dl className="flex flex-col gap-2.5">
                  <DetailRow label="Entrada">
                    {edicao || !convite ? "Conta existente" : "Convite por e-mail"}
                  </DetailRow>
                  <DetailRow label="Pessoa">
                    {pessoa && <span className="break-words">{pessoa}</span>}
                  </DetailRow>
                  <DetailRow label="Papel">{PAPEL_LABEL[papel]}</DetailRow>
                  {clinico && (
                    <>
                      <DetailRow label="Áreas">
                        {especialidades.length > 0
                          ? especialidades.map((area) => ESPECIALIDADE_LABEL[area]).join(", ")
                          : undefined}
                      </DetailRow>
                      <DetailRow label="Área principal">
                        {areaPrincipal ? ESPECIALIDADE_LABEL[areaPrincipal] : undefined}
                      </DetailRow>
                      <DetailRow label={conselho ?? "Registro"}>
                        {registro.trim() ? (
                          <span className="break-all tabular-nums">{registro}</span>
                        ) : undefined}
                      </DetailRow>
                    </>
                  )}
                </dl>
              </div>

              {!edicao && (
                <div className="flex flex-col gap-3 px-5 py-4">
                  <SectionHeading>
                    {convite ? "Ao enviar o convite" : "Ao conceder o perfil"}
                  </SectionHeading>
                  <Passos itens={passos} />
                </div>
              )}

              {/* O que este papel realmente abre, resolvido pela camada de dados. */}
              {edicao && usuario && (
                <div className="flex flex-col gap-3 px-5 py-4">
                  <SectionHeading>
                    Acesso efetivo · {usuario.permissoes_efetivas.length} permissões
                  </SectionHeading>
                  <ul className="flex flex-wrap gap-1.5">
                    {usuario.permissoes_efetivas.map((permissao) => (
                      <li key={permissao}>
                        <StatusBadge tone="neutral" size="sm">
                          {PERMISSAO_LABEL[permissao]}
                        </StatusBadge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-2 px-5 py-4">
                <Button type="submit" disabled={salvando} className="w-full">
                  {salvando ? (
                    <LoaderCircle className="animate-spin" />
                  ) : convite ? (
                    <Send />
                  ) : (
                    <Check />
                  )}
                  {edicao ? "Salvar alterações" : convite ? "Enviar convite" : "Conceder perfil"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate("/usuarios")}
                >
                  Cancelar
                </Button>
              </div>
            </Card>

            <Footnote>
              Tratamento e janela de atendimento no chat não são configurados aqui: não têm onde ser
              guardados.
            </Footnote>
          </aside>
        </form>
      </Form>

      {dialogo}
    </div>
  );
}

export default UsuarioFormPage;
