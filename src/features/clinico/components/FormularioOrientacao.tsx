import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, MessageSquareWarning, Save, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { FormSelect, MarkdownEditor, StatusBadge, TONE_CONTENT_STATUS } from "@/components/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { isEditableStatus } from "@/lib/content";
import {
  ACAO_REVISAO,
  STATUS_CONTEUDO_LABEL,
  TIPO_CONTEUDO,
  TIPO_CONTEUDO_LABEL,
  toOptions,
} from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import type { ConteudoDetalhe, ConteudoEntrada } from "@/types/conteudo";
import {
  useCategoriasDaMinhaArea,
  useCriarOrientacao,
  useEnviarParaRevisao,
  useSalvarOrientacao,
} from "../hooks/useOrientacoes";
import { orientacaoSchema, type OrientacaoForm } from "../schemas";
import { AnexosDaOrientacao } from "./AnexosDaOrientacao";
import { SeletorCids } from "./SeletorCids";

/**
 * O formulário de uma orientação: a nova, ou o rascunho aberto para edição.
 *
 * Duas ações, com pesos diferentes. Salvar rascunho é livre e repetível. Enviar
 * para revisão é o ponto sem volta do texto: o banco não deixa mudar título,
 * texto, tipo ou vídeo depois disso, para que o administrador não aprove uma
 * coisa e o paciente receba outra — e é por isso que pede confirmação.
 *
 * Só o autor edita, e só em rascunho ou devolvida. Tudo o mais abre em leitura
 * (`LeituraDaOrientacao`).
 */

const OPCOES_DE_TIPO = toOptions(TIPO_CONTEUDO_LABEL);

function valoresIniciais(orientacao?: ConteudoDetalhe): OrientacaoForm {
  return {
    titulo: orientacao?.titulo ?? "",
    categoria_id: orientacao?.categoria_id ?? "",
    tipo: orientacao?.tipo ?? TIPO_CONTEUDO.ARTIGO,
    corpo: orientacao?.corpo ?? "",
    video_url: orientacao?.video_url ?? "",
    minutos_leitura: orientacao?.minutos_leitura ?? null,
    cids: orientacao?.cids.map((cid) => cid.code) ?? [],
  };
}

function paraEntrada(valores: OrientacaoForm): ConteudoEntrada {
  return {
    titulo: valores.titulo,
    corpo: valores.corpo,
    categoria_id: valores.categoria_id,
    tipo: valores.tipo,
    video_url: valores.tipo === TIPO_CONTEUDO.VIDEO ? valores.video_url : null,
    minutos_leitura: valores.minutos_leitura,
    cids: valores.cids,
  };
}

export function FormularioOrientacao({
  orientacao,
  basePath,
}: {
  orientacao?: ConteudoDetalhe;
  /** `/clinico/:especialidade/conteudo` — para onde ir depois de criar. */
  basePath: string;
}) {
  const navigate = useNavigate();
  const categorias = useCategoriasDaMinhaArea();
  const criar = useCriarOrientacao();
  const salvar = useSalvarOrientacao();
  const enviar = useEnviarParaRevisao();

  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);

  const form = useForm<OrientacaoForm>({
    resolver: zodResolver(orientacaoSchema),
    defaultValues: valoresIniciais(orientacao),
  });

  const tipo = form.watch("tipo");
  const ocupado = criar.isPending || salvar.isPending || enviar.isPending;
  const editavel = !orientacao || isEditableStatus(orientacao.status);

  const opcoesDeCategoria = (categorias.data ?? []).map((categoria) => ({
    value: categoria.id,
    label: categoria.label,
  }));

  /** Grava o que está na tela. Devolve o id da versão, ou `null` se algo recusou. */
  const gravar = async (valores: OrientacaoForm): Promise<string | null> => {
    if (!orientacao) {
      const criada = await criar.mutateAsync(paraEntrada(valores)).catch(() => null);
      return criada?.id ?? null;
    }

    const salva = await salvar
      .mutateAsync({ id: orientacao.id, dados: paraEntrada(valores) })
      .catch(() => null);
    return salva ? orientacao.id : null;
  };

  const salvarRascunho = form.handleSubmit(async (valores) => {
    const id = await gravar(valores);
    if (!id) return;

    toast.success("Rascunho salvo");

    if (!orientacao) navigate(`${basePath}/${id}`, { replace: true });
    else form.reset(valores);
  });

  const enviarParaRevisao = form.handleSubmit(async (valores) => {
    setConfirmandoEnvio(false);

    // Salva antes de enviar: o que vai para o revisor é o que está na tela.
    const id = await gravar(valores);
    if (!id) return;

    const enviada = await enviar.mutateAsync(id).catch(() => null);
    if (enviada) navigate(basePath, { replace: true });
    // Se o envio recusou (PDF sem arquivo, por exemplo), o rascunho ficou salvo.
    else if (!orientacao) navigate(`${basePath}/${id}`, { replace: true });
  });

  /**
   * Confere o formulário ANTES de perguntar se a pessoa quer enviar. O diálogo
   * abria com o formulário vazio e só depois do "sim" os campos apontavam o que
   * faltava — a confirmação de um ato que ia falhar. Com erro, o foco vai para o
   * primeiro campo inválido e a pergunta não aparece.
   */
  const pedirConfirmacaoDeEnvio = async () => {
    const valido = await form.trigger(undefined, { shouldFocus: true });
    if (valido) setConfirmandoEnvio(true);
  };

  const comentarioDeDevolucao =
    orientacao?.revisoes[0]?.acao === ACAO_REVISAO.DEVOLVER ? orientacao.revisoes[0] : null;

  return (
    <Form {...form}>
      <form onSubmit={salvarRascunho} noValidate className="flex max-w-3xl flex-col gap-6">
        {orientacao && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={TONE_CONTENT_STATUS[orientacao.status]} dot>
              {STATUS_CONTEUDO_LABEL[orientacao.status]}
            </StatusBadge>
            <span className="text-muted-foreground text-xs">
              Versão {orientacao.versao} · salva em {formatDateTime(orientacao.atualizado_em)}
            </span>
          </div>
        )}

        {comentarioDeDevolucao && (
          <Alert>
            <MessageSquareWarning />
            <AlertTitle>Devolvida para ajustes por {comentarioDeDevolucao.revisor_nome}</AlertTitle>
            <AlertDescription>
              <p className="whitespace-pre-line">{comentarioDeDevolucao.comentario}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Ajuste o texto e envie de novo para a revisão.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="titulo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input {...field} disabled={!editavel || ocupado} autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid items-start gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="categoria_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <FormSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  options={opcoesDeCategoria}
                  placeholder={categorias.isLoading ? "Carregando…" : "Escolha a categoria"}
                  disabled={!editavel || ocupado}
                />
                <FormDescription>
                  {categorias.isError
                    ? "Não foi possível carregar as categorias."
                    : opcoesDeCategoria.length === 0 && !categorias.isLoading
                      ? "Sua especialidade não tem categoria ativa: peça ao administrador para cadastrá-la."
                      : "Só as categorias da sua especialidade."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <FormSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  options={OPCOES_DE_TIPO}
                  disabled={!editavel || ocupado}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {tipo === TIPO_CONTEUDO.VIDEO && (
          <FormField
            control={form.control}
            name="video_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Link do vídeo</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="url"
                    inputMode="url"
                    placeholder="https://www.youtube.com/watch?v=…"
                    disabled={!editavel || ocupado}
                  />
                </FormControl>
                <FormDescription>Só links https do YouTube ou do Vimeo.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="corpo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Texto</FormLabel>
              <MarkdownEditor
                id="orientacao-corpo"
                value={field.value}
                onChange={field.onChange}
                disabled={!editavel || ocupado}
                invalid={Boolean(form.formState.errors.corpo)}
                placeholder="Escreva a orientação. Use a barra para negrito, títulos e listas."
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="minutos_leitura"
          render={({ field }) => (
            <FormItem className="sm:max-w-48">
              <FormLabel>Tempo de leitura (min)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={field.value ?? ""}
                  onChange={(evento) => {
                    const texto = evento.target.value;
                    field.onChange(texto === "" ? null : Number(texto));
                  }}
                  disabled={!editavel || ocupado}
                />
              </FormControl>
              <FormDescription>Opcional.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cids"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Marcação por CID-10</FormLabel>
              <SeletorCids
                value={field.value}
                onChange={field.onChange}
                disabled={!editavel || ocupado}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <section aria-labelledby="anexos-titulo" className="flex flex-col gap-2">
          <h2 id="anexos-titulo" className="text-sm font-medium">
            Arquivos anexos
          </h2>

          {orientacao ? (
            <AnexosDaOrientacao
              versaoId={orientacao.id}
              anexos={orientacao.anexos}
              editavel={editavel}
            />
          ) : (
            <p className="text-muted-foreground text-xs">
              Salve o rascunho primeiro: o anexo pertence à versão, que só existe depois de salva.
            </p>
          )}
        </section>

        {editavel && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button type="submit" disabled={ocupado}>
              {criar.isPending || salvar.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}
              Salvar rascunho
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={() => void pedirConfirmacaoDeEnvio()}
            >
              {enviar.isPending ? <LoaderCircle className="animate-spin" /> : <Send />}
              Enviar para revisão
            </Button>

            <Button type="button" variant="ghost" disabled={ocupado} onClick={() => navigate(basePath)}>
              Voltar
            </Button>
          </div>
        )}
      </form>

      <AlertDialog open={confirmandoEnvio} onOpenChange={setConfirmandoEnvio}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar para revisão?</AlertDialogTitle>
            <AlertDialogDescription>
              Depois de enviada, o texto não pode mais ser alterado até o administrador decidir. Se
              ele devolver, você volta a editar; se aprovar, a orientação chega aos pacientes
              elegíveis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar ao rascunho</AlertDialogCancel>
            <AlertDialogAction onClick={() => void enviarParaRevisao()}>
              Enviar para revisão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}

export default FormularioOrientacao;
