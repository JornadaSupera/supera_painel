import { formatNumber, formatPercent, pluralize } from "@/lib/format";
import type { CelulaCruzamento, CruzamentoClinico } from "@/types/estatisticas";

/**
 * DESTAQUES DO CRUZAMENTO — ordenar a própria tabela, e nada além disso.
 * =============================================================================
 * Dois destaques, cada um a linha que encabeça uma ordenação do mapa já lido:
 *
 *  - a combinação protocolo × efeito de **maior prevalência**;
 *  - a de **mais registros**, que mede carga de relato e não prevalência.
 *
 * Não é IA, não prioriza paciente e não sugere conduta: o texto descreve o dado
 * ("maior prevalência no período"). Decidir o que fazer com ele é de quem revisa
 * o protocolo.
 *
 * > [!] Grupo pequeno não vira destaque.
 * Um protocolo com um paciente mostra 100 % em tudo que ele relatou, e nomear
 * essa combinação apontaria uma pessoa. `TAMANHO_MINIMO_DO_GRUPO` barra grupo
 * menor que isso.
 */

/**
 * O menor grupo que pode aparecer num destaque.
 *
 * **Valor provisório**: a clínica ainda não disse qual é o tamanho mínimo que a
 * privacidade dela aceita (pergunta aberta). Quando responder, este é o único
 * número a trocar.
 */
export const TAMANHO_MINIMO_DO_GRUPO = 5;

export interface Destaque {
  chave: "prevalencia" | "registros";
  titulo: string;
  /** A combinação, por extenso: "AC-T · Fadiga". */
  combinacao: string;
  /** O número que justifica o destaque, já dito em palavras. */
  detalhe: string;
}

export interface Destaques {
  itens: Destaque[];
  /** `true` quando havia célula, mas nenhum grupo grande o bastante. */
  ocultosPorTamanho: boolean;
}

function combinacaoDe(celula: CelulaCruzamento): string {
  return `${celula.protocolo} · ${celula.sintoma_label}`;
}

export function destaquesDoCruzamento(dados: CruzamentoClinico): Destaques {
  const comRelato = dados.celulas.filter((celula) => celula.registros > 0);

  const itens: Destaque[] = [];

  // Prevalência só existe com denominador, e o denominador é o tamanho do grupo.
  const candidatasAPrevalencia = comRelato.filter(
    (celula) =>
      celula.percentual !== null &&
      celula.pacientes_total !== null &&
      celula.pacientes_total >= TAMANHO_MINIMO_DO_GRUPO,
  );

  const maiorPrevalencia = [...candidatasAPrevalencia].sort(
    (a, b) => (b.percentual ?? 0) - (a.percentual ?? 0) || b.pacientes_com - a.pacientes_com,
  )[0];

  if (maiorPrevalencia) {
    itens.push({
      chave: "prevalencia",
      titulo: "Maior prevalência no período",
      combinacao: combinacaoDe(maiorPrevalencia),
      detalhe: `${formatPercent(maiorPrevalencia.percentual)} dos ${pluralize(maiorPrevalencia.pacientes_total ?? 0, "paciente", "pacientes")} do protocolo, em grau ${dados.grau_minimo} ou maior`,
    });
  }

  // Carga de relato: o grupo é medido pelos pacientes que relataram, que é o que
  // existe mesmo quando a origem não devolve denominador.
  const candidatasAosRegistros = comRelato.filter(
    (celula) => celula.pacientes_com >= TAMANHO_MINIMO_DO_GRUPO,
  );

  const maisRegistros = [...candidatasAosRegistros].sort((a, b) => b.registros - a.registros)[0];

  if (maisRegistros) {
    itens.push({
      chave: "registros",
      titulo: "Mais relatado no período",
      combinacao: combinacaoDe(maisRegistros),
      detalhe: `${pluralize(maisRegistros.registros, "registro", "registros")} de ${formatNumber(maisRegistros.pacientes_com)} ${
        maisRegistros.pacientes_com === 1 ? "paciente" : "pacientes"
      }${maisRegistros.pacientes_exato ? "" : " (no mínimo)"}, em grau ${dados.grau_minimo} ou maior`,
    });
  }

  return { itens, ocultosPorTamanho: comRelato.length > 0 && itens.length === 0 };
}
