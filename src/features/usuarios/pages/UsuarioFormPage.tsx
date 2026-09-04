import { zodResolver } from "@hookform/resolvers/zod";
import { Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

import { BackendPendente, ErrorState, PageHeader, SkeletonForm, StatusBadge } from "@/components/shared";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CONSELHO_POR_ESPECIALIDADE,
  ESPECIALIDADE_LABEL,
  PAPEL,
  PAPEL_LABEL,
  toOptions,
  type Especialidade,
} from "@/lib/enums";
import { PERMISSAO_LABEL } from "@/lib/rbac";
import { motivoIndisponivel } from "@/services/apiClient";
import { useAtualizarUsuario, useCriarUsuario, useUsuario } from "../hooks/useUsuarios";
import { paraEntrada, usuarioSchema, VALORES_INICIAIS, type UsuarioForm as Valores } from "../schemas";

/**
 * Cadastro e edição de profissional.
 *
 * O papel define o que a pessoa pode; a especialidade define onde ela trabalha
 * e concede o que nenhum papel herda. O formulário mostra as duas coisas lado a
 * lado e resume, ao final, o acesso que a combinação produz — para que ninguém
 * descubra o alcance de um papel só depois de conceder.
 */

/** O <Select> do Radix reserva o valor vazio para "nada selecionado". */
const SEM_ESPECIALIDADE = "nenhuma";

export function UsuarioFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const edicao = Boolean(id);

  const { data: usuario, isLoading, isError, error, refetch } = useUsuario(id);
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
      nome: usuario.nome,
      tratamento: usuario.tratamento ?? "",
      email: usuario.email,
      papel: usuario.papel,
      especialidade: usuario.especialidade ?? "",
      registro: usuario.registro ?? "",
      horario_inicio: usuario.horario_inicio ?? "08:00",
      horario_fim: usuario.horario_fim ?? "18:00",
      mfa_ativo: usuario.mfa_ativo ?? true,
    });
  }, [usuario, form]);

  const papel = form.watch("papel");
  const especialidade = form.watch("especialidade");
  const salvando = criar.isPending || atualizar.isPending;

  if (edicao && isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader eyebrow="Gestão" title="Editar profissional" />
        <SkeletonForm fields={7} className="max-w-2xl" />
      </div>
    );
  }

  if (edicao && (isError || !usuario)) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  // A rota é alcançável pela URL mesmo com o botão desabilitado na listagem.
  const indisponivel = motivoIndisponivel(edicao ? "usuarios.update" : "usuarios.create");

  if (indisponivel) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          eyebrow="Gestão"
          title={edicao ? `Editar ${usuario?.nome}` : "Novo usuário"}
          breadcrumb={[
            { label: "Usuários", to: "/usuarios" },
            { label: edicao ? (usuario?.nome ?? "Editar") : "Novo usuário" },
          ]}
        />
        <BackendPendente
          titulo={edicao ? "Edição de profissional" : "Cadastro de profissional"}
          motivo={indisponivel}
        />
      </div>
    );
  }

  const enviar = (valores: Valores) => {
    const entrada = paraEntrada(valores);

    if (edicao) atualizar.mutate(entrada, { onSuccess: () => navigate("/usuarios") });
    else criar.mutate(entrada, { onSuccess: () => navigate("/usuarios") });
  };

  const conselho = especialidade
    ? CONSELHO_POR_ESPECIALIDADE[especialidade as Especialidade]
    : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Gestão"
        title={edicao ? `Editar ${usuario?.nome}` : "Novo usuário"}
        level="MVP"
        breadcrumb={[
          { label: "Usuários", to: "/usuarios" },
          { label: edicao ? (usuario?.nome ?? "Editar") : "Novo usuário" },
        ]}
        subtitle={
          edicao
            ? "Alterações de papel e permissão ficam registradas na trilha de auditoria."
            : "O profissional recebe por e-mail o link para definir a própria senha."
        }
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(enviar)}
          noValidate
          className="flex max-w-2xl flex-col gap-5"
        >
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="tratamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tratamento</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Dra." />
                    </FormControl>
                    <FormDescription>Opcional.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>E-mail corporativo</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="nome.sobrenome@cosc.com.br" />
                    </FormControl>
                    <FormDescription>É com ele que a pessoa entra no painel.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="papel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Papel</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {toOptions(PAPEL_LABEL).map((opcao) => (
                          <SelectItem key={opcao.value} value={opcao.value}>
                            {opcao.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="especialidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidade</FormLabel>
                    <Select
                      value={field.value || SEM_ESPECIALIDADE}
                      onValueChange={(valor) =>
                        field.onChange(valor === SEM_ESPECIALIDADE ? "" : valor)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SEM_ESPECIALIDADE}>Nenhuma</SelectItem>
                        {toOptions(ESPECIALIDADE_LABEL).map((opcao) => (
                          <SelectItem key={opcao.value} value={opcao.value}>
                            {opcao.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {papel === PAPEL.PROFISSIONAL
                        ? "Define o espaço de trabalho da pessoa."
                        : "Administração e gestão não ocupam vaga na equipe assistencial."}
                    </FormDescription>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="horario_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Início do atendimento</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="horario_fim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fim do atendimento</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormDescription>Janela de resposta no chat.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mfa_ativo"
                render={({ field }) => (
                  <FormItem className="border-border flex items-center justify-between gap-4 rounded-lg border p-3 sm:col-span-3">
                    <div className="flex flex-col gap-0.5">
                      <FormLabel>Exigir segundo fator no login</FormLabel>
                      <FormDescription>
                        Obrigatório para quem acessa dados de paciente. Desligar é exceção.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
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
              {edicao ? "Salvar alterações" : "Cadastrar profissional"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default UsuarioFormPage;
