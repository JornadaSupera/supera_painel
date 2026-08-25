import type { Periodo } from "@/lib/enums";
import type {
  EfeitoPorProtocolo,
  FatiaCid,
  Kpi,
  PontoEngajamento,
  PontoSessoes,
} from "@/types/dashboard";

/**
 * Métricas do painel executivo.
 *
 * Valores e rótulos vêm da tela do protótipo:
 * https://strawti.com.br/prototipos/jornada-supera/admin/
 *
 * > [!] Tudo aqui é agregado.
 * O dashboard não mostra registro individual identificável — o próprio
 * protótipo declara isso em nota de rodapé. Nenhuma métrica desta tela carrega
 * `paciente_id`, nome ou CPF, e nenhuma deve passar a carregar.
 */

/* -------------------------------------------------------------------------
   KPIs — os cinco cards do protótipo
   ------------------------------------------------------------------------- */

const KPIS_MENSAL: Kpi[] = [
  {
    id: "pacientes_ativos",
    label: "Pacientes ativos",
    valor: 127,
    variacao: 8,
    variacao_unidade: "",
    variacao_periodo: "mês",
    contexto: "em tratamento",
    historico: [104, 109, 112, 116, 119, 119, 127],
    relatorio_slug: "pacientes-ativos",
  },
  {
    id: "novos_pacientes",
    label: "Novos pacientes",
    valor: 12,
    variacao: 3,
    variacao_unidade: "",
    variacao_periodo: "mês",
    contexto: "entrada no mês",
    historico: [7, 11, 9, 14, 8, 9, 12],
    relatorio_slug: "novos-pacientes",
  },
  {
    id: "sessoes_quimio",
    label: "Sessões de quimio",
    valor: 342,
    variacao: 5,
    variacao_unidade: "%",
    variacao_periodo: "mês",
    contexto: "realizadas no mês",
    historico: [281, 298, 304, 312, 326, 325, 342],
    relatorio_slug: "sessoes-quimioterapia",
  },
  {
    id: "engajamento_app",
    label: "Engajamento app",
    valor: 73,
    unidade: "%",
    variacao: 5,
    variacao_unidade: "pp",
    variacao_periodo: "mês",
    contexto: "ativos 7d / total",
    historico: [61, 63, 66, 65, 68, 68, 73],
    relatorio_slug: "engajamento-pacientes",
  },
  {
    // Só existe porque contratamos o nível Médio. No protótipo, este cartão
    // desaparece ao alternar o seletor de plano para MVP.
    id: "nps",
    label: "NPS",
    valor: 72,
    variacao: 4,
    variacao_unidade: "",
    variacao_periodo: "",
    contexto: "passa de 70 = excelente",
    nivel: "medio",
    historico: [58, 61, 64, 66, 68, 68, 72],
    relatorio_slug: "satisfacao-nps",
  },
  {
    id: "alertas_ativos",
    label: "Alertas ativos",
    valor: 5,
    variacao: -2,
    variacao_unidade: "",
    variacao_periodo: "mês",
    contexto: "alta + crítica",
    // Alerta que cai é bom: o verde precisa acompanhar a queda.
    inverter_cor: true,
    historico: [11, 9, 12, 8, 7, 7, 5],
    relatorio_slug: "alertas-ia",
  },
];

/**
 * Os mesmos indicadores em recortes menores.
 * O protótipo mostra o mensal; diário e semanal existem porque o PDF §5 pede
 * "visualização diária, semanal e mensal".
 */
const KPIS_SEMANAL: Kpi[] = [
  { ...KPIS_MENSAL[0]!, valor: 127, variacao: 2, variacao_periodo: "semana", historico: [119, 121, 122, 124, 125, 126, 127] },
  { ...KPIS_MENSAL[1]!, valor: 4, variacao: 1, variacao_periodo: "semana", contexto: "entrada na semana", historico: [2, 3, 1, 4, 2, 3, 4] },
  { ...KPIS_MENSAL[2]!, valor: 84, variacao: 3, variacao_periodo: "semana", contexto: "realizadas na semana", historico: [72, 76, 79, 81, 78, 82, 84] },
  { ...KPIS_MENSAL[3]!, valor: 71, variacao: 2, variacao_periodo: "semana", historico: [66, 67, 68, 69, 69, 70, 71] },
  { ...KPIS_MENSAL[4]!, valor: 71, variacao: 1, historico: [66, 67, 68, 69, 70, 70, 71] },
  { ...KPIS_MENSAL[5]!, valor: 5, variacao: -1, variacao_periodo: "semana", historico: [8, 7, 7, 6, 6, 6, 5] },
];

const KPIS_DIARIO: Kpi[] = [
  { ...KPIS_MENSAL[0]!, valor: 127, variacao: 0, variacao_periodo: "dia", historico: [126, 126, 127, 127, 126, 127, 127] },
  { ...KPIS_MENSAL[1]!, valor: 1, variacao: 0, variacao_periodo: "dia", contexto: "entrada hoje", historico: [0, 1, 2, 0, 1, 1, 1] },
  { ...KPIS_MENSAL[2]!, valor: 18, variacao: 2, variacao_periodo: "dia", contexto: "realizadas hoje", historico: [14, 16, 19, 15, 17, 16, 18] },
  { ...KPIS_MENSAL[3]!, valor: 70, variacao: 1, variacao_periodo: "dia", historico: [68, 69, 69, 70, 69, 69, 70] },
  // O NPS vem de pesquisa: não muda de um dia para o outro.
  { ...KPIS_MENSAL[4]!, valor: 72, variacao: 0, historico: [70, 70, 71, 71, 72, 72, 72] },
  { ...KPIS_MENSAL[5]!, valor: 5, variacao: 1, variacao_periodo: "dia", historico: [3, 4, 4, 5, 4, 4, 5] },
];

export const kpisPorPeriodo: Record<Periodo, Kpi[]> = {
  diario: KPIS_DIARIO,
  semanal: KPIS_SEMANAL,
  mensal: KPIS_MENSAL,
};

/* -------------------------------------------------------------------------
   SÉRIES DOS GRÁFICOS
   ------------------------------------------------------------------------- */

/** "Sessões de quimioterapia" · últimos 7 meses · meta 320/mês · ocupação 85%. */
export const sessoesQuimio: Record<Periodo, PontoSessoes[]> = {
  mensal: [
    { periodo: "Nov", sessoes: 281 },
    { periodo: "Dez", sessoes: 298 },
    { periodo: "Jan", sessoes: 304 },
    { periodo: "Fev", sessoes: 312 },
    { periodo: "Mar", sessoes: 326 },
    { periodo: "Abr", sessoes: 325 },
    { periodo: "Mai", sessoes: 342 },
  ],
  semanal: [
    { periodo: "S14", sessoes: 72 },
    { periodo: "S15", sessoes: 76 },
    { periodo: "S16", sessoes: 79 },
    { periodo: "S17", sessoes: 81 },
    { periodo: "S18", sessoes: 78 },
    { periodo: "S19", sessoes: 82 },
    { periodo: "S20", sessoes: 84 },
  ],
  diario: [
    { periodo: "Sex", sessoes: 14 },
    { periodo: "Sáb", sessoes: 4 },
    { periodo: "Dom", sessoes: 0 },
    { periodo: "Seg", sessoes: 19 },
    { periodo: "Ter", sessoes: 17 },
    { periodo: "Qua", sessoes: 16 },
    { periodo: "Qui", sessoes: 18 },
  ],
};

export const META_SESSOES_MES = 320;
export const OCUPACAO_PERCENTUAL = 85;

/** "Pacientes por CID" · distribuição atual. */
export const pacientesPorCid: FatiaCid[] = [
  { nome: "C50.9", valor: 38, descricao: "Mama, não especificada" },
  { nome: "C18.9", valor: 27, descricao: "Cólon, não especificado" },
  { nome: "C34.9", valor: 21, descricao: "Brônquios e pulmão" },
  { nome: "C20", valor: 16, descricao: "Reto" },
  { nome: "Outros", valor: 25, descricao: "Demais diagnósticos" },
];

/**
 * "Efeitos adversos por protocolo" · % de pacientes com grau 2+.
 * O protótipo anota: "pergunta levantada na reunião com a Dra.".
 */
export const efeitosPorProtocolo: EfeitoPorProtocolo[] = [
  { protocolo: "FOLFOX", nausea: 42, fadiga: 58, neuropatia: 37, diarreia: 24 },
  { protocolo: "FOLFIRI", nausea: 39, fadiga: 51, neuropatia: 12, diarreia: 44 },
  { protocolo: "AC-T", nausea: 55, fadiga: 71, neuropatia: 19, diarreia: 14 },
  { protocolo: "TCH", nausea: 34, fadiga: 46, neuropatia: 22, diarreia: 21 },
  { protocolo: "R-CHOP", nausea: 21, fadiga: 33, neuropatia: 9, diarreia: 11 },
];

/** "Engajamento ao longo das semanas" · % de pacientes ativos no app. */
export const engajamentoSemanal: PontoEngajamento[] = [
  { periodo: "S13", engajamento: 61 },
  { periodo: "S14", engajamento: 63 },
  { periodo: "S15", engajamento: 66 },
  { periodo: "S16", engajamento: 65 },
  { periodo: "S17", engajamento: 68 },
  { periodo: "S18", engajamento: 68 },
  { periodo: "S19", engajamento: 71 },
  { periodo: "S20", engajamento: 73 },
];
