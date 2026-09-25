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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCids, useEfeitosAdversos, useFasesTratamento } from "@/hooks/useCatalogos";
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
 * Cadastro e edição de paciente, em quatro etapas.
 *
 * Etapas e não uma página longa: identificação, histórico, quadro clínico e
 * contato são conversas diferentes, e cada uma tem o seu dono — a recepção
 * preenche a primeira e a última, a enfermagem confere a segunda, e a terceira
 * vem do laudo. Dividir deixa cada parte revisável sozinha.
 *
 * > [!] O rascunho vive em memória, e só.
 * Nada é gravado em `localStorage` nem em `sessionStorage`: o formulário
 * carrega nome, CPF e histórico de uma pessoa real, e o projeto proíbe PHI
 * persistida no navegador. Trocar de etapa preserva o preenchimento; fechar a
 * aba, não — e é assim que deve ser.
 *
 * > [!] A etapa 3 grava por uma porta diferente das outras três.
 * Identificação, histórico e contato saem em `paraEntrada`; o quadro clínico
 * sai em `paraClinica` e vira uma operação própria. A diferença não é
 * organizacional: do lado do banco são escritas distintas, e duas delas
 * ACRESCENTAM um registro datado em vez de sobrescrever. Por isso o vazio ali
 * significa "não mexer".
 */

/** Campo de data ligado ao formulário em volta. */
function CampoData({
  name,
  rotulo,
  descricao,
}: {
  name: "nascimento" | "diagnostico_em" | "plano_iniciado_em";
  rotulo: string;
  descricao?: string;
}) {
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
          {descricao && <FormDescription>{descricao}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** O aviso da etapa clínica. Diz o peso do que está sendo registrado. */
function AvisoAtoClinico({ edicao }: { edicao: boolean }) {
  return (
    <div className="border-border bg-muted/40 text-muted-foreground flex gap-2.5 rounded-lg border p-3 text-xs sm:col-span-2">
      <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p>
        <span className="text-foreground font-medium">
          Registrar diagnóstico e protocolo é ato clínico.
        </span>{" "}
        Cada campo desta etapa fica na trilha de auditoria com o seu nome e o
        horário.{" "}
        {edicao
          ? "Trocar o protocolo encerra o plano vigente e abre um novo — o anterior continua no histórico, com as datas que teve."
          : "Todos são opcionais: a ficha pode nascer sem eles e recebê-los depois, quando o diagnóstico sair."}
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
  const cids = useCids();
  const fases = useFasesTratamento();

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
  const fontesObrigatorias = [
    { label: "a lista de efeitos adversos", query: efeitos },
    { label: "o catálogo de CID-10", query: cids },
    { label: "as fases de tratamento", query: fases },
  ].filter((fonte) => fonte.query.isError);

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
        {/* Phone: one line and a bar. The four chips broke into two rows of
            26px targets there, and moving between steps already has the
            Voltar and Continuar buttons at the bottom. */}
        <div className="flex flex-col gap-2 sm:hidden">
          <p className="text-sm">
            <span className="text-muted-foreground tabular-nums">
              Etapa {etapa + 1} de {ETAPAS.length} ·{" "}
            </span>
            <span className="font-medium">{atual?.titulo}</span>
          </p>
          <div
            role="progressbar"
            aria-label="Progresso do cadastro"
            aria-valuemin={1}
            aria-valuemax={ETAPAS.length}
            aria-valuenow={etapa + 1}
            className="bg-muted h-1.5 overflow-hidden rounded-full"
          >
            <div
              className="bg-primary h-full rounded-full transition-[width] motion-reduce:transition-none"
              style={{ width: `${((etapa + 1) / ETAPAS.length) * 100}%` }}
            />
          </div>
        </div>

        <ol className="hidden flex-wrap items-center gap-2 sm:flex" aria-label="Etapas do cadastro">
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
                    "flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors max-md:min-h-10",
                    ativa && "border-primary/30 bg-primary/10 text-primary font-medium",
                    concluida && !ativa && "border-border text-muted-foreground hover:bg-muted",
                    !ativa && !concluida && "border-border text-muted-foreground/70",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full text-[11px]",
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
            {/* `items-start` in every step grid: stretched to the row height, a
                field without help text spread the extra height between its
                own rows, and its input sat ~5px below the one beside it. */}
            {etapa === 0 && (
              <div className="grid items-start gap-4 sm:grid-cols-2">
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
              <div className="grid items-start gap-4 sm:grid-cols-2">
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

              </div>
            )}

            {/* ------------------------------------------ 3 · quadro clínico */}
            {etapa === 2 && (
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="cid"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Diagnóstico (CID-10)</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione o código" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(cids.data ?? []).map((cid) => (
                            <SelectItem key={cid.codigo} value={cid.codigo}>
                              <span className="font-mono text-xs">{cid.codigo}</span>
                              {" · "}
                              {cid.descricao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Estadiamento e TNM pertencem a este diagnóstico — sem o código, não
                        há onde gravá-los.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estadiamento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estadiamento</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" placeholder="IIIA" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tnm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TNM</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" placeholder="T2 N1 M0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <CampoData
                  name="diagnostico_em"
                  rotulo="Data do diagnóstico"
                  descricao="Quando o laudo saiu, não quando a ficha foi aberta."
                />

                <FormField
                  control={form.control}
                  name="fase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fase do tratamento</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione a fase" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(fases.data ?? []).map((opcao) => (
                            <SelectItem key={opcao.value} value={opcao.value}>
                              <span className="capitalize">{opcao.label}</span>
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
                  name="protocolo_nome"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Protocolo terapêutico</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" placeholder="FOLFOX, AC-T, Carbo-Taxol…" />
                      </FormControl>
                      <FormDescription>
                        Texto livre: não há catálogo de protocolos no sistema. Escreva como a
                        equipe escreve, para o relatório agrupar certo.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ciclos_previstos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ciclos previstos</FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="numeric" placeholder="6" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="intencao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intenção terapêutica</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" placeholder="Curativa, adjuvante…" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <CampoData
                  name="plano_iniciado_em"
                  rotulo="Início do tratamento"
                  descricao={
                    edicao
                      ? "Em branco mantém a data do plano vigente."
                      : "Em branco assume a data de hoje."
                  }
                />

                <AvisoAtoClinico edicao={edicao} />
              </div>
            )}

            {/* ------------------------------------------------- 4 · contato */}
            {etapa === 3 && (
              <div className="grid items-start gap-4 sm:grid-cols-2">
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
