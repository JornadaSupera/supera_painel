import { useRef, useState } from "react";

import { Clock, ImageUp, MessageSquareText, Palette, Plus, Trash2, X } from "lucide-react";

import { ErrorState, Footnote, SkeletonCards } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClinicaConfiguracao, IntervaloAtendimento, SlideOnboarding } from "@/types/configuracao";
import { PreviewIdentidade } from "./PreviewIdentidade";
import {
  useClinica,
  useSalvarHorario,
  useSalvarIdentidade,
  useSalvarMensagens,
  useUploadLogo,
} from "../hooks/useConfiguracoes";

/**
 * Identidade visual, mensagens e horário de atendimento — `clinic_settings`.
 *
 * Três seções, três RPCs (`set_clinic_branding`, `set_clinic_messages`,
 * `set_clinic_business_hours`), três botões de salvar: cada RPC substitui o
 * GRUPO inteiro que recebe, então não existe "salvar só a cor" sem mandar o
 * logo junto, nem "editar terça" sem mandar a semana inteira.
 *
 * > [!] O logo sobe ANTES de a identidade ser salva.
 * `set_clinic_branding` recusa um caminho que ainda não existe no bucket
 * `clinic-branding` — a ordem é sempre sobe, depois grava. O botão "Salvar
 * identidade" manda o caminho mais recente que o upload devolveu, mesmo que a
 * pessoa ainda não tenha clicado em salvar depois de trocar o logo.
 */

const CORES_PADRAO = { primaria: "#00aa92", secundaria: "#2dc5a6" };
const REGEX_COR = /^#[0-9a-f]{6}$/i;
const MAX_SLIDES = 5;

/* -------------------------------------------------------------------------
   IDENTIDADE VISUAL
   ------------------------------------------------------------------------- */

function SecaoIdentidade() {
  const clinica = useClinica();

  if (clinica.isLoading) return <SkeletonCards count={1} />;
  if (clinica.isError) return <ErrorState error={clinica.error} onRetry={() => void clinica.refetch()} />;
  if (!clinica.data) return null;

  return <FormIdentidade dados={clinica.data} />;
}

/**
 * Só monta depois que `clinica.data` existe — é o que evita o flash de
 * "#00aa92 / sem logo" antes do valor real chegar. Um `useEffect` copiando o
 * dado remoto para o estado local, como antes, sempre desenha o padrão no
 * primeiro commit em que `isLoading` vira `false`, porque o efeito só roda
 * depois: mesma causa do M-10 da auditoria de arquitetura.
 */
function FormIdentidade({ dados }: { dados: ClinicaConfiguracao }) {
  const upload = useUploadLogo();
  const salvar = useSalvarIdentidade();
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const [corPrimaria, setCorPrimaria] = useState(dados.cor_primaria ?? CORES_PADRAO.primaria);
  const [corSecundaria, setCorSecundaria] = useState(dados.cor_secundaria ?? CORES_PADRAO.secundaria);
  const [logo, setLogo] = useState<{ path: string | null; url: string | null }>({
    path: dados.logo_path,
    url: dados.logo_url,
  });

  const corPrimariaValida = REGEX_COR.test(corPrimaria);
  const corSecundariaValida = REGEX_COR.test(corSecundaria);
  const podeSalvar = corPrimariaValida && corSecundariaValida && !upload.isPending;

  return (
    <section className="bg-card rounded-2xl border p-5">
      <header className="mb-4">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <Palette size={15} aria-hidden="true" className="text-muted-foreground" />
          Identidade visual
        </h2>
        <p className="text-muted-foreground text-xs">
          A cor e o logo que o aplicativo do paciente mostra antes do login
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cor-primaria" className="text-xs">
                Cor primária
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Escolher cor primária"
                  value={corPrimariaValida ? corPrimaria : CORES_PADRAO.primaria}
                  onChange={(evento) => setCorPrimaria(evento.target.value)}
                  className="border-input h-9 w-11 shrink-0 rounded-md border p-1"
                />
                <Input
                  id="cor-primaria"
                  value={corPrimaria}
                  maxLength={7}
                  aria-invalid={!corPrimariaValida}
                  className="font-mono text-xs"
                  onChange={(evento) => setCorPrimaria(evento.target.value.toLowerCase())}
                />
              </div>
              {!corPrimariaValida && (
                <p className="text-destructive text-[11px]">Formato esperado: #rrggbb</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cor-secundaria" className="text-xs">
                Cor secundária
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Escolher cor secundária"
                  value={corSecundariaValida ? corSecundaria : CORES_PADRAO.secundaria}
                  onChange={(evento) => setCorSecundaria(evento.target.value)}
                  className="border-input h-9 w-11 shrink-0 rounded-md border p-1"
                />
                <Input
                  id="cor-secundaria"
                  value={corSecundaria}
                  maxLength={7}
                  aria-invalid={!corSecundariaValida}
                  className="font-mono text-xs"
                  onChange={(evento) => setCorSecundaria(evento.target.value.toLowerCase())}
                />
              </div>
              {!corSecundariaValida && (
                <p className="text-destructive text-[11px]">Formato esperado: #rrggbb</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Logo</Label>

            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-muted/40 border-border flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                {logo.url ? (
                  <img src={logo.url} alt="Logo da clínica" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-muted-foreground text-[10px]">Sem logo</span>
                )}
              </div>

              <input
                ref={inputArquivoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Escolher a imagem do logo"
                className="sr-only"
                onChange={(evento) => {
                  const arquivo = evento.target.files?.[0];
                  evento.target.value = "";
                  if (!arquivo) return;

                  upload.mutate(arquivo, {
                    onSuccess: (resultado) => {
                      if (resultado) setLogo({ path: resultado.path, url: resultado.url });
                    },
                  });
                }}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={upload.isPending}
                onClick={() => inputArquivoRef.current?.click()}
              >
                <ImageUp />
                {upload.isPending ? "Enviando…" : "Enviar logo"}
              </Button>

              {logo.url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setLogo({ path: null, url: null })}
                >
                  <Trash2 />
                  Remover
                </Button>
              )}
            </div>

            <p className="text-muted-foreground text-[11px]">
              PNG, JPEG ou WebP, até 2 MB. Fica público — é a mesma imagem que aparece antes do login.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!podeSalvar || salvar.isPending}
              onClick={() =>
                salvar.mutate({ corPrimaria, corSecundaria, logoPath: logo.path })
              }
            >
              {salvar.isPending ? "Salvando…" : "Salvar identidade"}
            </Button>
          </div>
        </div>

        {/* Mostra o que está no formulário, não o que está salvo: é para conferir
            antes de salvar. Cor fora do formato cai no padrão, sem quebrar o desenho. */}
        <PreviewIdentidade
          corPrimaria={corPrimariaValida ? corPrimaria : CORES_PADRAO.primaria}
          corSecundaria={corSecundariaValida ? corSecundaria : CORES_PADRAO.secundaria}
          logoUrl={logo.url}
        />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   MENSAGENS
   ------------------------------------------------------------------------- */

function SecaoMensagens() {
  const clinica = useClinica();

  if (clinica.isLoading) return <SkeletonCards count={1} />;
  if (clinica.isError) return <ErrorState error={clinica.error} onRetry={() => void clinica.refetch()} />;
  if (!clinica.data) return null;

  return <FormMensagens dados={clinica.data} />;
}

/** Só monta depois que `clinica.data` existe — ver o comentário em `FormIdentidade`. */
function FormMensagens({ dados }: { dados: ClinicaConfiguracao }) {
  const salvar = useSalvarMensagens();

  const [slides, setSlides] = useState<SlideOnboarding[]>(dados.slides_onboarding);
  const [mensagemForaHorario, setMensagemForaHorario] = useState(dados.mensagem_fora_horario ?? "");

  const slidesValidos = slides.every(
    (slide) => slide.titulo.trim().length > 0 && slide.corpo.trim().length > 0,
  );

  return (
    <section className="bg-card rounded-2xl border p-5">
      <header className="mb-4">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <MessageSquareText size={15} aria-hidden="true" className="text-muted-foreground" />
          Mensagens
        </h2>
        <p className="text-muted-foreground text-xs">
          O carrossel de boas-vindas do app e a resposta automática fora do horário
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Slides de onboarding</Label>
            <span className="text-muted-foreground text-[11px] tabular-nums">
              {slides.length} de {MAX_SLIDES}
            </span>
          </div>

          {slides.map((slide, indice) => (
            <div key={indice} className="border-border flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    value={slide.titulo}
                    maxLength={80}
                    placeholder="Título do slide"
                    aria-label={`Título do slide ${indice + 1}`}
                    onChange={(evento) => {
                      const titulo = evento.target.value;
                      setSlides((atual) =>
                        atual.map((item, i) => (i === indice ? { ...item, titulo } : item)),
                      );
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover slide ${indice + 1}`}
                  onClick={() => setSlides((atual) => atual.filter((_, i) => i !== indice))}
                >
                  <X />
                </Button>
              </div>

              <Textarea
                value={slide.corpo}
                maxLength={400}
                rows={2}
                placeholder="Texto do slide"
                aria-label={`Corpo do slide ${indice + 1}`}
                onChange={(evento) => {
                  const corpo = evento.target.value;
                  setSlides((atual) =>
                    atual.map((item, i) => (i === indice ? { ...item, corpo } : item)),
                  );
                }}
              />
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={slides.length >= MAX_SLIDES}
            onClick={() => setSlides((atual) => [...atual, { titulo: "", corpo: "" }])}
          >
            <Plus />
            Adicionar slide
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mensagem-fora-horario" className="text-xs">
            Resposta automática fora do horário
          </Label>
          <Textarea
            id="mensagem-fora-horario"
            value={mensagemForaHorario}
            maxLength={1000}
            rows={3}
            placeholder="Deixe em branco para desligar a resposta automática"
            onChange={(evento) => setMensagemForaHorario(evento.target.value)}
          />
          <p className="text-muted-foreground text-[11px]">
            Só chega ao paciente se o horário de atendimento também estiver configurado, abaixo.
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!slidesValidos || salvar.isPending}
            onClick={() =>
              salvar.mutate({
                slidesOnboarding: slides,
                mensagemForaHorario: mensagemForaHorario.trim() || null,
              })
            }
          >
            {salvar.isPending ? "Salvando…" : "Salvar mensagens"}
          </Button>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   HORÁRIO DE ATENDIMENTO
   ------------------------------------------------------------------------- */

const DIAS_SEMANA = [
  { dia_semana: 0, label: "Domingo" },
  { dia_semana: 1, label: "Segunda" },
  { dia_semana: 2, label: "Terça" },
  { dia_semana: 3, label: "Quarta" },
  { dia_semana: 4, label: "Quinta" },
  { dia_semana: 5, label: "Sexta" },
  { dia_semana: 6, label: "Sábado" },
] as const;

type Intervalo = { abre: string; fecha: string };

function LinhaDia({
  label,
  intervalos,
  onChange,
}: {
  label: string;
  intervalos: Intervalo[];
  onChange: (intervalos: Intervalo[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-start sm:gap-4">
      <p className="text-foreground w-20 shrink-0 pt-1.5 text-xs font-medium">{label}</p>

      <div className="flex flex-1 flex-col gap-2">
        {intervalos.length === 0 && (
          <p className="text-muted-foreground text-[11px]">Fechado</p>
        )}

        {intervalos.map((intervalo, indice) => (
          <div key={indice} className="flex items-center gap-2">
            <Input
              type="time"
              value={intervalo.abre}
              aria-label={`${label}, abre`}
              className="w-28"
              onChange={(evento) =>
                onChange(
                  intervalos.map((item, i) =>
                    i === indice ? { ...item, abre: evento.target.value } : item,
                  ),
                )
              }
            />
            <span className="text-muted-foreground text-xs">até</span>
            <Input
              type="time"
              value={intervalo.fecha}
              aria-label={`${label}, fecha`}
              className="w-28"
              onChange={(evento) =>
                onChange(
                  intervalos.map((item, i) =>
                    i === indice ? { ...item, fecha: evento.target.value } : item,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remover intervalo de ${label}`}
              onClick={() => onChange(intervalos.filter((_, i) => i !== indice))}
            >
              <X />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground self-start"
          onClick={() => onChange([...intervalos, { abre: "08:00", fecha: "18:00" }])}
        >
          <Plus />
          Adicionar intervalo
        </Button>
      </div>
    </div>
  );
}

function SecaoHorario() {
  const clinica = useClinica();

  if (clinica.isLoading) return <SkeletonCards count={1} />;
  if (clinica.isError) return <ErrorState error={clinica.error} onRetry={() => void clinica.refetch()} />;
  if (!clinica.data) return null;

  return <FormHorario dados={clinica.data} />;
}

/** Só monta depois que `clinica.data` existe — ver o comentário em `FormIdentidade`. */
function FormHorario({ dados }: { dados: ClinicaConfiguracao }) {
  const salvar = useSalvarHorario();
  const fusoRef = useRef(dados.fuso);

  const [porDia, setPorDia] = useState<Record<number, Intervalo[]>>(() => {
    const agrupado: Record<number, Intervalo[]> = {};
    for (const intervalo of dados.intervalos) {
      const lista = agrupado[intervalo.dia_semana] ?? [];
      lista.push({ abre: intervalo.abre, fecha: intervalo.fecha });
      agrupado[intervalo.dia_semana] = lista;
    }
    return agrupado;
  });

  const todosOsIntervalos: IntervaloAtendimento[] = DIAS_SEMANA.flatMap(({ dia_semana }) =>
    (porDia[dia_semana] ?? []).map((intervalo) => ({ dia_semana, ...intervalo })),
  );

  const algumIntervaloInvalido = todosOsIntervalos.some(
    (intervalo) => !intervalo.abre || !intervalo.fecha || intervalo.abre >= intervalo.fecha,
  );

  return (
    <section className="bg-card rounded-2xl border p-5">
      <header className="mb-2">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <Clock size={15} aria-hidden="true" className="text-muted-foreground" />
          Horário de atendimento
        </h2>
        <p className="text-muted-foreground text-xs">
          Vale para o chat da clínica inteira — não há horário por profissional ou por área
        </p>
      </header>

      <div className="divide-border divide-y">
        {DIAS_SEMANA.map(({ dia_semana, label }) => (
          <LinhaDia
            key={dia_semana}
            label={label}
            intervalos={porDia[dia_semana] ?? []}
            onChange={(intervalos) => setPorDia((atual) => ({ ...atual, [dia_semana]: intervalos }))}
          />
        ))}
      </div>

      {algumIntervaloInvalido && (
        <p className="text-destructive mt-2 text-[11px]">
          Cada intervalo precisa fechar depois de abrir.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          size="sm"
          disabled={algumIntervaloInvalido || salvar.isPending}
          onClick={() =>
            salvar.mutate({ fuso: fusoRef.current, intervalos: todosOsIntervalos })
          }
        >
          {salvar.isPending ? "Salvando…" : "Salvar horário"}
        </Button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   ABA
   ------------------------------------------------------------------------- */

export function IdentidadeEOperacao() {
  return (
    <div className="flex flex-col gap-5">
      <SecaoIdentidade />
      <SecaoMensagens />
      <SecaoHorario />

      <Footnote>
        As três seções substituem o grupo inteiro que salvam — não existe "salvar só um campo". A
        resposta automática fora do horário só sai ao paciente com os dois configurados: a mensagem
        acima e pelo menos um intervalo de atendimento.
      </Footnote>
    </div>
  );
}

export default IdentidadeEOperacao;
