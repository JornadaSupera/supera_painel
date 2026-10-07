import type { Especialidade, VocabularioCriavel, VocabularioTermo } from "@/lib/enums";
import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type {
  ClinicaConfiguracao,
  ConfiguracaoSeguranca,
  Consentimento,
  Configuracoes,
  IntervaloAtendimento,
  ItemCatalogo,
  MotivoSituacao,
  RegraAlerta,
  SlideOnboarding,
  SolicitacaoTitular,
  VersaoLegal,
  VinculoExterno,
} from "@/types/configuracao";
import type { ParametroOperacional } from "@/types/estatisticas";
import { METAS_OPERACIONAIS } from "../_operationalTargets";
import { TETO_READ, executar, falhaDe, paraIso, umDe } from "./_helpers";
import { getSupabaseClient } from "./client";
import { specialtyIdOf } from "./_specialtyId";

const BUCKET_BRANDING = "clinic-branding";
const TAMANHO_MAXIMO_LOGO = 2 * 1024 * 1024;
const TIPOS_ACEITOS_LOGO = ["image/png", "image/jpeg", "image/webp"];

/**
 * Configurações — o que está valendo, e o que o painel edita.
 *
 * As duas metades da tela têm RPC própria, `SECURITY DEFINER`, com
 * `private.is_active_admin()` no corpo como única barreira — mas cada uma
 * trava um eixo diferente:
 *
 *  - **Vocabulário** (`symptoms`, `notification_types`, `content_categories`,
 *    `conversation_subjects`, `appointment_types`) trava o `código`, nunca o
 *    rótulo ou a ordem. `update_vocabulary_term` recusa qualquer UPDATE que
 *    mude `code` (gatilho `trg_reject_code_change`) — é ele que o diário do
 *    paciente, o eixo dos relatórios e o alvo do gatilho de alerta usam para
 *    apontar para o mesmo item, e renomeá-lo numa tarde quebraria os três de
 *    uma vez. Retirar e reativar são a MESMA função,
 *    `set_vocabulary_term_active`, nos dois sentidos — a leitura não filtra
 *    por `is_active`, então um termo retirado continua visível e reversível.
 *    Criar termo novo é `criarTermoVocabulario`, uma função do banco por
 *    vocabulário. Tipo de notificação não se cria: nasce com o recurso que o
 *    envia.
 *  - **Operação** (documento legal, limiar de alerta, motivo de situação) tem
 *    escrita completa, inclusive criação. São decisões da clínica que mudam
 *    com a rotina dela.
 *
 * As RPCs das duas metades levantam **frase em português**, não sentinela —
 * ver `MENSAGEM_LEGIVEL` em `_helpers`, que é o que faz a frase chegar à tela
 * em vez de virar "Verifique os dados informados".
 */

/** The category of a notification type, in words: the code never reaches the screen. */
const GRUPO_DE_NOTIFICACAO: Record<string, string> = {
  agenda: "Agenda",
  alert: "Alertas",
  chat: "Chat",
  content: "Conteúdo",
  report: "Relatórios",
};

interface LinhaCatalogo {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

function projetar(linha: LinhaCatalogo, detalhe: string | null = null): ItemCatalogo {
  return {
    id: linha.id,
    codigo: linha.code,
    label: linha.label,
    detalhe,
    ordem: Number(linha.sort_order),
    ativo: linha.is_active,
  };
}

/**
 * Chaves que a tela de referência mostra e que o banco não guarda.
 *
 * As cinco que moravam aqui (`identidade_visual`, `cor_primaria`,
 * `horario_atendimento_chat`, `resposta_automatica`, `textos_de_onboarding`)
 * ganharam onde gravar em `clinic_settings` (25/09/2026) — ver `getClinica`,
 * `salvarIdentidade`, `salvarMensagens` e `salvarHorario`. Vazio por ora;
 * nomear aqui é o que se faz quando alguma peça voltar a faltar.
 */
const SEM_ORIGEM: string[] = [];

export async function get(): Promise<SingleResult<Configuracoes>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const [sintomas, notificacoes, categorias, assuntos, tiposCompromisso] = await Promise.all([
      supabase
        .from("symptoms")
        .select("id, code, label, is_active, sort_order, is_psychological")
        .order("sort_order"),
      supabase
        .from("notification_types")
        .select("id, code, label, is_active, sort_order, category, is_silenceable")
        .order("sort_order"),
      supabase
        .from("content_categories")
        .select("id, code, label, is_active, sort_order, specialties ( label )")
        .order("sort_order"),
      supabase
        .from("conversation_subjects")
        .select("id, code, label, is_active, sort_order, specialties ( label )")
        .order("sort_order"),
      supabase
        .from("appointment_types")
        .select("id, code, label, is_active, sort_order")
        .order("sort_order"),
    ]);

    // Basta uma falhar para a tela não poder afirmar o que está valendo.
    const erro =
      sintomas.error ?? notificacoes.error ?? categorias.error ?? assuntos.error ?? tiposCompromisso.error;
    if (erro) return falhaDe(erro);

    return okOne({
      sintomas: (sintomas.data as unknown as (LinhaCatalogo & { is_psychological: boolean })[]).map(
        (linha) =>
          projetar(linha, linha.is_psychological ? "Sintoma psicológico" : "Sintoma físico"),
      ),

      notificacoes: (
        notificacoes.data as unknown as (LinhaCatalogo & {
          category: string;
          is_silenceable: boolean;
        })[]
      ).map((linha) => {
        const grupo = GRUPO_DE_NOTIFICACAO[linha.category] ?? "Outros";
        return projetar(
          linha,
          linha.is_silenceable ? `${grupo} · pode ser silenciada` : `${grupo} · não silenciável`,
        );
      }),

      categorias_conteudo: (
        categorias.data as unknown as (LinhaCatalogo & {
          specialties: { label: string } | { label: string }[] | null;
        })[]
      ).map((linha) => projetar(linha, umDe(linha.specialties)?.label ?? "Transversal")),

      assuntos_chat: (
        assuntos.data as unknown as (LinhaCatalogo & {
          specialties: { label: string } | { label: string }[] | null;
        })[]
      ).map((linha) => projetar(linha, umDe(linha.specialties)?.label ?? "Qualquer área")),

      // Sem `especialidade` própria — a agenda não amarra tipo de compromisso
      // a área —, então não há o que pôr em `detalhe`.
      tipos_compromisso: (tiposCompromisso.data as unknown as LinhaCatalogo[]).map((linha) =>
        projetar(linha),
      ),

      sem_origem: SEM_ORIGEM,
    });
  });
}

/* -------------------------------------------------------------------------
   ESCRITA DO VOCABULÁRIO — `update_vocabulary_term` + `set_vocabulary_term_active`
   -------------------------------------------------------------------------
   As duas RPCs aceitam `p_vocabulary` como o NOME DA TABELA — sem tradução no
   meio, ao contrário de especialidade ou fase. `private.vocabulary_table`
   recusa qualquer valor fora das cinco, então um `VocabularioTermo` errado
   falha na função, não em silêncio.
   ------------------------------------------------------------------------- */

/** De qual grupo de `Configuracoes` reler o termo, depois de escrever. */
const GRUPO_POR_VOCABULARIO: Record<VocabularioTermo, (config: Configuracoes) => ItemCatalogo[]> = {
  symptoms: (config) => config.sintomas,
  notification_types: (config) => config.notificacoes,
  content_categories: (config) => config.categorias_conteudo,
  conversation_subjects: (config) => config.assuntos_chat,
  appointment_types: (config) => config.tipos_compromisso,
};

/**
 * Um termo, relido depois de escrever — via `get()` inteiro, como
 * `regraDoSintoma` relê `getRegrasAlerta()`.
 *
 * Não existe leitura de UM termo só: as cinco tabelas são pequenas (a maior é
 * um punhado de sintomas), e cada `detalhe` depende de um enriquecimento
 * (categoria, especialidade, silenciável) que já mora em `get()`. Duplicar
 * essa lógica para poupar quatro consultas pequenas custaria mais do que
 * paga.
 */
async function termoDoVocabulario(
  vocabulario: VocabularioTermo,
  id: string,
): Promise<SingleResult<ItemCatalogo>> {
  const { data, error } = await get();
  if (error) return fail(error.code, error.message);
  if (!data) return fail(ERROR_CODE.UNKNOWN, "Não foi possível reler o vocabulário depois de gravar.");

  const termo = GRUPO_POR_VOCABULARIO[vocabulario](data).find((item) => item.id === id);
  return termo ? okOne(termo) : fail(ERROR_CODE.NOT_FOUND, "Termo não encontrado no vocabulário.");
}

/**
 * Corrige rótulo e/ou ordem. O `código` não é parâmetro: não é editável, e a
 * RPC nem o aceita — `update_vocabulary_term` só recebe `p_label` e
 * `p_sort_order`.
 */
export async function atualizarTermoVocabulario({
  vocabulario,
  id,
  label,
  ordem,
}: {
  vocabulario: VocabularioTermo;
  id: string;
  label?: string;
  ordem?: number;
}): Promise<SingleResult<ItemCatalogo>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("update_vocabulary_term", {
      p_vocabulary: vocabulario,
      p_id: id,
      // Nulo mantém a coluna — o mesmo contrato de `update_status_reason`.
      p_label: label ?? null,
      p_sort_order: ordem ?? null,
    });

    if (error) return falhaDe(error);
    return termoDoVocabulario(vocabulario, id);
  });
}

/**
 * Retira um termo, ou o reativa — a MESMA função nos dois sentidos.
 *
 * Ao contrário de `setMotivoAtivo`, a releitura sempre acontece: a política
 * de SELECT do vocabulário não filtra por `is_active`, então retirar não
 * torna a linha invisível, e devolver `null` aqui esconderia um termo que o
 * painel continua enxergando.
 */
export async function setTermoVocabularioAtivo({
  vocabulario,
  id,
  ativo,
}: {
  vocabulario: VocabularioTermo;
  id: string;
  ativo: boolean;
}): Promise<SingleResult<ItemCatalogo>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_vocabulary_term_active", {
      p_vocabulary: vocabulario,
      p_id: id,
      p_is_active: ativo,
    });

    if (error) return falhaDe(error);
    return termoDoVocabulario(vocabulario, id);
  });
}

/**
 * O código técnico de um termo, derivado do rótulo: "Dor de cabeça" vira
 * `dor_de_cabeca`. Sem acento, só letras minúsculas e sublinhado — a única
 * forma que o banco aceita. Dígitos saem pelo mesmo motivo.
 */
function codigoDoRotulo(rotulo: string): string {
  return rotulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** What each vocabulary calls one of its terms, for the refusals below. */
const NOME_DO_TERMO: Record<VocabularioCriavel, string> = {
  symptoms: "o sintoma",
  conversation_subjects: "o assunto",
  content_categories: "a categoria",
  appointment_types: "o tipo de compromisso",
};

/**
 * Cadastra um termo — uma função do banco por vocabulário, só do administrador.
 *
 * Dois rótulos que dão o mesmo código ("Náusea" e "nausea") seriam o mesmo
 * termo para quem aponta para ele. O banco só recusa o segundo quando o código
 * coincide; a checagem antes da chamada compara também o nome, sem acento e sem
 * caixa, e diz qual termo já ocupa aquele lugar e se ele está retirado.
 *
 * Assunto do chat nasce sem rota, como todos os existentes; com `especialidade`,
 * a rota é gravada logo depois por `set_conversation_subject_specialty`.
 */
export async function criarTermoVocabulario({
  vocabulario,
  label,
  psicologico = false,
  especialidade = null,
}: {
  vocabulario: VocabularioCriavel;
  label: string;
  psicologico?: boolean;
  especialidade?: Especialidade | null;
}): Promise<SingleResult<ItemCatalogo>> {
  return executar(async () => {
    const supabase = getSupabaseClient();
    const rotulo = label.trim();
    const codigo = codigoDoRotulo(rotulo);
    const nome = NOME_DO_TERMO[vocabulario];

    if (!codigo) return fail(ERROR_CODE.VALIDATION, "O nome precisa ter letras.");

    if (vocabulario === "content_categories" && !especialidade) {
      return fail(
        ERROR_CODE.VALIDATION,
        "Escolha a área que produz as orientações desta categoria.",
      );
    }

    let especialidadeId: string | null = null;
    if (especialidade) {
      const encontrada = await specialtyIdOf(especialidade);
      if ("error" in encontrada) return encontrada;
      especialidadeId = encontrada.id;
    }

    const { data, error: erroLeitura } = await supabase
      .from(vocabulario)
      .select("code, label, is_active, sort_order")
      .order("sort_order", { ascending: false });

    if (erroLeitura) return falhaDe(erroLeitura);

    const existentes = data as LinhaTermo[];
    // By code AND by name: the older terms carry english codes
    // ("medical_consultation" for "Consulta médica"), so comparing codes alone
    // let "CONSULTA MÉDICA" in as a second term.
    const mesmo = (linha: LinhaTermo) =>
      linha.code === codigo || codigoDoRotulo(linha.label) === codigo;
    // The active one first: it is the one people see, and the one to point to.
    const ocupado =
      existentes.find((linha) => linha.is_active && mesmo(linha)) ?? existentes.find(mesmo);

    if (ocupado) {
      return fail(
        ERROR_CODE.CONFLICT,
        ocupado.is_active
          ? `Já existe ${nome} “${ocupado.label}”, que o sistema trata como o mesmo.`
          : `Já existe ${nome} “${ocupado.label}” entre os retirados. Reative na lista em vez de cadastrar de novo.`,
      );
    }

    // Fim da lista: a leitura acima vem do maior para o menor.
    const ordem = (existentes[0]?.sort_order ?? 0) + 1;
    const comum = { p_code: codigo, p_label: rotulo, p_sort_order: ordem };

    const { data: id, error } =
      vocabulario === "symptoms"
        ? await supabase.rpc("create_symptom", { ...comum, p_is_psychological: psicologico })
        : vocabulario === "content_categories"
          ? await supabase.rpc("create_content_category", {
              ...comum,
              p_specialty_id: especialidadeId,
            })
          : vocabulario === "appointment_types"
            ? await supabase.rpc("create_appointment_type", {
                ...comum,
                p_color: null,
                p_icon_name: null,
              })
            : await supabase.rpc("create_conversation_subject", comum);

    if (error) return falhaDe(error);
    if (typeof id !== "string") {
      return fail(ERROR_CODE.UNKNOWN, "O cadastro não devolveu o identificador do termo.");
    }

    if (vocabulario === "conversation_subjects" && especialidadeId) {
      const { error: erroRota } = await supabase.rpc("set_conversation_subject_specialty", {
        p_subject_id: id,
        p_specialty_id: especialidadeId,
      });
      // O assunto já existe: a falha da rota não desfaz o cadastro, e a tela
      // diz o que faltou em vez de convidar a cadastrar de novo.
      if (erroRota) {
        return fail(
          ERROR_CODE.UNKNOWN,
          "O assunto foi cadastrado, mas a área que responde não foi gravada. Ele fica na fila geral.",
        );
      }
    }

    return termoDoVocabulario(vocabulario, id);
  });
}

interface LinhaTermo {
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

/* -------------------------------------------------------------------------
   IDENTIDADE, MENSAGENS E HORÁRIO — `clinic_settings` + `clinic_business_hours`
   -------------------------------------------------------------------------
   Linha única (`id = 1`), leitura direta para qualquer `authenticated` —
   sem pedágio de auditoria, porque não é dado clínico. A escrita é por RPC,
   uma por seção, cada uma substituindo o grupo inteiro que recebe: não existe
   "só a cor" sem o logo junto, nem "só terça" na semana de atendimento.
   ------------------------------------------------------------------------- */

interface LinhaClinicSettings {
  primary_color: string | null;
  secondary_color: string | null;
  logo_path: string | null;
  time_zone: string;
  onboarding_slides: { title: string; body: string }[];
  off_hours_message: string | null;
}

interface LinhaHorario {
  weekday: number;
  opens_at: string;
  closes_at: string;
}

/** URL pública do bucket `clinic-branding` — o bucket é público, de propósito. */
function urlDoLogo(path: string | null): string | null {
  if (!path) return null;
  return getSupabaseClient().storage.from(BUCKET_BRANDING).getPublicUrl(path).data.publicUrl;
}

function projetarClinica(settings: LinhaClinicSettings, horario: LinhaHorario[]): ClinicaConfiguracao {
  return {
    cor_primaria: settings.primary_color,
    cor_secundaria: settings.secondary_color,
    logo_path: settings.logo_path,
    logo_url: urlDoLogo(settings.logo_path),
    fuso: settings.time_zone,
    slides_onboarding: settings.onboarding_slides.map((slide) => ({
      titulo: slide.title,
      corpo: slide.body,
    })),
    mensagem_fora_horario: settings.off_hours_message,
    intervalos: horario
      .map((linha) => ({
        dia_semana: linha.weekday,
        abre: linha.opens_at.slice(0, 5),
        fecha: linha.closes_at.slice(0, 5),
      }))
      .sort((a, b) => a.dia_semana - b.dia_semana || a.abre.localeCompare(b.abre)),
  };
}

export async function getClinica(): Promise<SingleResult<ClinicaConfiguracao>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const [settings, horario] = await Promise.all([
      supabase
        .from("clinic_settings")
        .select("primary_color, secondary_color, logo_path, time_zone, onboarding_slides, off_hours_message")
        .eq("id", 1)
        .single(),
      supabase.from("clinic_business_hours").select("weekday, opens_at, closes_at"),
    ]);

    if (settings.error) return falhaDe(settings.error);
    if (horario.error) return falhaDe(horario.error);

    return okOne(
      projetarClinica(
        settings.data as unknown as LinhaClinicSettings,
        (horario.data ?? []) as unknown as LinhaHorario[],
      ),
    );
  });
}

/**
 * Sobe o logo para o bucket `clinic-branding` — nunca grava `clinic_settings`.
 *
 * Caminho novo a cada envio (`logo/<instante>-<nome>`), nunca sobrescrito: se
 * `salvarIdentidade` falhar depois do upload, o arquivo velho continua sendo o
 * que `logo_path` aponta, em vez de já ter sido substituído por um que a linha
 * não referencia ainda.
 */
export async function uploadLogo({
  arquivo,
}: {
  arquivo: File;
}): Promise<SingleResult<{ path: string; url: string }>> {
  return executar(async () => {
    if (!TIPOS_ACEITOS_LOGO.includes(arquivo.type)) {
      return fail(ERROR_CODE.VALIDATION, "O logo aceita apenas PNG, JPEG ou WebP.");
    }

    if (arquivo.size > TAMANHO_MAXIMO_LOGO) {
      return fail(ERROR_CODE.VALIDATION, "O logo precisa ter até 2 MB.");
    }

    const extensao = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
    const caminho = `logo/${Date.now()}.${extensao}`;

    const { error } = await getSupabaseClient()
      .storage.from(BUCKET_BRANDING)
      .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });

    if (error) return falhaDe({ message: error.message });

    const url = urlDoLogo(caminho);
    if (!url) return fail(ERROR_CODE.UNKNOWN, "O upload terminou sem devolver a URL do logo.");

    return okOne({ path: caminho, url });
  });
}

export async function salvarIdentidade({
  corPrimaria,
  corSecundaria,
  logoPath,
}: {
  corPrimaria: string;
  corSecundaria: string;
  logoPath: string | null;
}): Promise<SingleResult<ClinicaConfiguracao>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_clinic_branding", {
      p_primary_color: corPrimaria,
      p_secondary_color: corSecundaria,
      p_logo_path: logoPath,
    });

    if (error) return falhaDe(error);
    return getClinica();
  });
}

export async function salvarMensagens({
  slidesOnboarding,
  mensagemForaHorario,
}: {
  slidesOnboarding: SlideOnboarding[];
  mensagemForaHorario: string | null;
}): Promise<SingleResult<ClinicaConfiguracao>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_clinic_messages", {
      p_onboarding_slides: slidesOnboarding.map((slide) => ({
        title: slide.titulo,
        body: slide.corpo,
      })),
      p_off_hours_message: mensagemForaHorario,
    });

    if (error) return falhaDe(error);
    return getClinica();
  });
}

export async function salvarHorario({
  fuso,
  intervalos,
}: {
  fuso: string;
  intervalos: IntervaloAtendimento[];
}): Promise<SingleResult<ClinicaConfiguracao>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_clinic_business_hours", {
      p_time_zone: fuso,
      p_hours: intervalos.map((intervalo) => ({
        weekday: intervalo.dia_semana,
        opens_at: intervalo.abre,
        closes_at: intervalo.fecha,
      })),
    });

    if (error) return falhaDe(error);
    return getClinica();
  });
}

/* -------------------------------------------------------------------------
   METAS OPERACIONAIS — linhas de referência do gráfico de volume
   -------------------------------------------------------------------------
   `operational_parameters` não é semeada: a linha só existe depois que a
   administração a cadastra pela primeira vez. Por isso a leitura devolve a
   lista com o que já foi criado — nunca os dois códigos fixos com valor zero,
   que se leria como uma meta real de "zero atendimentos".
   ------------------------------------------------------------------------- */

export async function getMetasOperacionais(): Promise<ListResult<ParametroOperacional>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("operational_parameters")
      .select("code, label, value")
      .eq("is_active", true);

    if (error) return falhaDe(error);

    const porCodigo = new Map(
      (data as { code: string; label: string; value: number }[]).map((linha) => [linha.code, linha]),
    );

    const linhas = METAS_OPERACIONAIS.map(({ codigo }) => porCodigo.get(codigo))
      .filter((linha): linha is { code: string; label: string; value: number } => Boolean(linha))
      .map<ParametroOperacional>((linha) => ({
        codigo: linha.code,
        rotulo: linha.label,
        valor: Number(linha.value),
      }));

    return ok(linhas, linhas.length);
  });
}

/**
 * Cria ou atualiza uma meta pelo código — `set_operational_parameter` faz
 * `UPSERT` pela chave de negócio, então salvar a segunda vez é o mesmo ato que
 * criar a primeira.
 */
export async function salvarMetaOperacional({
  codigo,
  rotulo,
  valor,
}: {
  codigo: string;
  rotulo: string;
  valor: number;
}): Promise<SingleResult<ParametroOperacional>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_operational_parameter", {
      p_code: codigo,
      p_label: rotulo,
      p_value: valor,
      p_is_active: true,
    });

    if (error) return falhaDe(error);

    return okOne<ParametroOperacional>({ codigo, rotulo, valor });
  });
}

const TIPO_LABEL: Record<string, string> = {
  terms_of_use: "Termos de uso",
  privacy_policy: "Política de privacidade",
};

/** Termos e política, todas as versões — o histórico é exigência de aceite. */
export async function getTermos(): Promise<ListResult<VersaoLegal>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("legal_document_versions")
      .select("id, kind, version, body, published_at, is_current")
      .order("kind")
      .order("version", { ascending: false });

    if (error) return falhaDe(error);

    const linhas = data as unknown as {
      id: string;
      kind: string;
      version: number;
      body: string;
      published_at: string | null;
      is_current: boolean;
    }[];

    return ok(
      linhas.map<VersaoLegal>((linha) => ({
        id: linha.id,
        tipo: linha.kind === "privacy_policy" ? "politica_de_privacidade" : "termos_de_uso",
        tipo_label: TIPO_LABEL[linha.kind] ?? linha.kind,
        versao: Number(linha.version),
        vigente: linha.is_current,
        publicado_em: paraIso(linha.published_at),
        corpo: linha.body,
      })),
    );
  });
}

/** A versão de uma espécie que está em vigor, para devolver depois de publicar. */
async function versaoVigente(tipo: VersaoLegal["tipo"]): Promise<VersaoLegal | null> {
  const { data } = await getTermos();
  return data.find((versao) => versao.tipo === tipo && versao.vigente) ?? null;
}

/**
 * Publica uma versão nova do documento e aposenta a anterior.
 *
 * O backend numera por espécie e marca a vigência no mesmo ato — a ordem
 * importa lá dentro, porque há índice único parcial sobre "a vigente". Aqui só
 * mandamos o texto.
 */
export async function publishTermos({
  tipo,
  corpo,
}: {
  tipo: VersaoLegal["tipo"];
  corpo: string;
}): Promise<SingleResult<VersaoLegal>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("publish_legal_document", {
      p_kind: tipo === "politica_de_privacidade" ? "privacy_policy" : "terms_of_use",
      p_body: corpo,
    });

    if (error) return falhaDe(error);

    // A RPC devolve só o id. Reler dá a versão numerada e a data de publicação,
    // que é o que a tela mostra — e confirma que a vigência trocou de fato.
    return okOne(await versaoVigente(tipo));
  });
}

/* -------------------------------------------------------------------------
   GATILHOS DE ALERTA
   ------------------------------------------------------------------------- */

/**
 * Uma linha por sintoma ativo, com ou sem limiar.
 *
 * O `LEFT JOIN` é o ponto: listar só as regras existentes mostraria o que está
 * coberto e esconderia o que não está. Numa tela cuja pergunta é "o que dispara
 * alerta?", a ausência é a informação mais importante.
 *
 * A regra vigente é a de `effective_to` nulo — o histórico fica na tabela,
 * porque um alerta de março foi disparado sob a regra de março.
 */
export async function getRegrasAlerta(): Promise<ListResult<RegraAlerta>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const [sintomas, regras] = await Promise.all([
      supabase.from("symptoms").select("id, label").eq("is_active", true).order("sort_order"),
      supabase.from("alert_rules").select("id, symptom_id, min_grade, effective_from").is("effective_to", null),
    ]);

    const erro = sintomas.error ?? regras.error;
    if (erro) return falhaDe(erro);

    const porSintoma = new Map(
      (regras.data as unknown as {
        id: string;
        symptom_id: string;
        min_grade: number;
        effective_from: string;
      }[]).map((regra) => [regra.symptom_id, regra]),
    );

    return ok(
      (sintomas.data as unknown as { id: string; label: string }[]).map((sintoma) => {
        const regra = porSintoma.get(sintoma.id);

        return {
          id: regra?.id ?? null,
          sintoma_id: sintoma.id,
          sintoma_label: sintoma.label,
          grau_minimo: regra ? Number(regra.min_grade) : null,
          vigente_desde: regra ? paraIso(regra.effective_from) : null,
        };
      }),
    );
  });
}

/** A linha de um sintoma depois de escrever, relida da fonte. */
async function regraDoSintoma(sintomaId: string): Promise<SingleResult<RegraAlerta>> {
  const { data, error } = await getRegrasAlerta();
  if (error) return fail(error.code, error.message);

  const regra = data.find((linha) => linha.sintoma_id === sintomaId);
  return regra ? okOne(regra) : fail(ERROR_CODE.NOT_FOUND, "Sintoma não encontrado no catálogo.");
}

export async function setRegraAlerta({
  sintoma_id,
  grau_minimo,
}: {
  sintoma_id: string;
  grau_minimo: number;
}): Promise<SingleResult<RegraAlerta>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_alert_rule", {
      p_symptom_id: sintoma_id,
      p_min_grade: grau_minimo,
    });

    if (error) return falhaDe(error);
    return regraDoSintoma(sintoma_id);
  });
}

export async function removerRegraAlerta({
  sintoma_id,
}: {
  sintoma_id: string;
}): Promise<SingleResult<RegraAlerta>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("disable_alert_rule", {
      p_symptom_id: sintoma_id,
    });

    if (error) return falhaDe(error);
    return regraDoSintoma(sintoma_id);
  });
}

/* -------------------------------------------------------------------------
   MOTIVOS DE SITUAÇÃO
   ------------------------------------------------------------------------- */

interface LinhaMotivo {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  appointment_statuses:
    | { code: string; label: string }
    | { code: string; label: string }[]
    | null;
}

function projetarMotivo(linha: LinhaMotivo): MotivoSituacao {
  const situacao = umDe(linha.appointment_statuses);

  return {
    id: linha.id,
    situacao_codigo: situacao?.code ?? "",
    situacao_label: situacao?.label ?? "Situação desconhecida",
    codigo: linha.code,
    label: linha.label,
    ordem: Number(linha.sort_order),
    ativo: linha.is_active,
  };
}

/**
 * Os motivos EM USO — e só eles.
 *
 * > [!] A política de leitura desta tabela é `is_active`.
 * Quem faz login é `authenticated`, e para esse papel a linha aposentada
 * simplesmente não existe. Ver todas exigiria o papel `clinical_reader`, do
 * qual `authenticated` não é membro — a mesma porta das tabelas clínicas.
 *
 * A consequência é da interface, não daqui: **aposentar é porta de mão única
 * pelo painel.** A linha some da lista e não há como trazê-la de volta,
 * porque não há como sequer enxergá-la. A tela diz isso antes de a pessoa
 * clicar, e a correção de rótulo existe justamente para que aposentar não
 * vire o caminho de corrigir um erro de digitação.
 */
export async function getMotivos(): Promise<ListResult<MotivoSituacao>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("appointment_status_reasons")
      .select("id, code, label, sort_order, is_active, appointment_statuses:status_id ( code, label )")
      .order("sort_order");

    if (error) return falhaDe(error);

    return ok((data as unknown as LinhaMotivo[]).map(projetarMotivo));
  });
}

/** Um motivo pelo id, relido depois de escrever. */
async function motivoPorId(id: string): Promise<SingleResult<MotivoSituacao>> {
  const { data, error } = await getMotivos();
  if (error) return fail(error.code, error.message);

  const motivo = data.find((linha) => linha.id === id);
  return motivo ? okOne(motivo) : fail(ERROR_CODE.NOT_FOUND, "Motivo não encontrado.");
}

export async function criarMotivo({
  situacao_codigo,
  codigo,
  label,
  ordem,
}: {
  situacao_codigo: string;
  codigo: string;
  label: string;
  ordem?: number;
}): Promise<SingleResult<MotivoSituacao>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient().rpc("create_status_reason", {
      p_status_code: situacao_codigo,
      p_code: codigo,
      p_label: label,
      p_sort_order: ordem ?? 0,
    });

    if (error) return falhaDe(error);
    return motivoPorId(data as unknown as string);
  });
}

export async function atualizarMotivo({
  id,
  label,
  ordem,
}: {
  id: string;
  label?: string;
  ordem?: number;
}): Promise<SingleResult<MotivoSituacao>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("update_status_reason", {
      p_reason_id: id,
      // Nulo mantém a coluna: é o contrato das escritas deste banco, e o que
      // permite corrigir só o rótulo sem reenviar a ordem.
      p_label: label ?? null,
      p_sort_order: ordem ?? null,
    });

    if (error) return falhaDe(error);
    return motivoPorId(id);
  });
}

/**
 * Aposenta um motivo — ou o reativa, se algum dia der para enxergá-lo.
 *
 * Depois de aposentar, a releitura **não encontra a linha**: a política de
 * SELECT é `is_active`, então a própria escrita a torna invisível. Isso é
 * sucesso, não falha, e por isso `null` aqui não vira `NOT_FOUND` — um erro
 * depois de uma operação que funcionou faria quem opera clicar de novo.
 */
export async function setMotivoAtivo({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}): Promise<SingleResult<MotivoSituacao>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_status_reason_active", {
      p_reason_id: id,
      p_is_active: ativo,
    });

    if (error) return falhaDe(error);
    if (!ativo) return okOne<MotivoSituacao>(null);

    return motivoPorId(id);
  });
}

/* -------------------------------------------------------------------------
   SEGUNDO FATOR OBRIGATÓRIO
   ------------------------------------------------------------------------- */

/**
 * O estado do interruptor.
 *
 * A tabela tem uma linha só, e a política de leitura é a do administrador
 * ativo. Linha ausente **não** significa "desligado": significa que esta sessão
 * não consegue perguntar — ou porque o perfil não é administrativo, ou porque a
 * própria exigência já está barrando a leitura. Devolver `false` aqui faria a
 * tela afirmar o contrário do que está valendo.
 */
export async function getSeguranca(): Promise<SingleResult<ConfiguracaoSeguranca>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("security_settings")
      .select("require_admin_mfa, updated_at, accounts:updated_by ( full_name, email )")
      .maybeSingle();

    if (error) return falhaDe(error);

    if (!data) {
      return okOne<ConfiguracaoSeguranca>({
        exige_mfa: null,
        atualizado_em: null,
        atualizado_por: null,
      });
    }

    const linha = data as unknown as {
      require_admin_mfa: boolean;
      updated_at: string | null;
      accounts: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
    };

    const autor = umDe(linha.accounts);

    return okOne<ConfiguracaoSeguranca>({
      exige_mfa: linha.require_admin_mfa,
      atualizado_em: paraIso(linha.updated_at),
      // Nulo é o valor de nascimento da linha: ninguém mexeu ainda.
      atualizado_por: autor?.full_name?.trim() || autor?.email || null,
    });
  });
}

/**
 * Liga e desliga a exigência.
 *
 * O backend recusa ligar a partir de uma sessão que ainda não passou pelo
 * segundo fator, e a recusa vem com a frase pronta para a tela. A checagem
 * acontece lá, e não aqui, porque uma guarda que mora só no cliente protege
 * apenas quem usa o cliente.
 */
export async function setExigirMfa({
  exigir,
}: {
  exigir: boolean;
}): Promise<SingleResult<ConfiguracaoSeguranca>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_require_admin_mfa", {
      p_required: exigir,
    });

    if (error) return falhaDe(error);
    return getSeguranca();
  });
}

/* -------------------------------------------------------------------------
   FILA DE CONFERÊNCIA DA INTEGRAÇÃO
   -------------------------------------------------------------------------
   A leitura é por `read_external_refs`, e não por `.from()`: a política da
   tabela é do papel `clinical_reader`, do qual `authenticated` não é membro —
   uma consulta direta devolveria zero linhas sem erro nenhum.

   A função EXIGE um estado; ela não tem ramo para "todos". A fila pede
   `proposed`, que é o único que ainda espera decisão: confirmado e rejeitado
   já foram resolvidos, e misturá-los faria a fila deixar de ser fila.

   > [!] Hoje ela está vazia, e a tela precisa existir mesmo assim.
   A sincronização está desligada, então nenhum vínculo foi proposto. Construir
   a conferência no dia em que os vínculos começarem a chegar é construí-la com
   pressa — e o erro que ela evita é o pior possível neste sistema.
   ------------------------------------------------------------------------- */

interface LinhaVinculo {
  id: string;
  system: string;
  entity_type: string;
  local_id: string | null;
  external_key: Record<string, unknown> | null;
  created_at: string;
}

/** O que o sistema de origem chama a linha, em texto legível. */
function chaveLegivel(chave: Record<string, unknown> | null): string {
  if (!chave) return "—";

  const partes = Object.entries(chave)
    .filter(([, valor]) => valor !== null && valor !== undefined && valor !== "")
    .map(([campo, valor]) => `${campo}: ${String(valor)}`);

  return partes.length > 0 ? partes.join(" · ") : "—";
}

export async function getVinculosExternos(): Promise<ListResult<VinculoExterno>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient().rpc("read_external_refs", {
      p_link_status: "proposed",
      p_limit: TETO_READ,
      p_offset: 0,
    });

    if (error) return falhaDe(error);

    return ok(
      ((data ?? []) as LinhaVinculo[]).map((linha) => ({
        id: linha.id,
        sistema: linha.system,
        entidade: linha.entity_type,
        chave_externa: chaveLegivel(linha.external_key),
        local_id: linha.local_id,
        proposto_em: paraIso(linha.created_at) ?? linha.created_at,
      })),
    );
  });
}

/**
 * Confirma ou rejeita um vínculo proposto.
 *
 * A linha sai da fila nos dois casos — é por isso que a resposta não a relê:
 * ela deixou de ser `proposed`, e uma releitura devolveria "não encontrado"
 * para uma operação que funcionou.
 */
export async function confirmarVinculoExterno({
  id,
  confirmar,
}: {
  id: string;
  confirmar: boolean;
}): Promise<SingleResult<VinculoExterno>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("confirm_external_link", {
      p_ref_id: id,
      p_confirm: confirmar,
    });

    if (error) return falhaDe(error);

    return okOne<VinculoExterno>(null);
  });
}

/* -------------------------------------------------------------------------
   CONSENTIMENTOS
   ------------------------------------------------------------------------- */

interface LinhaConsentimento {
  id: string;
  accepted_at: string;
  revoked_at: string | null;
  accounts: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  legal_document_versions: { kind: string; version: number } | { kind: string; version: number }[] | null;
}

/**
 * Quem aceitou qual versão.
 *
 * Leitura direta: `consent_records` tem política para o administrador, fora do
 * pedágio das tabelas clínicas. Não há escrita — aceitar é ato do titular no
 * aplicativo, e revogar também.
 */
export async function getConsentimentos(): Promise<ListResult<Consentimento>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("consent_records")
      .select(
        "id, accepted_at, revoked_at, accounts:account_id ( full_name, email ), legal_document_versions:document_version_id ( kind, version )",
      )
      .order("accepted_at", { ascending: false })
      .limit(TETO_READ);

    if (error) return falhaDe(error);

    return ok(
      (data as unknown as LinhaConsentimento[]).map((linha) => {
        const pessoa = umDe(linha.accounts);
        const versao = umDe(linha.legal_document_versions);

        return {
          id: linha.id,
          pessoa: pessoa?.full_name?.trim() || pessoa?.email || "Não identificado",
          documento: versao
            ? `${TIPO_LABEL[versao.kind] ?? versao.kind} · versão ${versao.version}`
            : "Documento não identificado",
          aceito_em: paraIso(linha.accepted_at) ?? linha.accepted_at,
          revogado_em: paraIso(linha.revoked_at),
        };
      }),
    );
  });
}

/* -------------------------------------------------------------------------
   PEDIDOS DO TITULAR (LGPD)
   -------------------------------------------------------------------------
   Leitura direta: `data_subject_requests` tem política para o administrador.
   A decisão é por RPC (`decide_data_subject_request`), que aceita deferir e
   recusar. O ciclo completo — `close_data_subject_request_cycle`, 25/09/2026
   — abriu o estado `executed`, mas por dois caminhos diferentes conforme o
   tipo do pedido:

   - Exclusão e revogação de consentimento se EXECUTAM SOZINHAS: a rotina
     `execute-subject-requests`, a cada 5 minutos, tenta cumprir todo pedido
     `granted` desses dois tipos. Falhando, o pedido continua `granted` e
     `execution_error` guarda o motivo — é o painel que precisa mostrar isso,
     porque senão a falha fica muda.
   - Correção pede um passo do painel: `complete_data_subject_request` marca
     como cumprida, e só aceita `granted` + `rectification` — qualquer outro
     caso devolve `request_not_completable`.
   - Acesso e portabilidade o painel só decide. Deferido, o titular baixa o
     pacote sozinho por `export_my_data`, direto no app, durante 15 dias a
     contar de `decided_at`; o primeiro download grava `executed`/`executed_at`.
     Passado o prazo o banco recusa (`export_window_closed`) e o pedido segue
     `granted` — "prazo encerrado" é conta da tela, não um estado do banco.
   ------------------------------------------------------------------------- */

const TIPO_SOLICITACAO_LABEL: Record<string, string> = {
  access: "Acesso aos dados",
  rectification: "Correção de dados",
  portability: "Portabilidade",
  consent_revocation: "Revogação de consentimento",
  deletion: "Exclusão de dados",
};

const STATUS_SOLICITACAO_LABEL: Record<string, string> = {
  requested: "Aberto",
  under_review: "Em análise",
  granted: "Deferido",
  executed: "Cumprido",
  refused: "Recusado",
};

/** Os dois estados que ainda aceitam decisão — é o que define "aberto". */
const ABERTOS = new Set(["requested", "under_review"]);

interface LinhaSolicitacao {
  id: string;
  account_id: string;
  request_type: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  executed_at: string | null;
  decision_note: string | null;
  execution_error: string | null;
  accounts: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  decisor: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
}

function projetarSolicitacao(linha: LinhaSolicitacao): SolicitacaoTitular {
  const titular = umDe(linha.accounts);
  const decisor = umDe(linha.decisor);

  return {
    id: linha.id,
    conta_id: linha.account_id,
    pessoa: titular?.full_name?.trim() || titular?.email || "Não identificado",
    tipo: linha.request_type,
    tipo_label: TIPO_SOLICITACAO_LABEL[linha.request_type] ?? linha.request_type,
    status: linha.status,
    status_label: STATUS_SOLICITACAO_LABEL[linha.status] ?? linha.status,
    criado_em: paraIso(linha.created_at) ?? linha.created_at,
    decidido_em: paraIso(linha.decided_at),
    decidido_por: decisor?.full_name?.trim() || decisor?.email || null,
    executado_em: paraIso(linha.executed_at),
    observacao: linha.decision_note,
    aberto: ABERTOS.has(linha.status),
    // `complete_data_subject_request` só aceita esta combinação — replicar a
    // regra aqui evita que a tela ofereça um botão que o banco vai recusar.
    completavel: linha.status === "granted" && linha.request_type === "rectification",
    execucao_erro: linha.execution_error,
  };
}

/** Colunas de `data_subject_requests` que a tela precisa, com os dois joins de nome. */
const SELECT_SOLICITACAO =
  "id, account_id, request_type, status, created_at, decided_at, executed_at, decision_note, execution_error, accounts:account_id ( full_name, email ), decisor:decided_by ( full_name, email )";

export async function getSolicitacoesTitular(): Promise<ListResult<SolicitacaoTitular>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("data_subject_requests")
      .select(SELECT_SOLICITACAO)
      .order("created_at", { ascending: false })
      .limit(TETO_READ);

    if (error) return falhaDe(error);

    const solicitacoes = (data as unknown as LinhaSolicitacao[]).map(projetarSolicitacao);

    // Aberto primeiro: é uma fila com prazo correndo, e ordenar só por data
    // misturaria o que espera decisão com o que já foi decidido.
    return ok(
      solicitacoes.sort((a, b) => Number(b.aberto) - Number(a.aberto) || b.criado_em.localeCompare(a.criado_em)),
    );
  });
}

/**
 * O que o paciente escreveu ao pedir a correção (`requester_note`).
 *
 * > [!] Fica fora de `SELECT_SOLICITACAO` de propósito. O texto pode trazer o
 * celular ou o CPF corretos, então só sai do banco quando alguém abre o pedido —
 * nunca na lista, que também alimenta contagens e telas de outro assunto.
 *
 * A coluna é pedida ao responsável pelo banco e ainda pode não existir. O
 * PostgREST responde `42703` (coluna inexistente) e isso vira NOT_IMPLEMENTED
 * com o motivo escrito, não texto vazio: "o paciente não descreveu" e "o banco
 * ainda não guarda" são situações diferentes para quem decide.
 */
export async function getTextoSolicitacaoTitular({
  id,
}: {
  id: string;
}): Promise<SingleResult<{ texto: string | null }>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("data_subject_requests")
      .select("requester_note")
      .eq("id", id)
      .maybeSingle();

    if (error?.code === "42703") {
      return fail(
        ERROR_CODE.NOT_IMPLEMENTED,
        "O banco ainda não guarda o que o paciente quer corrigir.",
      );
    }

    if (error) return falhaDe(error);
    if (!data) return fail(ERROR_CODE.NOT_FOUND, "Pedido não encontrado.");

    const texto = (data as unknown as { requester_note: string | null }).requester_note?.trim();

    return okOne({ texto: texto || null });
  });
}

/** Uma solicitação, para devolver a linha atualizada sem reler a lista inteira. */
async function buscarSolicitacao(
  id: string,
): Promise<SolicitacaoTitular | ReturnType<typeof falhaDe> | ReturnType<typeof fail>> {
  const { data, error } = await getSupabaseClient()
    .from("data_subject_requests")
    .select(SELECT_SOLICITACAO)
    .eq("id", id)
    .maybeSingle();

  if (error) return falhaDe(error);
  if (!data) return fail(ERROR_CODE.NOT_FOUND, "Pedido não encontrado.");

  return projetarSolicitacao(data as unknown as LinhaSolicitacao);
}

export async function decidirSolicitacaoTitular({
  id,
  deferir,
  observacao,
}: {
  id: string;
  deferir: boolean;
  observacao: string;
}): Promise<SingleResult<SolicitacaoTitular>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("decide_data_subject_request", {
      p_request_id: id,
      p_status: deferir ? "granted" : "refused",
      p_note: observacao,
    });

    if (error) return falhaDe(error);

    const solicitacao = await buscarSolicitacao(id);
    if (!("id" in solicitacao)) return solicitacao;

    return okOne(solicitacao);
  });
}

/**
 * Marca um pedido de correção como cumprido.
 *
 * O backend só aceita `granted` + `rectification`; qualquer outro caso
 * devolve `request_not_completable` (42501), traduzido pelo tratamento de
 * erro padrão do adapter.
 */
export async function completarSolicitacaoTitular({
  id,
  observacao,
}: {
  id: string;
  observacao?: string;
}): Promise<SingleResult<SolicitacaoTitular>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("complete_data_subject_request", {
      p_request_id: id,
      p_note: observacao?.trim() || null,
    });

    if (error) return falhaDe(error);

    const solicitacao = await buscarSolicitacao(id);
    if (!("id" in solicitacao)) return solicitacao;

    return okOne(solicitacao);
  });
}
