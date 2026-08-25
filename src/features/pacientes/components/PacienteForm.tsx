import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
import { Textarea } from "@/components/ui/textarea";
import { useCids, useEfeitosAdversos, useProtocolos } from "@/hooks/useCatalogos";
import { useProfissionais } from "@/hooks/useEquipe";
import {
  ESPECIALIDADE,
  FASE_TRATAMENTO_LABEL,
  RISCO_LABEL,
  toOptions,
} from "@/lib/enums";
import { cn } from "@/lib/utils";
import { aplicarMascaraCpf, aplicarMascaraTelefone } from "@/lib/validacao";
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
 * Etapas e não uma página longa: são dezesseis campos de naturezas diferentes —
 * quem cadastra na recepção preenche identificação e contato; quem completa o
 * diagnóstico é a equipe clínica. Dividir deixa cada parte revisável sozinha.
 *
 * > [!] O rascunho vive em memória, e só.
 * Nada é gravado em `localStorage` nem em `sessionStorage`: o formulário
 * carrega nome, CPF e diagnóstico de uma pessoa real, e o projeto proíbe PHI
 * persistida no navegador. Trocar de etapa preserva o preenchimento; fechar a
 * aba, não — e é assim que deve ser.
 */

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

  const cids = useCids();
  const protocolos = useProtocolos();
  const efeitos = useEfeitosAdversos();
  const { profissionais } = useProfissionais(ESPECIALIDADE.MEDICO);

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
                        <Input {...field} autoComplete="off" placeholder="Como consta no documento" />
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
                          onChange={(evento) => field.onChange(aplicarMascaraCpf(evento.target.value))}
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

                <FormField
                  control={form.control}
                  name="nascimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de nascimento</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sexo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sexo</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="feminino">Feminino</SelectItem>
                          <SelectItem value="masculino">Masculino</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* --------------------------------------------- 2 · diagnóstico */}
            {etapa === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="cid"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>CID-10</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione o diagnóstico" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(cids.data ?? []).map((cid) => (
                            <SelectItem key={cid.codigo} value={cid.codigo}>
                              {cid.codigo} · {cid.descricao}
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
                  name="protocolo_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protocolo terapêutico</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione o protocolo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(protocolos.data ?? []).map((protocolo) => (
                            <SelectItem key={protocolo.id} value={protocolo.id}>
                              {protocolo.nome}
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
                  name="medico_responsavel_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Médico responsável</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {profissionais.map((profissional) => (
                            <SelectItem key={profissional.id} value={profissional.id}>
                              {profissional.nome}
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
                  name="fase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fase do tratamento</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full capitalize">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {toOptions(FASE_TRATAMENTO_LABEL).map((opcao) => (
                            <SelectItem key={opcao.value} value={opcao.value} className="capitalize">
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
                  name="risco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Classificação de risco</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {toOptions(RISCO_LABEL).map((opcao) => (
                            <SelectItem key={opcao.value} value={opcao.value}>
                              {opcao.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Definida pela equipe assistencial.</FormDescription>
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
                        <Input {...field} placeholder="IIIA" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="diagnostico_em"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data do diagnóstico</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          label="Adicionar alergia"
                          placeholder="Digite e pressione Enter"
                        />
                      </FormControl>
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

                <FormField
                  control={form.control}
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} maxLength={1000} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          onChange={(evento) =>
                            field.onChange(aplicarMascaraTelefone(evento.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {edicao
                          ? "Deixe em branco para manter o número atual."
                          : "É para cá que vai o convite por SMS."}
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

                {!edicao && (
                  <FormField
                    control={form.control}
                    name="enviar_convite"
                    render={({ field }) => (
                      <FormItem className="border-border flex items-center justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
                        <div className="flex flex-col gap-0.5">
                          <FormLabel>Enviar convite por SMS agora</FormLabel>
                          <FormDescription>
                            O paciente recebe o link de primeiro acesso ao aplicativo.
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
            <Button type="submit" disabled={salvando}>
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
