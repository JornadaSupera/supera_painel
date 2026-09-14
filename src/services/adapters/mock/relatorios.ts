import { FASE_TRATAMENTO_LABEL } from "@/lib/enums";
import { cids } from "@/mocks/cids";
import { pacientes } from "@/mocks/pacientes";
import { protocolos } from "@/mocks/protocolos";
import { ERROR_CODE, fail, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type { DefinicaoRelatorio, ResultadoRelatorio } from "@/types/relatorio";
import {
  bySpecialtyReport,
  chatResponseReport,
  createReportOperations,
  effectsByProtocolReport,
  engagementRows,
  isReportFailure,
  listDefinitionsWithout,
  type ReportOutcome,
  type ReportParams,
} from "../_reports";
import { simulate } from "./_helpers";
import { crossTab } from "./estatisticasClinicas";
import { getIndicadores } from "./estatisticasOperacionais";

/**
 * Relatórios — o motor dos doze, sobre a base fictícia.
 *
 * Mesmo catálogo e mesmas colunas do adapter Supabase. Os três indisponíveis
 * também não rodam aqui: não é limitação do mock, é ausência de origem que o
 * backend real tem, e um mock que os produzisse esconderia justamente o que
 * ainda falta contratar ou construir.
 */

const SEM_ORIGEM: Record<string, string> = {
  "alertas-ia":
    "Não existe tabela de alerta nem regra de criticidade. Derivar alerta a partir do grau do sintoma seria inferência clínica feita pelo painel.",
  nps: "Não existe pesquisa de satisfação: nenhuma tabela de resposta, nota ou marco de envio.",
  "conteudo-mais-acessado":
    "A contagem de acessos vive na biblioteca do paciente, fora do alcance da administração.",
};

export async function listDefinitions(): Promise<ListResult<DefinicaoRelatorio>> {
  return simulate(() => listDefinitionsWithout(SEM_ORIGEM));
}

const NOME_PROTOCOLO = new Map(protocolos.map((protocolo) => [protocolo.id, protocolo.nome]));
const NOME_CID = new Map(cids.map((cid) => [cid.codigo, cid.descricao]));

function contar<T>(itens: T[], chave: (item: T) => string): Map<string, number> {
  const total = new Map<string, number>();
  for (const item of itens) {
    const valor = chave(item);
    total.set(valor, (total.get(valor) ?? 0) + 1);
  }
  return total;
}

async function montar(slug: string, dias: number): Promise<ReportOutcome | null> {
  const ativos = pacientes.filter((paciente) => paciente.status === "ativo");

  switch (slug) {
    case "pacientes-ativos": {
      const porChave = contar(
        ativos,
        (paciente) =>
          `${NOME_PROTOCOLO.get(paciente.protocolo_id) ?? "Sem protocolo"}|${FASE_TRATAMENTO_LABEL[paciente.fase]}`,
      );

      return {
        slug,
        titulo: "Pacientes ativos em tratamento",
        colunas: [
          { key: "protocolo", label: "Protocolo" },
          { key: "fase", label: "Fase do tratamento" },
          { key: "total", label: "Pacientes", numerica: true },
        ],
        linhas: [...porChave.entries()]
          .map(([chave, total]) => {
            const [protocolo = "", fase = ""] = chave.split("|");
            return { protocolo, fase, total };
          })
          .sort((a, b) => b.total - a.total),
        resumo: `${ativos.length} pacientes ativos`,
        eixo: "protocolo",
        medida: "total",
      };
    }

    case "novos-pacientes": {
      const desde = Date.now() - dias * 86_400_000;
      const recentes = pacientes.filter((paciente) => Date.parse(paciente.criado_em) >= desde);
      const porMes = contar(recentes, (paciente) => paciente.criado_em.slice(0, 7));

      return {
        slug,
        titulo: "Novos pacientes no período",
        colunas: [
          { key: "mes", label: "Mês" },
          { key: "total", label: "Novos pacientes", numerica: true },
        ],
        linhas: [...porMes.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([mes, total]) => ({ mes, total })),
        resumo: `${recentes.length} cadastros nos últimos ${dias} dias`,
        eixo: "mes",
        medida: "total",
      };
    }

    case "distribuicao-cid": {
      const porCid = contar(pacientes, (paciente) => paciente.cid);

      return {
        slug,
        titulo: "Distribuição de pacientes por CID",
        colunas: [
          { key: "codigo", label: "CID-10" },
          { key: "label", label: "Diagnóstico" },
          { key: "total", label: "Pacientes", numerica: true },
        ],
        linhas: [...porCid.entries()]
          .map(([codigo, total]) => ({ codigo, label: NOME_CID.get(codigo) ?? codigo, total }))
          .sort((a, b) => b.total - a.total),
        resumo: `${porCid.size} códigos com pacientes registrados`,
        eixo: "codigo",
        medida: "total",
      };
    }

    case "efeitos-por-protocolo":
      return effectsByProtocolReport(
        dias,
        await crossTab({ dias, grauMinimo: 2, apenasAtivos: true }),
      );

    case "sessoes-quimioterapia": {
      // A base fictícia não tem agenda; a série vem do volume operacional.
      const operacionais = await getIndicadores();

      return {
        slug,
        titulo: "Sessões de quimioterapia realizadas",
        colunas: [
          { key: "mes", label: "Mês" },
          { key: "total", label: "Sessões realizadas", numerica: true },
        ],
        linhas: (operacionais.data?.volume_mensal ?? []).map((ponto) => ({
          mes: ponto.mes,
          total: Math.round(ponto.total * 0.42),
        })),
        resumo: `últimos ${dias} dias · taxa de ocupação da sala indisponível (capacidade não é dado do backend)`,
        eixo: "mes",
        medida: "total",
      };
    }

    case "faltas-cancelamentos":
    case "volume-por-especialidade":
      return bySpecialtyReport(slug, await getIndicadores());

    case "engajamento-app": {
      const comAcesso = pacientes.filter((paciente) => paciente.ultimo_acesso_app_em !== null);

      return {
        slug,
        titulo: "Engajamento dos pacientes no app",
        colunas: [
          { key: "indicador", label: "Indicador" },
          { key: "valor", label: "Valor", numerica: true },
        ],
        linhas: engagementRows(
          ativos.length,
          comAcesso.length,
          `Acessaram o app (${dias} dias)`,
        ),
        resumo: `${comAcesso.length} de ${ativos.length} pacientes ativos acessaram o aplicativo`,
        eixo: "indicador",
        medida: "valor",
      };
    }

    case "tempo-resposta-chat":
      return chatResponseReport(await getIndicadores());

    default:
      return null;
  }
}

export async function run(params: ReportParams): Promise<SingleResult<ResultadoRelatorio>> {
  const motivo = SEM_ORIGEM[params.slug];
  if (motivo) return fail(ERROR_CODE.NOT_IMPLEMENTED, motivo);

  const resultado = await montar(params.slug, params.dias ?? 30);

  if (!resultado) {
    return fail(ERROR_CODE.NOT_FOUND, `Relatório "${params.slug}" não existe no catálogo.`);
  }

  if (isReportFailure(resultado)) return resultado;

  return simulate(() => okOne(resultado));
}

export const { exportar, schedule, listSchedules, createShareLink } = createReportOperations(run);

export { exportar as export };
