import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Info, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm, useFormContext } from "react-hook-form";

import { SourceErrorAlert } from "@/components/shared";
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
import { Switch } from "@/components/ui/switch";
import { useEfeitosAdversos } from "@/hooks/useCatalogos";
import { cn } from "@/lib/utils";
import { applyCpfMask, applyPhoneMask } from "@/lib/validation";
import {
  ETAPAS,
  pacienteEdicaoSchema,
  pacienteSchema,
  type PacienteForm as Valores,
} from "../schemas";
import { ListaDeChips, SelecaoDeCatalogo } from "./ListaDeChips";

/**
 * Cadastro e edição de paciente, em três etapas.
 *
 * Etapas e não uma página longa: identificação, histórico e contato são três
 * conversas diferentes — quem cadastra na recepção preenche a primeira e a
 * terceira, e a segunda é o que a enfermagem confere. Dividir deixa cada parte
 * revisável sozinha.
 *
 * > [!] O rascunho vive em memória, e só.
 * Nada é gravado em `localStorage` nem em `sessionStorage`: o formulário
 * carrega nome, CPF e histórico de uma pessoa real, e o projeto proíbe PHI
 * persistida no navegador. Trocar de etapa preserva o preenchimento; fechar a
 * aba, não — e é assim que deve ser.
 *
 * > [!] Diagnóstico, estadiamento, protocolo e fase NÃO estão aqui.
 * Registrá-los é ato clínico, e se o perfil administrativo pode praticá-lo é
 * pergunta aberta com a clínica. A etapa 2 declara isso em vez de oferecer
 * campos que talvez sejam retirados — perder uma seção é barato, perder a tela
 * inteira não.
 */

/** Campo de data ligado ao formulário em volta. */
function CampoData({ name, rotulo }: { name: "nascimento"; rotulo: string }) {
  const { control } = useFormContext<Valores>();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{rotulo}</FormLabel>
          <FormControl>
            <Input {...field} type="date" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** O aviso da etapa clínica. Diz o que falta e de quem depende. */
function AvisoAtoClinico() {
  return (
    <div className="border-border bg-muted/40 text-muted-foreground flex gap-2.5 rounded-lg border p-3 text-xs sm:col-span-2">
      <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p>
        <span className="text-foreground font-medium">
          Diagnóstico, estadiamento, protocolo e fase não são preenchidos aqui.
        </span>{" "}
        Registrá-los é ato clínico, e ainda não está decidido se o perfil
        administrativo pode praticá-lo. A ficha continua exibindo o que vier do
        sistema do consultório: ler e escrever são permissões diferentes.
      </p>
    </div>
  );
}

export interface PacienteFormProps {
  valoresIniciais: Valores;
  modo: "criacao" | "edicao";
  /** Na edição, o contato atual mascarado — aparece como placeholder. */
  contatoAtual?: { telefone: string; email: string };
  salvando?: boolean;
  onSubmit: (valores: Valores) => void;
  onCancelar: () => void;
}

export function PacienteForm({
  valoresIniciais,
  modo,
  contatoAtual,
  salvando = false,
  onSubmit,
  onCancelar,
}: PacienteFormProps) {
  const [etapa, setEtapa] = useState(0);
  const edicao = modo === "edicao";

  const form = useForm<Valores>({
    resolver: zodResolver(edicao ? pacienteEdicaoSchema : pacienteSchema),
    defaultValues: valoresIniciais,
    mode: "onBlur",
  });

  const efeitos = useEfeitosAdversos();

  /*
   * Na edição, o que já está gravado não pode ser retirado: o histórico clínico
   * é append-only no backend. Os valores iniciais SÃO o que está gravado, então
   * é deles que sai a lista de itens sem X.
   */
  const alergiasGravadas = edicao ? valoresIniciais.alergias : [];
  const reacoesGravadas = edicao ? valoresIniciais.reacoes_previas : [];

  /*
   * Fonte de vocabulário que o cadastro NÃO pode dispensar.
   *
   * `data ?? []` transformava falha de backend em lista vazia, e lista vazia se
   * lê como resposta legítima: "não há efeito cadastrado". Ninguém repete uma
   * requisição que parece ter dado certo, e uma ficha preenchida contra um
   * vocabulário que não carregou fica errada, não incompleta.
   */
  const fontesObrigatorias = [{ label: "a lista de efeitos adversos", query: efeitos }].filter(
    (fonte) => fonte.query.isError,
  );

  const fonteFaltando = fontesObrigatorias.length > 0;

  const atual = ETAPAS[etapa];
  const ultima = etapa === ETAPAS.length - 1;

  const avancar = async () => {
    // Valida só os campos da etapa: exigir o formulário inteiro para passar do
    // primeiro passo mostraria erro em campo que a pessoa ainda não viu.
    const valida = await form.trigger([...(atual?.campos ?? [])]);
    if (valida) setEtapa((anterior) => Math.min(anterior + 1, ETAPAS.length - 1));
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex max-w-3xl flex-col gap-5"
      >
        {/* Vem antes das etapas: quem abre o formulário precisa saber que ele
            não vai salvar antes de preencher três telas. */}
        {fontesObrigatorias.map((fonte) => (
          <SourceErrorAlert
            key={fonte.label}
            label={fonte.label}
            onRetry={() => void fonte.query.refetch()}
          />
        ))}

        {/* --------------------------------------------------------- passos */}
        <ol className="flex flex-wrap items-center gap-2" aria-label="Etapas do cadastro">
          {ETAPAS.map((passo, indice) => {
            const concluida = indice < etapa;
            const ativa = indice === etapa;

            return (
              <li key={passo.id}>
                <button
                  type="button"
                  onClick={() => setEtapa(indice)}
                  aria-current={ativa ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                    ativa && "border-primary/30 bg-primary/10 text-primary font-medium",
                    concluida && !ativa && "border-border text-muted-foreground hover:bg-muted",
                    !ativa && !concluida && "border-border text-muted-foreground/70",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full text-[10px]",
                      ativa || concluida ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {concluida ? <Check size={10} /> : indice + 1}
                  </span>
                  {passo.titulo}
                </button>
              </li>
            );
          })}
        </ol>

        <Card>
          <CardContent className="flex flex-col gap-5 pt-6">
            <div>
              <h2 className="text-base font-semibold">{atual?.titulo}</h2>
              <p className="text-muted-foreground mt-0.5 text-sm">{atual?.descricao}</p>
            </div>

            {/* -------------------------------------------- 1 · identificação */}
            {etapa === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="off"
                          placeholder="Como consta no documento"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="numeric"
                          placeholder="000.000.000-00"
                          disabled={edicao}
                          onChange={(evento) => field.onChange(applyCpfMask(evento.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        {edicao
                          ? "O CPF é a chave do cadastro e não muda pela edição."
                          : "Usado para evitar ficha duplicada."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <CampoData name="nascimento" rotulo="Data de nascimento" />
              </div>
            )}

            {/* ---------------------------------------- 2 · histórico clínico */}
            {etapa === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="alergias"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Alergias</FormLabel>
                      <FormControl>
                        <ListaDeChips
                          valores={field.value}
                          onChange={field.onChange}
                          fixos={alergiasGravadas}
                          label="Adicionar alergia"
                          placeholder="Digite e pressione Enter"
                        />
                      </FormControl>
                      {edicao && (
                        <FormDescription>
                          O que já está registrado não se apaga: o histórico clínico é
                          imutável, e aqui só se acrescenta.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reacoes_previas"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Reações prévias</FormLabel>
                      <FormControl>
                        <SelecaoDeCatalogo
                          opcoes={efeitos.data ?? []}
                          selecionadas={field.value}
                          onChange={field.onChange}
                          fixos={reacoesGravadas}
                          legenda="Reações adversas já apresentadas"
                        />
                      </FormControl>
                      <FormDescription>
                        Mesmos termos que o aplicativo do paciente registra no Diário.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <AvisoAtoClinico />
              </div>
            )}

            {/* ------------------------------------------------- 3 · contato */}
            {etapa === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celular</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="tel"
                          placeholder={edicao ? contatoAtual?.telefone : "(48) 99999-9999"}
                          onChange={(evento) => field.onChange(applyPhoneMask(evento.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        {edicao
                          ? "Deixe em branco para manter o número atual."
                          : "É para cá que vai o convite de acesso."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          autoComplete="off"
                          placeholder={edicao ? contatoAtual?.email : undefined}
                        />
                      </FormControl>
                      {edicao && (
                        <FormDescription>
                          Deixe em branco para manter o endereço atual.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="convenio"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Convênio</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" placeholder="Particular, Unimed…" />
                      </FormControl>
                      <FormDescription>
                        Opcional. Em branco significa não informado.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!edicao && (
                  <FormField
                    control={form.control}
                    name="enviar_convite"
                    render={({ field }) => (
                      <FormItem className="border-border flex items-center justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
                        <div className="flex flex-col gap-0.5">
                          <FormLabel>Emitir convite de acesso agora</FormLabel>
                          <FormDescription>
                            Enquanto não houver envio automático, o código aparece uma vez na
                            tela para ser passado ao paciente.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* -------------------------------------------------------- rodapé */}
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={etapa === 0 ? onCancelar : () => setEtapa((anterior) => anterior - 1)}
          >
            <ArrowLeft />
            {etapa === 0 ? "Cancelar" : "Voltar"}
          </Button>

          {ultima ? (
            <Button
              type="submit"
              disabled={salvando || fonteFaltando}
              title={
                fonteFaltando
                  ? "Uma lista de apoio não carregou. O salvamento volta quando ela carregar."
                  : undefined
              }
            >
              {salvando ? <LoaderCircle className="animate-spin" /> : <Check />}
              {edicao ? "Salvar alterações" : "Cadastrar paciente"}
            </Button>
          ) : (
            <Button type="button" onClick={() => void avancar()}>
              Continuar
              <ArrowRight />
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

export default PacienteForm;
