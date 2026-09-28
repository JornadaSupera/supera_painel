import type { VocabularioTermo } from "@/lib/enums";
import { efeitosAdversos } from "@/mocks/protocolos";
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
import { SETTINGS_WRITE_OPERATIONS } from "../_settings";
import { definirExigenciaDeMfa, estadoDaSeguranca, nivelAtual } from "./_security";
import { simulate } from "./_helpers";

/**
 * Configurações — catálogos sobre a base fictícia.
 *
 * A escrita do VOCABULÁRIO reproduz a mesma trava do adapter Supabase, campo a
 * campo: rótulo e ordem mudam, ativo/retirado alterna nos dois sentidos, mas o
 * `código` nunca muda e nenhuma função cria termo novo — reproduzir só metade
 * dessa trava faria a tela parecer mais permissiva aqui do que é no backend
 * real.
 *
 * A escrita de OPERAÇÃO — documento legal, limiar de alerta, motivo de
 * situação — existe dos dois lados, então aqui ela é de verdade, em memória. As
 * mesmas recusas do banco são reproduzidas uma a uma: código fora do formato,
 * texto vazio, situação que não aceita motivo. Um mock permissivo faria a tela
 * parecer pronta e quebrar só contra o backend real.
 */

function item(codigo: string, label: string, detalhe: string | null): Omit<ItemCatalogo, "ordem"> {
  return { id: `cat-${codigo}`, codigo, label, detalhe, ativo: true };
}

/** A posição de exibição é a ordem da lista — igual ao `sort_order` de origem. */
function comOrdem(itens: Omit<ItemCatalogo, "ordem">[]): ItemCatalogo[] {
  return itens.map((item, ordem) => ({ ...item, ordem }));
}

const SINTOMAS: ItemCatalogo[] = comOrdem(
  efeitosAdversos.map((efeito) => item(efeito.id, efeito.nome, efeito.sistema)),
);

const NOTIFICACOES: ItemCatalogo[] = comOrdem([
  item("appointment_reminder_24h", "Lembrete de compromisso", "Agenda · pode ser silenciada"),
  item("appointment_scheduled", "Novo compromisso agendado", "Agenda · pode ser silenciada"),
  item("appointment_changed", "Compromisso alterado", "Agenda · pode ser silenciada"),
  item("chat_message", "Nova mensagem da equipe", "Chat · pode ser silenciada"),
  item("chat_assigned", "Conversa atribuída a você", "Chat · pode ser silenciada"),
  item("content_published", "Nova orientação disponível", "Conteúdo · pode ser silenciada"),
  item("critical_alert", "Alerta de sintoma crítico", "Clínico · não silenciável"),
]);

const CATEGORIAS: ItemCatalogo[] = comOrdem([
  item("nutrition", "Nutrição", "Nutricionista"),
  item("psychology", "Psicologia", "Psicólogo"),
  item("dentistry", "Odontologia", "Dentista"),
  item("physiotherapy", "Fisioterapia", "Fisioterapeuta"),
  item("nursing", "Enfermagem", "Enfermeiro"),
  item("oral_medication", "Medicação Oral", "Transversal"),
]);

const ASSUNTOS: ItemCatalogo[] = comOrdem([
  item("symptoms", "Dúvida sobre sintomas", "Qualquer área"),
  item("medication", "Dúvida sobre medicação", "Farmacêutico"),
  item("appointment", "Agenda e compromissos", "Qualquer área"),
  item("other", "Outro assunto", "Qualquer área"),
]);

/** Os mesmos sete tipos da base de homologação, na mesma ordem. */
const TIPOS_COMPROMISSO: ItemCatalogo[] = comOrdem([
  item("medical_consultation", "Consulta médica", null),
  item("follow_up", "Retorno", null),
  item("infusion", "Infusão / quimioterapia", null),
  item("medication_pickup", "Retirada de medicação", null),
  item("procedure", "Procedimento", null),
  item("multidisciplinary", "Avaliação multidisciplinar", null),
  item("lab_exam", "Exame laboratorial", null),
]);

/**
 * As obrigatórias (`is_silenceable = false`) — `guard_notification_type` as
 * protege. Só `critical_alert` está no mock hoje; `alert_assigned`, a outra
 * obrigatória da base real, ainda não tem linha aqui.
 */
const NOTIFICACOES_OBRIGATORIAS = new Set(["critical_alert"]);

/** As cinco listas vivas, por nome de tabela — a mesma chave que a RPC real usa. */
const LISTA_POR_VOCABULARIO: Record<VocabularioTermo, ItemCatalogo[]> = {
  symptoms: SINTOMAS,
  notification_types: NOTIFICACOES,
  content_categories: CATEGORIAS,
  conversation_subjects: ASSUNTOS,
  appointment_types: TIPOS_COMPROMISSO,
};

const TERMOS_LABEL: Record<VersaoLegal["tipo"], string> = {
  termos_de_uso: "Termos de uso",
  politica_de_privacidade: "Política de privacidade",
};

const TERMOS: VersaoLegal[] = [
  {
    id: "legal-001",
    tipo: "termos_de_uso",
    tipo_label: "Termos de uso",
    versao: 7,
    vigente: true,
    publicado_em: "2026-04-12T12:00:00.000Z",
    corpo:
      "Estes termos regem o uso do aplicativo Jornada Supera pelos pacientes do Centro de Oncologia de Santa Catarina.\n\nO aplicativo não substitui atendimento presencial nem serve para emergências. Em caso de sintoma grave, procure o pronto-atendimento.",
  },
  {
    id: "legal-002",
    tipo: "politica_de_privacidade",
    tipo_label: "Política de privacidade",
    versao: 4,
    vigente: true,
    publicado_em: "2026-04-12T12:00:00.000Z",
    corpo:
      "Os dados registrados no aplicativo são dados de saúde e recebem o tratamento previsto na Lei Geral de Proteção de Dados.\n\nO acesso é restrito à equipe assistencial responsável pelo seu cuidado, e todo acesso fica registrado em trilha de auditoria.",
  },
];

export async function get(): Promise<SingleResult<Configuracoes>> {
  return simulate(() =>
    okOne({
      sintomas: SINTOMAS,
      notificacoes: NOTIFICACOES,
      categorias_conteudo: CATEGORIAS,
      assuntos_chat: ASSUNTOS,
      tipos_compromisso: TIPOS_COMPROMISSO,
      sem_origem: [],
    }),
  );
}

/* -------------------------------------------------------------------------
   ESCRITA DO VOCABULÁRIO
   ------------------------------------------------------------------------- */

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
  return simulate(() => {
    const termo = LISTA_POR_VOCABULARIO[vocabulario].find((linha) => linha.id === id);
    if (!termo) return fail(ERROR_CODE.NOT_FOUND, "Termo não encontrado no vocabulário.");

    // Mesma recusa da RPC: rótulo vazio não é "sem mudança", é entrada inválida.
    if (label !== undefined && !label.trim()) {
      return fail(ERROR_CODE.VALIDATION, "o rotulo nao pode ser vazio");
    }

    // Nulo mantém a coluna — o mesmo contrato de `update_vocabulary_term`.
    if (label !== undefined) termo.label = label.trim();
    if (ordem !== undefined) termo.ordem = ordem;

    return okOne(termo);
  });
}

/**
 * Retira um termo, ou o reativa — a MESMA função nos dois sentidos, como no
 * banco. Ao contrário de `setMotivoAtivo`, sempre devolve a linha: o
 * vocabulário não fica invisível depois de retirado.
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
  return simulate(() => {
    const termo = LISTA_POR_VOCABULARIO[vocabulario].find((linha) => linha.id === id);
    if (!termo) return fail(ERROR_CODE.NOT_FOUND, "Termo não encontrado no vocabulário.");

    // Mesma recusa de `guard_notification_type`: tipo obrigatório não desliga.
    if (!ativo && vocabulario === "notification_types" && NOTIFICACOES_OBRIGATORIAS.has(termo.codigo)) {
      return fail(
        ERROR_CODE.VALIDATION,
        `o tipo ${termo.codigo} e obrigatorio e nao pode ser desligado: desligar o calaria para todos`,
      );
    }

    termo.ativo = ativo;
    return okOne(termo);
  });
}

export async function getTermos(): Promise<ListResult<VersaoLegal>> {
  // Mais nova primeiro, por espécie — a mesma ordem do adapter real.
  return simulate(() =>
    ok(
      [...TERMOS].sort((a, b) => a.tipo.localeCompare(b.tipo) || b.versao - a.versao),
    ),
  );
}

/**
 * Publica uma versão nova e aposenta a anterior.
 *
 * Numera por ESPÉCIE, como o backend: termos e política evoluem em ritmos
 * diferentes, e uma sequência única faria a v3 dos termos conviver com a v1 da
 * política sem que o número dissesse nada.
 */
export async function publishTermos({
  tipo,
  corpo,
}: {
  tipo: VersaoLegal["tipo"];
  corpo: string;
}): Promise<SingleResult<VersaoLegal>> {
  return simulate(() => {
    if (!corpo.trim()) {
      return fail(ERROR_CODE.VALIDATION, "O texto do documento não pode ser vazio.");
    }

    const daEspecie = TERMOS.filter((versao) => versao.tipo === tipo);
    const anterior = daEspecie.find((versao) => versao.vigente);
    if (anterior) anterior.vigente = false;

    const nova: VersaoLegal = {
      id: `legal-${Date.now()}`,
      tipo,
      tipo_label: TERMOS_LABEL[tipo],
      versao: Math.max(0, ...daEspecie.map((versao) => versao.versao)) + 1,
      vigente: true,
      publicado_em: new Date().toISOString(),
      corpo: corpo.trim(),
    };

    TERMOS.push(nova);
    return okOne(nova);
  });
}

/* -------------------------------------------------------------------------
   GATILHOS DE ALERTA
   ------------------------------------------------------------------------- */

/** Limiar vigente por sintoma. Vazio no início, como no banco. */
const REGRAS = new Map<string, { grau: number; desde: string }>();

function regraDe(sintoma: ItemCatalogo): RegraAlerta {
  const regra = REGRAS.get(sintoma.id);

  return {
    id: regra ? `rule-${sintoma.id}` : null,
    sintoma_id: sintoma.id,
    sintoma_label: sintoma.label,
    grau_minimo: regra?.grau ?? null,
    vigente_desde: regra?.desde ?? null,
  };
}

export async function getRegrasAlerta(): Promise<ListResult<RegraAlerta>> {
  return simulate(() => ok(SINTOMAS.map(regraDe)));
}

function respostaDaRegra(sintomaId: string): SingleResult<RegraAlerta> {
  const sintoma = SINTOMAS.find((item) => item.id === sintomaId);
  if (!sintoma) return fail(ERROR_CODE.NOT_FOUND, "Sintoma inexistente ou inativo.");

  return okOne(regraDe(sintoma));
}

export async function setRegraAlerta({
  sintoma_id,
  grau_minimo,
}: {
  sintoma_id: string;
  grau_minimo: number;
}): Promise<SingleResult<RegraAlerta>> {
  return simulate(() => {
    if (!SINTOMAS.some((item) => item.id === sintoma_id)) {
      return fail(ERROR_CODE.NOT_FOUND, "Sintoma inexistente ou inativo.");
    }

    REGRAS.set(sintoma_id, { grau: grau_minimo, desde: new Date().toISOString() });
    return respostaDaRegra(sintoma_id);
  });
}

export async function removerRegraAlerta({
  sintoma_id,
}: {
  sintoma_id: string;
}): Promise<SingleResult<RegraAlerta>> {
  return simulate(() => {
    REGRAS.delete(sintoma_id);
    return respostaDaRegra(sintoma_id);
  });
}

/* -------------------------------------------------------------------------
   MOTIVOS DE SITUAÇÃO
   ------------------------------------------------------------------------- */

/** As situações terminais do banco — as únicas que aceitam motivo. */
const SITUACOES: Record<string, string> = {
  completed: "Realizado",
  cancelled: "Cancelado",
  no_show: "Falta",
  rescheduled: "Remarcado",
};

/** Vazia, como no banco: ninguém escreveu a lista ainda. */
const MOTIVOS: MotivoSituacao[] = [];

/** O mesmo formato que o backend exige: minúsculas, dígitos e underscore. */
const CODIGO_VALIDO = /^[a-z0-9_]+$/;

/**
 * Só os motivos em uso.
 *
 * O filtro reproduz a política do banco, que é `is_active` para quem faz login:
 * aposentar torna a linha invisível ao painel. Um mock que devolvesse as
 * aposentadas faria a tela oferecer um botão de reativar que só funciona aqui.
 */
export async function getMotivos(): Promise<ListResult<MotivoSituacao>> {
  return simulate(() =>
    ok(MOTIVOS.filter((motivo) => motivo.ativo).sort((a, b) => a.ordem - b.ordem)),
  );
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
  return simulate(() => {
    const situacao = SITUACOES[situacao_codigo];
    if (!situacao) {
      return fail(
        ERROR_CODE.VALIDATION,
        `Motivo só se cadastra para situação terminal, e ${situacao_codigo} não é.`,
      );
    }

    if (!CODIGO_VALIDO.test(codigo)) {
      return fail(
        ERROR_CODE.VALIDATION,
        "O código do motivo aceita apenas minúsculas, dígitos e underscore.",
      );
    }

    if (!label.trim()) {
      return fail(ERROR_CODE.VALIDATION, "O rótulo do motivo não pode ser vazio.");
    }

    const motivo: MotivoSituacao = {
      id: `reason-${Date.now()}`,
      situacao_codigo,
      situacao_label: situacao,
      codigo,
      label: label.trim(),
      ordem: ordem ?? 0,
      ativo: true,
    };

    MOTIVOS.push(motivo);
    return okOne(motivo);
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
  return simulate(() => {
    const motivo = MOTIVOS.find((linha) => linha.id === id);
    if (!motivo) return fail(ERROR_CODE.NOT_FOUND, "Motivo inexistente.");

    if (label !== undefined && !label.trim()) {
      return fail(ERROR_CODE.VALIDATION, "O rótulo do motivo não pode ser vazio.");
    }

    // Nulo mantém a coluna — o mesmo contrato da RPC.
    if (label !== undefined) motivo.label = label.trim();
    if (ordem !== undefined) motivo.ordem = ordem;

    return okOne(motivo);
  });
}

export async function setMotivoAtivo({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}): Promise<SingleResult<MotivoSituacao>> {
  return simulate(() => {
    const motivo = MOTIVOS.find((linha) => linha.id === id);
    if (!motivo) return fail(ERROR_CODE.NOT_FOUND, "Motivo inexistente.");

    motivo.ativo = ativo;

    // Aposentado sai da leitura, como no banco: devolver a linha aqui daria à
    // tela um dado que o backend real não devolveria.
    return okOne(ativo ? motivo : null);
  });
}

/* -------------------------------------------------------------------------
   SEGUNDO FATOR OBRIGATÓRIO
   ------------------------------------------------------------------------- */

export async function getSeguranca(): Promise<SingleResult<ConfiguracaoSeguranca>> {
  return simulate(() => okOne(estadoDaSeguranca()));
}

/**
 * Liga e desliga a exigência, com a MESMA guarda do backend.
 *
 * Ligar a partir de uma sessão de um fator é recusado, e a recusa é o ponto:
 * quem liga prova, no ato, que consegue voltar a entrar. Um mock permissivo
 * aqui deixaria a tela parecer pronta e falhar só contra o banco — justamente
 * na operação cujo erro tranca a clínica do lado de fora.
 */
export async function setExigirMfa({
  exigir,
}: {
  exigir: boolean;
}): Promise<SingleResult<ConfiguracaoSeguranca>> {
  return simulate(() => {
    if (exigir && nivelAtual() !== "aal2") {
      return fail(
        ERROR_CODE.FORBIDDEN,
        "Ligue a exigência a partir de uma sessão que já passou pelo segundo fator: caso contrário você se tranca do lado de fora.",
      );
    }

    definirExigenciaDeMfa(exigir, null);
    return okOne(estadoDaSeguranca());
  });
}

export const { update } = SETTINGS_WRITE_OPERATIONS;

/* -------------------------------------------------------------------------
   IDENTIDADE, MENSAGENS E HORÁRIO — `clinic_settings` + `clinic_business_hours`
   -------------------------------------------------------------------------
   Pré-preenchido, ao contrário da base real (que nasceu vazia em 25/09/2026):
   é a única forma de a tela mostrar o estado "configurado" sem alguém abrir o
   painel e preencher os três formulários primeiro. Continua editável — nada
   aqui é somente leitura.
   ------------------------------------------------------------------------- */

const CLINICA: ClinicaConfiguracao = {
  cor_primaria: "#00aa92",
  cor_secundaria: "#2dc5a6",
  logo_path: null,
  logo_url: null,
  fuso: "America/Sao_Paulo",
  slides_onboarding: [
    { titulo: "Bem-vindo à Jornada Supera", corpo: "Acompanhe seu tratamento em um só lugar." },
    { titulo: "Diário de sintomas", corpo: "Registre como você está se sentindo todos os dias." },
  ],
  mensagem_fora_horario: "Nosso atendimento volta no próximo horário comercial. Em caso de urgência, procure o pronto-socorro.",
  intervalos: [1, 2, 3, 4, 5].map((dia_semana) => ({ dia_semana, abre: "08:00", fecha: "18:00" })),
};

export async function getClinica(): Promise<SingleResult<ClinicaConfiguracao>> {
  return simulate(() => okOne({ ...CLINICA, slides_onboarding: [...CLINICA.slides_onboarding], intervalos: [...CLINICA.intervalos] }));
}

/** Simula o upload com uma URL local — não sai do navegador, mas serve de prévia real. */
export async function uploadLogo({
  arquivo,
}: {
  arquivo: File;
}): Promise<SingleResult<{ path: string; url: string }>> {
  return simulate(() => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(arquivo.type)) {
      return fail(ERROR_CODE.VALIDATION, "O logo aceita apenas PNG, JPEG ou WebP.");
    }

    if (arquivo.size > 2 * 1024 * 1024) {
      return fail(ERROR_CODE.VALIDATION, "O logo precisa ter até 2 MB.");
    }

    const path = `logo/${arquivo.name}`;
    return okOne({ path, url: URL.createObjectURL(arquivo) });
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
  return simulate(() => {
    CLINICA.cor_primaria = corPrimaria;
    CLINICA.cor_secundaria = corSecundaria;
    CLINICA.logo_path = logoPath;
    // O mock não tem bucket: a URL de prévia que `uploadLogo` devolveu já é o
    // suficiente para a tela mostrar o logo novo depois de salvar.
    return okOne({ ...CLINICA });
  });
}

export async function salvarMensagens({
  slidesOnboarding,
  mensagemForaHorario,
}: {
  slidesOnboarding: SlideOnboarding[];
  mensagemForaHorario: string | null;
}): Promise<SingleResult<ClinicaConfiguracao>> {
  return simulate(() => {
    CLINICA.slides_onboarding = slidesOnboarding;
    CLINICA.mensagem_fora_horario = mensagemForaHorario;
    return okOne({ ...CLINICA });
  });
}

export async function salvarHorario({
  fuso,
  intervalos,
}: {
  fuso: string;
  intervalos: IntervaloAtendimento[];
}): Promise<SingleResult<ClinicaConfiguracao>> {
  return simulate(() => {
    CLINICA.fuso = fuso;
    CLINICA.intervalos = intervalos;
    return okOne({ ...CLINICA });
  });
}

/* -------------------------------------------------------------------------
   METAS OPERACIONAIS — linhas de referência do gráfico de volume
   -------------------------------------------------------------------------
   Os dois números do protótipo (320 e 380), já cadastrados — ao contrário do
   backend real, onde a tabela nasce vazia. É o mock demonstrando o desenho com
   a linha de referência presente; a ausência real fica só do lado Supabase.
   ------------------------------------------------------------------------- */

const METAS = new Map<string, ParametroOperacional>(
  [
    { codigo: "monthly_appointments_target", rotulo: "Meta mensal", valor: 320 },
    { codigo: "monthly_appointments_capacity", rotulo: "Capacidade máxima", valor: 380 },
  ].map((meta) => [meta.codigo, meta]),
);

export async function getMetasOperacionais(): Promise<ListResult<ParametroOperacional>> {
  return simulate(() => {
    const linhas = METAS_OPERACIONAIS.map(({ codigo }) => METAS.get(codigo)).filter(
      (meta): meta is ParametroOperacional => Boolean(meta),
    );

    return ok(linhas, linhas.length);
  });
}

export async function salvarMetaOperacional({
  codigo,
  rotulo,
  valor,
}: {
  codigo: string;
  rotulo: string;
  valor: number;
}): Promise<SingleResult<ParametroOperacional>> {
  return simulate(() => {
    if (valor < 0) return fail(ERROR_CODE.VALIDATION, "O valor do parâmetro é um número não negativo.");

    const meta = { codigo, rotulo, valor };
    METAS.set(codigo, meta);
    return okOne(meta);
  });
}

/* -------------------------------------------------------------------------
   FILA DE CONFERÊNCIA DA INTEGRAÇÃO
   -------------------------------------------------------------------------
   Vazia, como no banco: a sincronização está desligada e nenhum vínculo foi
   proposto. Semear vínculos fictícios faria a tela parecer em uso e esconderia
   o estado real — que é o de uma fila construída ANTES de precisar dela.
   ------------------------------------------------------------------------- */

const VINCULOS: VinculoExterno[] = [];

export async function getVinculosExternos(): Promise<ListResult<VinculoExterno>> {
  return simulate(() => ok(VINCULOS));
}

export async function confirmarVinculoExterno({
  id,
  confirmar,
}: {
  id: string;
  confirmar: boolean;
}): Promise<SingleResult<VinculoExterno>> {
  return simulate(() => {
    const indice = VINCULOS.findIndex((vinculo) => vinculo.id === id);
    if (indice < 0) {
      return fail(
        ERROR_CODE.NOT_FOUND,
        "Este vínculo já foi conferido por alguém. Recarregue a fila para ver a decisão que está valendo.",
      );
    }

    // Decidido sai da fila nos dois casos — confirmar e rejeitar tiram a linha
    // de "proposto", que é o único estado que a fila mostra.
    void confirmar;
    VINCULOS.splice(indice, 1);

    return okOne<VinculoExterno>(null);
  });
}

/* -------------------------------------------------------------------------
   CONSENTIMENTOS
   ------------------------------------------------------------------------- */

/**
 * Um aceite por versão vigente, para a tela ter o que mostrar.
 *
 * Diferente da fila acima, aqui o vazio não seria informativo: a base fictícia
 * tem termos publicados, e termo publicado sem nenhum aceite é o estado de
 * quem acabou de publicar — não o estado normal.
 */
const CONSENTIMENTOS: Consentimento[] = TERMOS.filter((versao) => versao.vigente).map(
  (versao, indice) => ({
    id: `consentimento-${versao.id}`,
    pessoa: indice === 0 ? "Helena Marques" : "Rogério Antunes",
    documento: `${versao.tipo_label} · versão ${versao.versao}`,
    aceito_em: versao.publicado_em ?? new Date().toISOString(),
    revogado_em: null,
  }),
);

export async function getConsentimentos(): Promise<ListResult<Consentimento>> {
  return simulate(() => ok(CONSENTIMENTOS));
}

/* -------------------------------------------------------------------------
   PEDIDOS DO TITULAR (LGPD)
   ------------------------------------------------------------------------- */

/**
 * Pedidos como os que a base real tem hoje: três abertos, dos três tipos que
 * não pedem nada do painel além da decisão (acesso, portabilidade e
 * exclusão), mais uma correção já deferida — para exercitar o botão
 * "marcar como cumprida", que só existe para este tipo e este status.
 */
const SOLICITACOES: SolicitacaoTitular[] = [
  {
    id: "lgpd-001",
    pessoa: "Marina Vasconcelos",
    tipo: "access",
    tipo_label: "Acesso aos dados",
    status: "requested",
    status_label: "Aberto",
    criado_em: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    decidido_em: null,
    decidido_por: null,
    observacao: null,
    aberto: true,
    completavel: false,
    execucao_erro: null,
  },
  {
    id: "lgpd-002",
    pessoa: "Otávio Beltrão",
    tipo: "portability",
    tipo_label: "Portabilidade",
    status: "requested",
    status_label: "Aberto",
    criado_em: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    decidido_em: null,
    decidido_por: null,
    observacao: null,
    aberto: true,
    completavel: false,
    execucao_erro: null,
  },
  {
    id: "lgpd-003",
    pessoa: "Renata Falcão",
    tipo: "deletion",
    tipo_label: "Exclusão de dados",
    status: "requested",
    status_label: "Aberto",
    criado_em: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    decidido_em: null,
    decidido_por: null,
    observacao: null,
    aberto: true,
    completavel: false,
    execucao_erro: null,
  },
  {
    id: "lgpd-004",
    pessoa: "Igor Mesquita",
    tipo: "rectification",
    tipo_label: "Correção de dados",
    status: "granted",
    status_label: "Deferido",
    criado_em: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    decidido_em: new Date(Date.now() - 18 * 86_400_000).toISOString(),
    decidido_por: "Administração",
    observacao: "Telefone de contato desatualizado na ficha.",
    aberto: false,
    completavel: true,
    execucao_erro: null,
  },
];

export async function getSolicitacoesTitular(): Promise<ListResult<SolicitacaoTitular>> {
  return simulate(() =>
    ok(
      [...SOLICITACOES].sort(
        (a, b) => Number(b.aberto) - Number(a.aberto) || b.criado_em.localeCompare(a.criado_em),
      ),
    ),
  );
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
  return simulate(() => {
    const solicitacao = SOLICITACOES.find((linha) => linha.id === id);
    if (!solicitacao) return fail(ERROR_CODE.NOT_FOUND, "Pedido não encontrado.");

    // Mesma recusa do backend: só pedido aberto aceita decisão.
    if (!solicitacao.aberto) {
      return fail(ERROR_CODE.VALIDATION, "Este pedido já foi decidido.");
    }

    solicitacao.status = deferir ? "granted" : "refused";
    solicitacao.status_label = deferir ? "Deferido" : "Recusado";
    solicitacao.decidido_em = new Date().toISOString();
    solicitacao.decidido_por = "Administração";
    solicitacao.observacao = observacao;
    solicitacao.aberto = false;
    solicitacao.completavel = deferir && solicitacao.tipo === "rectification";

    return okOne(solicitacao);
  });
}

export async function completarSolicitacaoTitular({
  id,
  observacao,
}: {
  id: string;
  observacao?: string;
}): Promise<SingleResult<SolicitacaoTitular>> {
  return simulate(() => {
    const solicitacao = SOLICITACOES.find((linha) => linha.id === id);
    if (!solicitacao) return fail(ERROR_CODE.NOT_FOUND, "Pedido não encontrado.");

    // Mesma guarda do backend: só correção deferida chega a "cumprido".
    if (!solicitacao.completavel) {
      return fail(
        ERROR_CODE.VALIDATION,
        "Este pedido não pode ser marcado como cumprido por aqui.",
      );
    }

    solicitacao.status = "executed";
    solicitacao.status_label = "Cumprido";
    solicitacao.observacao = observacao?.trim() || solicitacao.observacao;
    solicitacao.completavel = false;

    return okOne(solicitacao);
  });
}
