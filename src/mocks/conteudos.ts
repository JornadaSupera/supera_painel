import { ESPECIALIDADE, STATUS_CONTEUDO, TIPO_CONTEUDO } from "@/lib/enums";
import type { Especialidade, StatusConteudo, TipoConteudo } from "@/lib/enums";

/**
 * Biblioteca de orientações — dados brutos.
 *
 * As três versões em revisão e as doze publicadas são as do protótipo, com os
 * mesmos títulos, autores, áreas e contagens de acesso. O que o protótipo não
 * mostra — corpo do texto, número da versão das publicadas, histórico de
 * decisões — é preenchido de forma plausível para que os estados da tela
 * tenham o que exercitar.
 *
 * Formato = colunas do Postgres: `snake_case`, ids UUID, datas ISO 8601 UTC.
 * A linha aqui é a VERSÃO, como em `content_versions`.
 */

export interface ConteudoRaw {
  id: string;
  content_item_id: string;
  version_no: number;
  title: string;
  body: string;
  media_kind: TipoConteudo;
  video_url: string | null;
  estimated_reading_minutes: number | null;
  status: StatusConteudo;
  category_label: string;
  category_id: string;
  specialty: Especialidade | null;
  is_confidential: boolean;
  author_name: string;
  author_id: string;
  cid10: { code: string; label: string }[];
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface RevisaoRaw {
  id: string;
  content_version_id: string;
  action: "aprovar" | "devolver" | "rejeitar" | "despublicar";
  reviewer_name: string;
  comment: string | null;
  created_at: string;
}

/** Horas atrás, em ISO — mantém "há 2h" verdadeiro a cada carregamento. */
function horasAtras(horas: number): string {
  return new Date(Date.now() - horas * 3_600_000).toISOString();
}

const CATEGORIA = {
  NUTRICAO: { id: "b1c0e5a2-0001-4a10-9f01-000000000001", label: "Nutrição" },
  PSICOLOGIA: { id: "b1c0e5a2-0002-4a10-9f01-000000000002", label: "Psicologia" },
  ODONTOLOGIA: { id: "b1c0e5a2-0003-4a10-9f01-000000000003", label: "Odontologia" },
  FISIOTERAPIA: { id: "b1c0e5a2-0004-4a10-9f01-000000000004", label: "Fisioterapia" },
} as const;

/* -------------------------------------------------------------------------
   AGUARDANDO REVISÃO — os três cartões do topo do protótipo
   ------------------------------------------------------------------------- */

const emRevisao: ConteudoRaw[] = [
  {
    id: "c0000001-0000-4000-8000-000000000001",
    content_item_id: "a0000001-0000-4000-8000-000000000001",
    version_no: 2,
    title: "Alimentação em períodos de náusea",
    body: "Pequenas refeições, alimentos frios e o que evitar quando o enjoo aparece.\n\nComa de três em três horas, em porções pequenas. Alimentos gelados ou em temperatura ambiente costumam incomodar menos que os quentes, porque o cheiro é mais fraco. Prefira preparações secas — torrada, biscoito de água e sal, batata cozida — nos momentos de maior enjoo.\n\nEvite frituras, alimentos muito gordurosos e temperos fortes. Beba líquidos entre as refeições, e não durante, para não aumentar a sensação de estômago cheio.\n\nSe o enjoo impedir de comer por mais de um dia, avise a equipe pelo chat.",
    media_kind: TIPO_CONTEUDO.VIDEO,
    video_url: "https://www.youtube.com/watch?v=exemplo-nausea",
    estimated_reading_minutes: 4,
    status: STATUS_CONTEUDO.EM_REVISAO,
    category_label: CATEGORIA.NUTRICAO.label,
    category_id: CATEGORIA.NUTRICAO.id,
    specialty: ESPECIALIDADE.NUTRICIONISTA,
    is_confidential: false,
    author_name: "Larissa Rocha",
    author_id: "d0000001-0000-4000-8000-000000000001",
    cid10: [{ code: "C50", label: "Neoplasia maligna da mama" }],
    view_count: 52,
    created_at: horasAtras(72),
    updated_at: horasAtras(2),
  },
  {
    id: "c0000002-0000-4000-8000-000000000002",
    content_item_id: "a0000002-0000-4000-8000-000000000002",
    version_no: 3,
    title: "Conversando com a família sobre o diagnóstico",
    body: "Como abrir o diálogo, especialmente com filhos e netos pequenos.\n\nNão existe uma idade a partir da qual a criança passa a entender: existe uma linguagem para cada idade. Com os menores, frases curtas e concretas funcionam melhor do que metáforas — dizer que a pessoa está doente e que está sendo tratada é mais claro do que dizer que ela está viajando.\n\nO silêncio raramente protege. Crianças percebem a mudança na rotina e, sem explicação, costumam concluir que a culpa é delas.\n\nEscolha um momento sem pressa, aceite não ter todas as respostas e deixe claro que a conversa pode continuar depois.",
    media_kind: TIPO_CONTEUDO.VIDEO,
    video_url: "https://www.youtube.com/watch?v=exemplo-familia",
    estimated_reading_minutes: 6,
    status: STATUS_CONTEUDO.EM_REVISAO,
    category_label: CATEGORIA.PSICOLOGIA.label,
    category_id: CATEGORIA.PSICOLOGIA.id,
    specialty: ESPECIALIDADE.PSICOLOGO,
    is_confidential: true,
    author_name: "Camila Souza",
    author_id: "d0000002-0000-4000-8000-000000000002",
    cid10: [],
    view_count: 133,
    created_at: horasAtras(120),
    updated_at: horasAtras(5),
  },
  {
    id: "c0000003-0000-4000-8000-000000000003",
    content_item_id: "a0000003-0000-4000-8000-000000000003",
    version_no: 4,
    title: "Exercícios para fadiga oncológica",
    body: "Série leve de 10 minutos para fazer em casa nos dias de cansaço.\n\nParece contraintuitivo, mas movimento leve reduz a fadiga do tratamento — repouso absoluto tende a piorá-la. A série abaixo foi pensada para ser feita sentada, e pode ser interrompida a qualquer momento.\n\n1. Respiração diafragmática, 2 minutos.\n2. Elevação alternada dos braços, 10 repetições de cada lado.\n3. Extensão de joelho sentada, 10 repetições de cada perna.\n4. Marcha sentada, 2 minutos.\n5. Alongamento de pescoço e ombros, 2 minutos.\n\nPare se sentir tontura, falta de ar ou dor. Nos dias de infusão, faça só a respiração.",
    media_kind: TIPO_CONTEUDO.VIDEO,
    video_url: "https://www.youtube.com/watch?v=exemplo-fadiga",
    estimated_reading_minutes: 5,
    status: STATUS_CONTEUDO.EM_REVISAO,
    category_label: CATEGORIA.FISIOTERAPIA.label,
    category_id: CATEGORIA.FISIOTERAPIA.id,
    specialty: ESPECIALIDADE.FISIOTERAPEUTA,
    is_confidential: false,
    author_name: "Patrícia Lima",
    author_id: "d0000003-0000-4000-8000-000000000003",
    cid10: [],
    view_count: 281,
    created_at: horasAtras(200),
    updated_at: horasAtras(26),
  },
];

/* -------------------------------------------------------------------------
   PUBLICADOS — as doze linhas da tabela do protótipo
   ------------------------------------------------------------------------- */

interface PublicadoSemente {
  titulo: string;
  categoria: (typeof CATEGORIA)[keyof typeof CATEGORIA];
  especialidade: Especialidade;
  sigiloso: boolean;
  autor: string;
  acessos: number;
  resumo: string;
}

const SEMENTES: PublicadoSemente[] = [
  {
    titulo: "Alimentação em períodos de náusea",
    categoria: CATEGORIA.NUTRICAO,
    especialidade: ESPECIALIDADE.NUTRICIONISTA,
    sigiloso: false,
    autor: "Larissa Rocha",
    acessos: 52,
    resumo: "Pequenas refeições, alimentos frios e o que evitar quando o enjoo aparece.",
  },
  {
    titulo: "Manter peso durante a quimioterapia",
    categoria: CATEGORIA.NUTRICAO,
    especialidade: ESPECIALIDADE.NUTRICIONISTA,
    sigiloso: false,
    autor: "Larissa Rocha",
    acessos: 1162,
    resumo: "Como acompanhar o peso em casa e quando a perda passa a exigir ajuste do plano alimentar.",
  },
  {
    titulo: "Alimentos seguros após sessão de quimio",
    categoria: CATEGORIA.NUTRICAO,
    especialidade: ESPECIALIDADE.NUTRICIONISTA,
    sigiloso: false,
    autor: "Larissa Rocha",
    acessos: 268,
    resumo: "Cuidados de higiene e preparo nos dias em que a imunidade está mais baixa.",
  },
  {
    titulo: "Receitas para boca seca e mucosite",
    categoria: CATEGORIA.NUTRICAO,
    especialidade: ESPECIALIDADE.NUTRICIONISTA,
    sigiloso: false,
    autor: "Larissa Rocha",
    acessos: 1237,
    resumo: "Preparações macias, frias e pouco ácidas para quando engolir dói.",
  },
  {
    titulo: "Conversando com a família sobre o diagnóstico",
    categoria: CATEGORIA.PSICOLOGIA,
    especialidade: ESPECIALIDADE.PSICOLOGO,
    sigiloso: true,
    autor: "Camila Souza",
    acessos: 133,
    resumo: "Como abrir o diálogo, especialmente com filhos e netos pequenos.",
  },
  {
    titulo: "Quando a ansiedade é normal — e quando buscar ajuda",
    categoria: CATEGORIA.PSICOLOGIA,
    especialidade: ESPECIALIDADE.PSICOLOGO,
    sigiloso: true,
    autor: "Camila Souza",
    acessos: 829,
    resumo: "Sinais de que o desconforto passou do esperado para o momento do tratamento.",
  },
  {
    titulo: "Exercício de respiração 4-7-8",
    categoria: CATEGORIA.PSICOLOGIA,
    especialidade: ESPECIALIDADE.PSICOLOGO,
    sigiloso: true,
    autor: "Camila Souza",
    acessos: 710,
    resumo: "Uma técnica curta para usar antes da infusão ou em noites de sono difícil.",
  },
  {
    titulo: "Higiene oral durante a quimioterapia",
    categoria: CATEGORIA.ODONTOLOGIA,
    especialidade: ESPECIALIDADE.DENTISTA,
    sigiloso: false,
    autor: "Marcos Vieira",
    acessos: 833,
    resumo: "Escovação, enxaguantes e o que evitar para prevenir mucosite.",
  },
  {
    titulo: "O que é o laser profilático que aplicamos?",
    categoria: CATEGORIA.ODONTOLOGIA,
    especialidade: ESPECIALIDADE.DENTISTA,
    sigiloso: false,
    autor: "Marcos Vieira",
    acessos: 719,
    resumo: "Para que serve a laserterapia, como é a sessão e por que ela é feita antes da lesão aparecer.",
  },
  {
    titulo: "Exercícios para fadiga oncológica",
    categoria: CATEGORIA.FISIOTERAPIA,
    especialidade: ESPECIALIDADE.FISIOTERAPEUTA,
    sigiloso: false,
    autor: "Patrícia Lima",
    acessos: 281,
    resumo: "Série leve de 10 minutos para fazer em casa nos dias de cansaço.",
  },
  {
    titulo: "Prevenção de linfedema após mastectomia",
    categoria: CATEGORIA.FISIOTERAPIA,
    especialidade: ESPECIALIDADE.FISIOTERAPEUTA,
    sigiloso: false,
    autor: "Patrícia Lima",
    acessos: 169,
    resumo: "Cuidados com o braço do lado operado e os sinais que pedem avaliação.",
  },
  {
    titulo: "Alongamento para neuropatia em MMII",
    categoria: CATEGORIA.FISIOTERAPIA,
    especialidade: ESPECIALIDADE.FISIOTERAPEUTA,
    sigiloso: false,
    autor: "Patrícia Lima",
    acessos: 967,
    resumo: "Movimentos para formigamento e dormência nos pés, com atenção ao risco de queda.",
  },
];

const publicados: ConteudoRaw[] = SEMENTES.map((semente, indice) => {
  const ordem = String(indice + 1).padStart(2, "0");

  return {
    id: `c1000${ordem}-0000-4000-8000-0000000000${ordem}`,
    content_item_id: `a1000${ordem}-0000-4000-8000-0000000000${ordem}`,
    version_no: 1 + (indice % 3),
    title: semente.titulo,
    body: `${semente.resumo}\n\nEsta orientação está publicada na biblioteca do aplicativo e chega aos pacientes elegíveis conforme a marcação por CID e por área.`,
    media_kind: indice % 4 === 0 ? TIPO_CONTEUDO.VIDEO : TIPO_CONTEUDO.ARTIGO,
    video_url: indice % 4 === 0 ? `https://www.youtube.com/watch?v=exemplo-${ordem}` : null,
    estimated_reading_minutes: 3 + (indice % 5),
    status: STATUS_CONTEUDO.PUBLICADO,
    category_label: semente.categoria.label,
    category_id: semente.categoria.id,
    specialty: semente.especialidade,
    is_confidential: semente.sigiloso,
    author_name: semente.autor,
    author_id: `d100000${indice}-0000-4000-8000-00000000000${indice}`,
    cid10: [],
    view_count: semente.acessos,
    created_at: horasAtras(24 * (30 + indice)),
    updated_at: horasAtras(24 * (3 + indice)),
  };
});

export const conteudos: ConteudoRaw[] = [...emRevisao, ...publicados];

/** Decisões já registradas — o histórico que a ficha da versão mostra. */
export const revisoes: RevisaoRaw[] = [
  {
    id: "e0000001-0000-4000-8000-000000000001",
    content_version_id: "c0000003-0000-4000-8000-000000000003",
    action: "devolver",
    reviewer_name: "Carolina Mendes",
    comment:
      "Incluir a ressalva sobre não fazer a série nos dias de infusão e citar quando parar. Do jeito que está, quem sente tontura não sabe se continua.",
    created_at: horasAtras(48),
  },
  {
    id: "e0000002-0000-4000-8000-000000000002",
    // A primeira semente publicada — ver o `id` derivado em `publicados`.
    content_version_id: "c100001-0000-4000-8000-000000000001",
    action: "aprovar",
    reviewer_name: "Carolina Mendes",
    comment: null,
    created_at: horasAtras(24 * 6),
  },
];

export default conteudos;
