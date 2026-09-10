import { ESPECIALIDADE_LABEL, type Especialidade } from "@/lib/enums";
import { ok, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type {
  EstatisticasOperacionais,
  IndicadorOperacional,
  LinhaEspecialidade,
  PontoVolume,
} from "@/types/estatisticas";
import { simulate } from "./_helpers";

/**
 * Estatísticas operacionais — os números do protótipo.
 *
 * Os valores são os que a tela de referência mostra, fixos: aqui eles servem
 * para conferir o desenho, não para medir nada. O adapter Supabase é que
 * calcula de verdade, a partir da agenda e do chat.
 *
 * `sem_origem` é vazio no mock porque o mock inventa meta e capacidade — no
 * backend elas não existem, e a diferença está declarada nos dois lados.
 */

const POR_ESPECIALIDADE: LinhaEspecialidade[] = (
  [
    ["medico_oncologista", 142, 8, 4, 11],
    ["enfermeiro", 342, 12, 6, 19],
    ["farmaceutico", 218, 3, 2, 8],
    ["nutricionista", 78, 5, 3, 7],
    ["psicologo", 52, 4, 2, 5],
    ["dentista", 41, 2, 1, 3],
    ["fisioterapeuta", 34, 3, 1, 4],
  ] as [Especialidade, number, number, number, number][]
).map(([especialidade, volume, faltas, cancelamentos, remarcacoes]) => ({
  especialidade,
  label: ESPECIALIDADE_LABEL[especialidade],
  volume,
  faltas,
  cancelamentos,
  remarcacoes,
}));

const VOLUME_MENSAL: PontoVolume[] = [
  { mes: "mar/26", total: 288 },
  { mes: "abr/26", total: 302 },
  { mes: "mai/26", total: 297 },
  { mes: "jun/26", total: 318 },
  { mes: "jul/26", total: 331 },
  { mes: "ago/26", total: 326 },
  { mes: "set/26", total: 344 },
];

const INDICADORES: IndicadorOperacional[] = [
  {
    chave: "tempo_resposta_chat",
    label: "Tempo resp. chat",
    valor: 18,
    unidade: "min",
    contexto: "média da equipe",
    inverter_cor: true,
  },
  {
    chave: "taxa_falta",
    label: "Taxa de falta",
    valor: 6.4,
    unidade: "%",
    contexto: "mês atual",
    inverter_cor: true,
  },
  {
    chave: "atendimentos_semana",
    label: "Atendimentos / sem",
    valor: 184,
    unidade: "",
    contexto: "por especialidade média",
  },
  {
    chave: "mensagens_dia",
    label: "Mensagens / dia",
    valor: 47,
    unidade: "",
    contexto: "recebidas no chat",
  },
];

export async function getIndicadores(): Promise<SingleResult<EstatisticasOperacionais>> {
  return simulate(() =>
    okOne({
      indicadores: INDICADORES,
      por_especialidade: POR_ESPECIALIDADE,
      volume_mensal: VOLUME_MENSAL,
      sem_origem: [],
    }),
  );
}

export async function getTempoResposta(): Promise<SingleResult<IndicadorOperacional>> {
  return simulate(() => okOne(INDICADORES[0] ?? null));
}

export async function getAdesaoAgenda(): Promise<ListResult<LinhaEspecialidade>> {
  return simulate(() => ok(POR_ESPECIALIDADE));
}

export async function getGargalos(): Promise<ListResult<PontoVolume>> {
  return simulate(() => ok(VOLUME_MENSAL));
}

/** Ver o adapter Supabase: não há tabela de alerta. O mock não inventa uma. */
export async function getFilaAlertas(): Promise<ListResult<never>> {
  return simulate(() => ok([]));
}
