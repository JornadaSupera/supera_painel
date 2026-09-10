import { FASE_TRATAMENTO_LABEL } from "@/lib/enums";
import { cids } from "@/mocks/cids";
import { pacientes } from "@/mocks/pacientes";
import { protocolos } from "@/mocks/protocolos";
import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type { DefinicaoRelatorio, ResultadoRelatorio } from "@/types/relatorio";
import { DEFINICOES } from "../relatoriosDefinicoes";
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
  return simulate(() =>
    ok(
      DEFINICOES.map((definicao) => {
        const motivo = SEM_ORIGEM[definicao.slug];
        return motivo ? { ...definicao, disponivel: false, motivo } : { ...definicao, disponivel: true };
      }),
    ),
  );
}

interface ParametrosRelatorio {
  slug: string;
  dias?: number;
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

async function montar(slug: string, dias: number): Promise<ResultadoRelatorio | null> {
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

    case "efeitos-por-protocolo": {
      const cruzamento = await crossTab({ dias, grauMinimo: 2, apenasAtivos: true });
      const dados = cruzamento.data;

      return {
        slug,
        titulo: "Efeitos adversos por protocolo e grau",
        colunas: [
          { key: "protocolo", label: "Protocolo" },
          { key: "efeito", label: "Efeito adverso" },
          { key: "pacientes", label: "Pacientes", numerica: true },
          { key: "base", label: "No protocolo", numerica: true },
          { key: "prevalencia", label: "Prevalência (%)", numerica: true },
        ],
        linhas: (dados?.celulas ?? [])
          .filter((celula) => celula.pacientes_com > 0)
          .map((celula) => ({
            protocolo: celula.protocolo,
            efeito: celula.sintoma_label,
            pacientes: celula.pacientes_com,
            base: celula.pacientes_total,
            prevalencia: celula.percentual ?? 0,
          }))
          .sort((a, b) => b.prevalencia - a.prevalencia),
        resumo: `grau 2 ou maior · ${dados?.pacientes_considerados ?? 0} pacientes · últimos ${dias} dias`,
        eixo: "efeito",
        medida: "prevalencia",
      };
    }

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
    case "volume-por-especialidade": {
      const operacionais = await getIndicadores();
      const linhas = operacionais.data?.por_especialidade ?? [];

      if (slug === "volume-por-especialidade") {
        return {
          slug,
          titulo: "Volume de atendimento por especialidade",
          colunas: [
            { key: "especialidade", label: "Especialidade" },
            { key: "volume", label: "Atendimentos", numerica: true },
          ],
          linhas: linhas.map((linha) => ({ especialidade: linha.label, volume: linha.volume })),
          resumo: `${linhas.reduce((soma, linha) => soma + linha.volume, 0)} compromissos no período`,
          eixo: "especialidade",
          medida: "volume",
        };
      }

      return {
        slug,
        titulo: "Faltas, cancelamentos e remarcações",
        colunas: [
          { key: "especialidade", label: "Especialidade" },
          { key: "faltas", label: "Faltas", numerica: true },
          { key: "cancelamentos", label: "Cancelamentos", numerica: true },
          { key: "remarcacoes", label: "Remarcações", numerica: true },
          { key: "taxa_falta", label: "Taxa de falta (%)", numerica: true },
        ],
        linhas: linhas.map((linha) => ({
          especialidade: linha.label,
          faltas: linha.faltas,
          cancelamentos: linha.cancelamentos,
          remarcacoes: linha.remarcacoes,
          taxa_falta:
            linha.volume === 0 ? 0 : Math.round((linha.faltas / linha.volume) * 1000) / 10,
        })),
        resumo: "motivos de falta indisponíveis: o catálogo de motivos está vazio",
        eixo: "especialidade",
        medida: "faltas",
      };
    }

    case "engajamento-app": {
      const comAcesso = pacientes.filter((paciente) => paciente.ultimo_acesso_app_em !== null);

      return {
        slug,
        titulo: "Engajamento dos pacientes no app",
        colunas: [
          { key: "indicador", label: "Indicador" },
          { key: "valor", label: "Valor", numerica: true },
        ],
        linhas: [
          { indicador: "Pacientes em tratamento", valor: ativos.length },
          { indicador: `Acessaram o app (${dias} dias)`, valor: comAcesso.length },
          {
            indicador: "Taxa de engajamento (%)",
            valor:
              ativos.length === 0
                ? 0
                : Math.round((comAcesso.length / ativos.length) * 1000) / 10,
          },
        ],
        resumo: `${comAcesso.length} de ${ativos.length} pacientes ativos acessaram o aplicativo`,
        eixo: "indicador",
        medida: "valor",
      };
    }

    case "tempo-resposta-chat": {
      const operacionais = await getIndicadores();
      const indicador = operacionais.data?.indicadores.find(
        (item) => item.chave === "tempo_resposta_chat",
      );

      return {
        slug,
        titulo: "Tempo médio de resposta no chat",
        colunas: [
          { key: "indicador", label: "Indicador" },
          { key: "valor", label: "Minutos", numerica: true },
        ],
        linhas:
          indicador?.valor == null ? [] : [{ indicador: "Média da equipe", valor: indicador.valor }],
        resumo: "média da primeira resposta a cada conversa · por equipe, nunca por profissional",
        eixo: "indicador",
        medida: "valor",
      };
    }

    default:
      return null;
  }
}

export async function run(params: ParametrosRelatorio): Promise<SingleResult<ResultadoRelatorio>> {
  const motivo = SEM_ORIGEM[params.slug];
  if (motivo) return fail(ERROR_CODE.NOT_IMPLEMENTED, motivo);

  const resultado = await montar(params.slug, params.dias ?? 30);

  if (!resultado) {
    return fail(ERROR_CODE.NOT_FOUND, `Relatório "${params.slug}" não existe no catálogo.`);
  }

  return simulate(() => okOne(resultado));
}

export async function exportar(
  params: ParametrosRelatorio,
): Promise<ListResult<Record<string, string>>> {
  const resultado = await run(params);

  if (resultado.error) {
    return fail(resultado.error.code, resultado.error.message, resultado.error.details);
  }

  const dados = resultado.data;
  if (!dados) return ok([]);

  return ok(
    dados.linhas.map((linha) =>
      Object.fromEntries(
        dados.colunas.map((coluna) => [coluna.label, String(linha[coluna.key] ?? "")]),
      ),
    ),
  );
}

export { exportar as export };

const SEM_ENVIO =
  "Agendar envio e gerar link compartilhável dependem de rotina agendada e de tabela de token no backend.";

export async function schedule(): Promise<SingleResult<never>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, SEM_ENVIO);
}

export async function listSchedules(): Promise<ListResult<never>> {
  return ok([]);
}

export async function createShareLink(): Promise<SingleResult<never>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, SEM_ENVIO);
}
