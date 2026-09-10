import type { DefinicaoRelatorio } from "@/types/relatorio";

/**
 * AS DOZE DEFINIÇÕES — compartilhadas pelos dois adapters.
 *
 * O catálogo é o mesmo em mock e em Supabase: são os relatórios que o escopo
 * contratou, e essa lista não depende de onde os dados moram. O que muda entre
 * os adapters é QUAIS deles conseguem rodar — e isso vem de `SEM_ORIGEM`, que
 * cada adapter aplica com os seus próprios motivos.
 *
 * Numeração e textos são os do protótipo, que é como a clínica se refere a
 * eles ("o relatório 04", "aquele que a Dra. pediu").
 */

export const DEFINICOES: DefinicaoRelatorio[] = [
  /* ------------------------------------------------------------ pacientes */
  {
    slug: "pacientes-ativos",
    numero: "01",
    categoria: "pacientes",
    titulo: "Pacientes ativos em tratamento",
    descricao:
      "Total e distribuição de pacientes atualmente em tratamento, com quebra por protocolo e fase.",
    filtros: ["protocolo", "fase"],
    disponivel: true,
  },
  {
    slug: "novos-pacientes",
    numero: "02",
    categoria: "pacientes",
    titulo: "Novos pacientes no período",
    descricao: "Entrada de novos pacientes por mês no período escolhido.",
    filtros: ["periodo"],
    disponivel: true,
  },
  {
    slug: "distribuicao-cid",
    numero: "12",
    categoria: "pacientes",
    titulo: "Distribuição de pacientes por CID",
    descricao: "Mapa de prevalência dos tipos de câncer atendidos. Subsidia decisões estratégicas.",
    filtros: ["periodo"],
    disponivel: true,
  },

  /* -------------------------------------------------------------- clínico */
  {
    slug: "efeitos-por-protocolo",
    numero: "04",
    categoria: "clinico",
    titulo: "Efeitos adversos por protocolo e grau",
    descricao:
      "Cruzamento protocolo × efeito adverso × grau, a partir do diário do paciente.",
    filtros: ["periodo", "protocolo", "efeito"],
    disponivel: true,
  },
  {
    slug: "alertas-ia",
    numero: "09",
    categoria: "clinico",
    titulo: "Alertas disparados pela IA",
    descricao: "Volume de alertas, tipo, tempo até a conduta e desfecho.",
    filtros: ["periodo"],
    disponivel: false,
  },

  /* ---------------------------------------------------------- operacional */
  {
    slug: "sessoes-quimioterapia",
    numero: "03",
    categoria: "operacional",
    titulo: "Sessões de quimioterapia realizadas",
    descricao: "Volume de sessões de infusão no período, por mês.",
    filtros: ["periodo"],
    disponivel: true,
  },
  {
    slug: "faltas-cancelamentos",
    numero: "06",
    categoria: "operacional",
    titulo: "Faltas, cancelamentos e remarcações",
    descricao: "Taxa de faltas por especialidade e por período.",
    filtros: ["periodo", "especialidade"],
    disponivel: true,
  },
  {
    slug: "volume-por-especialidade",
    numero: "07",
    categoria: "operacional",
    titulo: "Volume de atendimento por especialidade",
    descricao: "Atendimentos realizados por área, com evolução no período.",
    filtros: ["periodo", "especialidade"],
    disponivel: true,
  },

  /* ------------------------------------------------- qualidade & experiência */
  {
    slug: "engajamento-app",
    numero: "05",
    categoria: "qualidade",
    titulo: "Engajamento dos pacientes no app",
    descricao:
      "Pacientes que registraram algo no diário nos últimos 7 dias sobre o total em tratamento.",
    filtros: ["periodo"],
    disponivel: true,
  },
  {
    slug: "tempo-resposta-chat",
    numero: "08",
    categoria: "qualidade",
    titulo: "Tempo médio de resposta no chat",
    descricao:
      "Tempo entre a mensagem do paciente e a primeira resposta da equipe, por assunto.",
    filtros: ["periodo"],
    disponivel: true,
  },
  {
    slug: "nps",
    numero: "10",
    categoria: "qualidade",
    titulo: "Satisfação do paciente (NPS)",
    descricao: "Pesquisa de satisfação após marcos do tratamento, com evolução e comentários.",
    filtros: ["periodo"],
    disponivel: false,
  },
  {
    slug: "conteudo-mais-acessado",
    numero: "11",
    categoria: "qualidade",
    titulo: "Conteúdo mais acessado",
    descricao: "Ranking das orientações da biblioteca por número de acessos.",
    filtros: ["periodo", "especialidade"],
    disponivel: false,
  },
];

/** Ordem de exibição: a numeração do protótipo, dentro de cada categoria. */
export const ORDEM_CATEGORIAS = ["pacientes", "clinico", "operacional", "qualidade"] as const;

export function definicaoPorSlug(slug: string): DefinicaoRelatorio | undefined {
  return DEFINICOES.find((definicao) => definicao.slug === slug);
}
