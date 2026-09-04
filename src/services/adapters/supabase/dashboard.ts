import { PERIODO, type Periodo } from "@/lib/enums";
import { okOne, type SingleResult } from "@/services/contracts";
import type { Kpi, KpisResposta, SeriesResposta } from "@/types/dashboard";
import { TETO_READ, executar, falhaDe } from "./_helpers";
import { getSupabaseClient } from "./client";

/**
 * Painel executivo.
 *
 * > [!] O banco não tem camada de agregação.
 * Não existe view nem RPC que some, agrupe ou faça série temporal. O que este
 * adapter entrega é o que dá para afirmar contando linhas que o painel já tem
 * direito de ler — e nada além disso.
 *
 * Dos seis indicadores do protótipo, dois têm fonte:
 *
 * | Indicador           | Situação |
 * |---------------------|----------|
 * | Pacientes ativos    | ✅ `read_patients` |
 * | Novos pacientes     | ✅ `read_patients`, por `created_at` |
 * | Sessões de quimio   | ❌ `read_appointments` é por paciente; não há agenda global |
 * | Engajamento do app  | ❌ o diário só se lê paciente a paciente |
 * | NPS                 | ❌ não existe no banco |
 * | Alertas ativos      | ❌ não há tabela de alerta nem regra de criticidade |
 *
 * Os quatro sem fonte são **omitidos**, não zerados. Um cartão marcando zero
 * afirma que a clínica não teve nenhuma sessão de quimioterapia no mês — que é
 * uma informação falsa, e pior do que a ausência do cartão.
 *
 * A alternativa seria varrer o diário e a agenda paciente por paciente pelas
 * funções `read_*`. Cada uma dessas chamadas grava uma linha em `audit_log`:
 * desenhar um gráfico produziria centenas de registros de "administrador leu o
 * prontuário de fulano", que é exatamente o evento que a trilha existe para
 * sinalizar. Agregação é trabalho do banco.
 */

/* -------------------------------------------------------------------------
   JANELA DE COMPARAÇÃO
   ------------------------------------------------------------------------- */

const DIAS_POR_PERIODO: Record<Periodo, number> = {
  [PERIODO.DIARIO]: 1,
  [PERIODO.SEMANAL]: 7,
  [PERIODO.MENSAL]: 30,
};

const ROTULO_PERIODO: Record<Periodo, string> = {
  [PERIODO.DIARIO]: "dia",
  [PERIODO.SEMANAL]: "semana",
  [PERIODO.MENSAL]: "mês",
};

const BALDES_HISTORICO = 7;
const UM_DIA = 24 * 60 * 60 * 1000;

interface LinhaPaciente {
  is_active: boolean;
  created_at: string;
}

/**
 * Série de `BALDES_HISTORICO` pontos, do mais antigo ao mais recente.
 *
 * `cumulativo` distingue as duas leituras: o total de pacientes ativos é um
 * acumulado (quantos existiam ao fim de cada balde), enquanto entradas novas
 * são a contagem dentro do balde.
 */
function historico(
  datas: number[],
  dias: number,
  { cumulativo }: { cumulativo: boolean },
): number[] {
  const agora = Date.now();
  const largura = dias * UM_DIA;

  return Array.from({ length: BALDES_HISTORICO }, (_, indice) => {
    const fim = agora - (BALDES_HISTORICO - 1 - indice) * largura;
    const inicio = fim - largura;

    return datas.filter((data) => (cumulativo ? data <= fim : data > inicio && data <= fim)).length;
  });
}

/* -------------------------------------------------------------------------
   INDICADORES
   ------------------------------------------------------------------------- */

export async function getKpis(
  params: { periodo?: Periodo } = {},
): Promise<SingleResult<KpisResposta>> {
  return executar(async () => {
    const periodo = params.periodo ?? PERIODO.MENSAL;
    const dias = DIAS_POR_PERIODO[periodo];
    const rotulo = ROTULO_PERIODO[periodo];

    const { data, error } = await getSupabaseClient().rpc("read_patients", {
      p_limit: TETO_READ,
      p_offset: 0,
    });

    if (error) return falhaDe(error);

    const linhas = (data ?? []) as LinhaPaciente[];
    const ativos = linhas.filter((linha) => linha.is_active);

    // `read_patients` tem teto de 200 linhas no servidor. Batendo no teto, o
    // número é um piso, não um total — e a tela precisa dizer isso.
    const parcial = linhas.length >= TETO_READ;

    const agora = Date.now();
    const corte = agora - dias * UM_DIA;
    const corteAnterior = corte - dias * UM_DIA;

    const entradas = linhas.map((linha) => new Date(linha.created_at).getTime());
    const noPeriodo = entradas.filter((data) => data > corte).length;
    const noPeriodoAnterior = entradas.filter(
      (data) => data > corteAnterior && data <= corte,
    ).length;

    const kpis: Kpi[] = [
      {
        id: "pacientes_ativos",
        label: "Pacientes ativos",
        valor: ativos.length,
        variacao: ativos
          .map((linha) => new Date(linha.created_at).getTime())
          .filter((data) => data > corte).length,
        variacao_unidade: "",
        variacao_periodo: rotulo,
        contexto: parcial ? "em tratamento (parcial)" : "em tratamento",
        historico: historico(
          ativos.map((linha) => new Date(linha.created_at).getTime()),
          dias,
          { cumulativo: true },
        ),
      },
      {
        id: "novos_pacientes",
        label: "Novos pacientes",
        valor: noPeriodo,
        variacao: noPeriodo - noPeriodoAnterior,
        variacao_unidade: "",
        variacao_periodo: rotulo,
        contexto: `entrada ${periodo === PERIODO.DIARIO ? "hoje" : `n${periodo === PERIODO.SEMANAL ? "a semana" : "o mês"}`}`,
        historico: historico(entradas, dias, { cumulativo: false }),
      },
    ];

    return okOne<KpisResposta>({ periodo, kpis, atualizado_em: new Date().toISOString() });
  });
}

/**
 * Séries dos gráficos.
 *
 * Nenhuma tem fonte: sessões e ocupação dependem da agenda agregada, a
 * distribuição por CID dependeria de ler o diagnóstico de cada paciente um a
 * um, e efeitos por protocolo dependem do cruzamento que o nível Médio prevê e
 * o banco ainda não expõe.
 *
 * A resposta vem vazia e bem formada, para a tela exibir o aviso de pendência
 * em vez de um gráfico sem eixo.
 */
export async function getSeries(
  params: { periodo?: Periodo } = {},
): Promise<SingleResult<SeriesResposta>> {
  return okOne<SeriesResposta>({
    periodo: params.periodo ?? PERIODO.MENSAL,
    sessoes: [],
    meta_sessoes: 0,
    ocupacao_percentual: 0,
    pacientes_por_cid: [],
    efeitos_por_protocolo: [],
    engajamento: [],
    atualizado_em: new Date().toISOString(),
  });
}
