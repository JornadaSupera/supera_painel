import { FASE_TRATAMENTO, RISCO, STATUS_PACIENTE } from "@/lib/enums";
import type { FaseTratamento, Risco, StatusPaciente } from "@/lib/enums";
import type { Sexo, StatusConvite } from "@/types/paciente";
import { protocoloPorNome } from "./protocolos";
import { usuarios } from "./usuarios";

/**
 * Base de pacientes — os 81 do cabeçalho do protótipo.
 *
 * As 25 primeiras linhas são exatamente as que a tela mostra, na mesma ordem,
 * com o mesmo nome, idade, final de CPF, CID, protocolo e fase. As demais
 * completam a contagem e dão variedade aos filtros, à paginação e aos estados.
 *
 * Campos em `snake_case`: são as colunas da futura tabela `pacientes`.
 *
 * > [!] Os CPFs aqui NÃO passam na validação de dígito verificador — de
 * propósito. Um CPF sintético que fosse válido poderia coincidir com o de uma
 * pessoa real, e base de teste não deve correr esse risco. O formulário de
 * cadastro valida de verdade; só a base fictícia é inválida por construção.
 */

export interface PacienteMock {
  id: string;
  codigo: string;
  nome: string;
  /** 11 dígitos, sem pontuação — como será a coluna no Postgres. */
  cpf: string;
  nascimento: string;
  sexo: Sexo;
  telefone: string;
  email: string;
  cid: string;
  protocolo_id: string;
  fase: FaseTratamento;
  status: StatusPaciente;
  risco: Risco;
  estadiamento: string | null;
  diagnostico_em: string | null;
  alergias: string[];
  reacoes_previas: string[];
  observacoes: string | null;
  medico_responsavel_id: string | null;
  convite_status: StatusConvite;
  convite_enviado_em: string | null;
  ultimo_acesso_app_em: string | null;
  desativado_em: string | null;
  motivo_desativacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

/* -------------------------------------------------------------------------
   LINHAS DE ORIGEM
   [nome, sexo, idade, final do CPF, CID, protocolo, fase]

   Idade em vez de data de nascimento porque idade é o que o protótipo mostra;
   a data é derivada adiante, que é como o dado existe de verdade no banco.
   ------------------------------------------------------------------------- */

type Linha = readonly [string, Sexo, number, string, string, string, FaseTratamento];

const ATIVO = FASE_TRATAMENTO.ATIVO;
const SEGUIMENTO = FASE_TRATAMENTO.SEGUIMENTO;
const MANUTENCAO = FASE_TRATAMENTO.MANUTENCAO;
const REMISSAO = FASE_TRATAMENTO.REMISSAO;
const FINALIZACAO = FASE_TRATAMENTO.FINALIZACAO;

const LINHAS: Linha[] = [
  /* ---- as 25 linhas visíveis no protótipo, na ordem em que ele as exibe --- */
  ["Rafael Mendes", "masculino", 54, "23458", "C18.9", "FOLFOX", ATIVO],
  ["Washington Nogueira Jr.", "masculino", 65, "92635", "C20", "Tamoxifeno (oral)", ATIVO],
  ["Morgana Macedo Filho", "feminino", 46, "85883", "C81.9", "Paclitaxel + Trastuzumabe", ATIVO],
  ["Enzo Gabriel Costa Neto", "masculino", 67, "89633", "C67.9", "TCH", ATIVO],
  ["Yango Silva", "masculino", 55, "73288", "C92.0", "Gencitabina + nab-Paclitaxel", ATIVO],
  ["João Pedro Oliveira", "masculino", 69, "01006", "C67.9", "Gencitabina + nab-Paclitaxel", ATIVO],
  ["Núbia Silva", "feminino", 47, "89973", "C18.9", "Capecitabina (oral)", SEGUIMENTO],
  ["Valentina Oliveira", "feminino", 74, "65758", "C53.9", "ABVD", ATIVO],
  ["Lavínia Oliveira", "feminino", 39, "55741", "C20", "CAPOX", ATIVO],
  ["Daniel Souza", "masculino", 40, "19631", "C71.9", "Paclitaxel + Trastuzumabe", ATIVO],
  ["Fábio Souza", "masculino", 39, "28210", "C73", "Cisplatina + Etoposídeo", ATIVO],
  ["Bryan Braga", "masculino", 65, "40256", "C34.9", "FOLFIRI", SEGUIMENTO],
  ["Sra. Alícia Reis", "feminino", 48, "88380", "C34.9", "Carboplatina + Paclitaxel", MANUTENCAO],
  ["Rebeca Santos", "feminino", 37, "32740", "C73", "Trastuzumabe (manutenção)", ATIVO],
  ["Roberto Macedo", "masculino", 55, "48220", "C50.9", "Letrozol (oral)", ATIVO],
  ["Sra. Heloísa Albuquerque", "feminino", 64, "78783", "C53.9", "R-CHOP", SEGUIMENTO],
  ["Murilo Albuquerque", "masculino", 66, "88582", "C53.9", "Tamoxifeno (oral)", ATIVO],
  ["Murilo Barros", "masculino", 64, "81503", "C73", "Tamoxifeno (oral)", SEGUIMENTO],
  ["Alice Albuquerque", "feminino", 34, "54916", "C64", "TCH", SEGUIMENTO],
  ["Maria Eduarda Reis", "feminino", 40, "94671", "C20", "R-CHOP", MANUTENCAO],
  ["Emanuelly Batista", "feminino", 55, "48041", "C20", "FLOT", SEGUIMENTO],
  ["Srta. Lorena Albuquerque", "feminino", 76, "59901", "C20", "FOLFIRI", MANUTENCAO],
  ["Pietro Albuquerque", "masculino", 77, "30082", "C18.9", "Trastuzumabe (manutenção)", ATIVO],
  ["Elísio Costa", "masculino", 35, "75288", "C91.0", "Cisplatina + Etoposídeo", ATIVO],
  ["Heloísa Souza", "feminino", 40, "43483", "C67.9", "CAPOX", SEGUIMENTO],

  /* --------------- as demais, até fechar os 81 do cabeçalho -------------- */
  ["Sr. Otávio Bittencourt", "masculino", 71, "60417", "C16.9", "FLOT", ATIVO],
  ["Clarice Amorim", "feminino", 58, "71529", "C50.9", "TCH", ATIVO],
  ["Benício Farias", "masculino", 62, "82630", "C34.9", "Carboplatina + Paclitaxel", ATIVO],
  ["Isadora Prado", "feminino", 44, "93741", "C85.9", "R-CHOP", ATIVO],
  ["Gabriel Nunes Teixeira", "masculino", 51, "04852", "C18.9", "FOLFOX", SEGUIMENTO],
  ["Sra. Marlene Duarte", "feminino", 78, "15963", "C50.9", "Tamoxifeno (oral)", MANUTENCAO],
  ["Vitor Hugo Camargo", "masculino", 36, "26074", "C91.0", "Cisplatina + Etoposídeo", ATIVO],
  ["Ariane Lopes", "feminino", 49, "37185", "C53.9", "Carboplatina + Paclitaxel", ATIVO],
  ["Ricardo Sanfelice", "masculino", 67, "48296", "C67.9", "Gencitabina + nab-Paclitaxel", ATIVO],
  ["Manuela Guimarães", "feminino", 33, "59307", "C81.9", "ABVD", SEGUIMENTO],
  ["Sr. Aldo Bertoldi", "masculino", 73, "60418", "C20", "CAPOX", ATIVO],
  ["Tainá Moreira", "feminino", 41, "71520", "C50.9", "Paclitaxel + Trastuzumabe", ATIVO],
  ["Leandro Kraus", "masculino", 56, "82631", "C34.9", "Cisplatina + Etoposídeo", MANUTENCAO],
  ["Bianca Zimmer", "feminino", 29, "93742", "C73", "Trastuzumabe (manutenção)", SEGUIMENTO],
  ["Osvaldo Petry", "masculino", 69, "04853", "C18.9", "Capecitabina (oral)", MANUTENCAO],
  ["Sra. Neusa Kretzer", "feminino", 81, "15964", "C50.9", "Letrozol (oral)", MANUTENCAO],
  ["Diego Fontanella", "masculino", 45, "26075", "C92.0", "Cisplatina + Etoposídeo", ATIVO],
  ["Priscila Bonetti", "feminino", 38, "37186", "C53.9", "ABVD", ATIVO],
  ["Marcos Vinícius Serpa", "masculino", 60, "48297", "C16.9", "FLOT", SEGUIMENTO],
  ["Eliane Warmling", "feminino", 54, "59308", "C85.9", "R-CHOP", MANUTENCAO],
  ["Sr. Jorge Búrigo", "masculino", 75, "60419", "C67.9", "Gencitabina + nab-Paclitaxel", SEGUIMENTO],
  ["Larissa Wolff", "feminino", 31, "71521", "C81.9", "ABVD", ATIVO],
  ["Everton Piazza", "masculino", 47, "82632", "C20", "FOLFIRI", ATIVO],
  ["Sônia Regina Fávero", "feminino", 66, "93743", "C50.9", "TCH", ATIVO],
  ["Anderson Búrigo", "masculino", 52, "04854", "C18.9", "FOLFOX", ATIVO],
  ["Marina Zanatta", "feminino", 43, "15965", "C73", "Trastuzumabe (manutenção)", MANUTENCAO],
  ["Sr. Ivo Casagrande", "masculino", 79, "26076", "C34.9", "Carboplatina + Paclitaxel", SEGUIMENTO],
  ["Débora Feltrin", "feminino", 35, "37187", "C53.9", "Cisplatina + Etoposídeo", ATIVO],
  ["Rogério Milanez", "masculino", 63, "48298", "C16.9", "FLOT", ATIVO],
  ["Amanda Speck", "feminino", 27, "59309", "C91.0", "R-CHOP", SEGUIMENTO],
  ["Sra. Terezinha Búrigo", "feminino", 84, "60410", "C50.9", "Tamoxifeno (oral)", MANUTENCAO],
  ["Jonas Bortoluzzi", "masculino", 57, "71522", "C67.9", "CAPOX", ATIVO],
  ["Carla Simioni", "feminino", 46, "82633", "C85.9", "R-CHOP", ATIVO],
  ["Fernando Zilli", "masculino", 68, "93744", "C18.9", "FOLFIRI", MANUTENCAO],
  ["Juliana Pizzolo", "feminino", 39, "04855", "C50.9", "Paclitaxel + Trastuzumabe", ATIVO],
  ["Sr. Nelson Colombo", "masculino", 77, "15966", "C34.9", "Cisplatina + Etoposídeo", FINALIZACAO],
  ["Renata Bianchini", "feminino", 50, "26077", "C53.9", "Carboplatina + Paclitaxel", SEGUIMENTO],
  ["Alexandre Guglielmi", "masculino", 61, "37188", "C20", "CAPOX", ATIVO],
  ["Vanessa Trevisol", "feminino", 34, "48299", "C81.9", "ABVD", REMISSAO],
  ["Sebastião Naspolini", "masculino", 72, "59300", "C16.9", "FLOT", ATIVO],
  ["Adriana Bez Batti", "feminino", 48, "60411", "C50.9", "Letrozol (oral)", MANUTENCAO],
  ["Cristiano Milioli", "masculino", 55, "71523", "C92.0", "Cisplatina + Etoposídeo", FINALIZACAO],
  ["Sra. Iracema Zanette", "feminino", 80, "82634", "C73", "Tamoxifeno (oral)", SEGUIMENTO],
  ["Paulo Sérgio Frassetto", "masculino", 64, "93745", "C67.9", "Gencitabina + nab-Paclitaxel", ATIVO],
  ["Elisa Damiani", "feminino", 30, "04856", "C85.9", "R-CHOP", ATIVO],
  ["Márcio Benedet", "masculino", 59, "15967", "C18.9", "Capecitabina (oral)", SEGUIMENTO],
  ["Simone Uggioni", "feminino", 42, "26078", "C53.9", "ABVD", REMISSAO],
  ["Norberto Búrigo", "masculino", 70, "37189", "C20", "FOLFOX", ATIVO],
  ["Kelly Cristina Pieri", "feminino", 37, "48290", "C50.9", "TCH", ATIVO],
  ["Valmor Scussel", "masculino", 74, "59301", "C34.9", "Carboplatina + Paclitaxel", MANUTENCAO],
  ["Beatriz Canever", "feminino", 26, "60412", "C91.0", "R-CHOP", ATIVO],
  ["Sr. Décio Zanelato", "masculino", 82, "71524", "C16.9", "FLOT", FINALIZACAO],
  ["Michele Bratti", "feminino", 44, "82635", "C67.9", "CAPOX", SEGUIMENTO],
  ["Gilberto Sônego", "masculino", 65, "93746", "C18.9", "FOLFIRI", ATIVO],
  ["Aline Mondardo", "feminino", 32, "04857", "C81.9", "ABVD", ATIVO],
  ["Sra. Ivone Peruchi", "feminino", 76, "15968", "C50.9", "Trastuzumabe (manutenção)", MANUTENCAO],
];

/* -------------------------------------------------------------------------
   DERIVAÇÃO
   Tudo o que segue é determinístico a partir do índice: rodar duas vezes
   produz a mesma base. Mock com `Math.random()` muda o painel a cada recarga e
   torna impossível reproduzir um defeito.
   ------------------------------------------------------------------------- */

/** A linha 0 é a mais recente — e o padrão da listagem é `criado_em desc`. */
const REFERENCIA = Date.parse("2026-08-20T13:00:00.000Z");
const DIA = 86_400_000;

const MEDICOS = usuarios
  .filter((usuario) => usuario.especialidade === "medico_oncologista")
  .map((usuario) => usuario.id);

const ESTADIAMENTOS = ["I", "IIA", "IIB", "IIIA", "IIIB", "IV"];
const DOMINIOS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br"];
const ALERGIAS = [["Dipirona"], ["Penicilina"], ["Iodo", "Frutos do mar"], ["Sulfa"]];
const REACOES = [
  ["Náusea", "Fadiga"],
  ["Neuropatia periférica"],
  ["Mucosite oral", "Diarreia"],
  ["Reação cutânea"],
];

/** Sem acento e sem título de tratamento — vira e-mail. */
function slug(nome: string): string {
  const partes = nome
    .replace(/^(Sr|Sra|Srta|Dr|Dra)\.\s+/u, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((parte) => !["de", "da", "do", "das", "dos", "jr.", "neto", "filho"].includes(parte));

  const primeiro = partes[0] ?? "paciente";
  const ultimo = partes.length > 1 ? partes[partes.length - 1] : "";
  return ultimo ? `${primeiro}.${ultimo}` : primeiro;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Risco não aparece no protótipo — a distribuição abaixo é nossa, e existe
 * para o filtro ter o que filtrar. Quem está em tratamento ativo concentra o
 * risco maior; quem está em seguimento ou remissão, o menor.
 */
function riscoDe(fase: FaseTratamento, indice: number): Risco {
  if (fase === FASE_TRATAMENTO.ATIVO) return indice % 5 === 0 ? RISCO.ALTO : RISCO.MEDIO;
  if (fase === FASE_TRATAMENTO.MANUTENCAO) return indice % 4 === 0 ? RISCO.MEDIO : RISCO.BAIXO;
  return RISCO.BAIXO;
}

export const pacientes: PacienteMock[] = LINHAS.map((linha, i) => {
  const [nome, sexo, anos, finalCpf, cid, protocolo, fase] = linha;

  const criado = REFERENCIA - i * 2 * DIA;

  // Meses de janeiro a julho garantem que o aniversário já passou em qualquer
  // ponto do segundo semestre — a idade exibida bate com a do protótipo.
  const mes = String((i % 7) + 1).padStart(2, "0");
  const dia = String((i % 27) + 1).padStart(2, "0");

  // Tratamento finalizado é o que a clínica desativa; é assim que a base ganha
  // inativos sem precisar inventar exceção.
  const inativo = fase === FINALIZACAO;
  const convite: StatusConvite = i % 11 === 5 ? "nao_enviado" : i % 7 === 3 ? "enviado" : "aceito";

  return {
    id: `${String(i + 1).padStart(8, "0")}-4b1c-4d2e-9f3a-${String(100000 + i).padStart(12, "0")}`,
    codigo: `PAC-${String(LINHAS.length - i).padStart(4, "0")}`,
    nome,
    cpf: `${String(100000 + i * 7919).slice(-6)}${finalCpf}`,
    nascimento: `${2026 - anos}-${mes}-${dia}`,
    sexo,
    telefone: `489${String(80000000 + i * 137)}`,
    email: `${slug(nome)}@${DOMINIOS[i % DOMINIOS.length]}`,
    cid,
    protocolo_id: protocoloPorNome(protocolo)?.id ?? "",
    fase,
    status: inativo ? STATUS_PACIENTE.INATIVO : STATUS_PACIENTE.ATIVO,
    risco: riscoDe(fase, i),
    estadiamento: ESTADIAMENTOS[i % ESTADIAMENTOS.length] ?? null,
    diagnostico_em: iso(criado - (30 + i * 3) * DIA),
    alergias: i % 3 === 0 ? (ALERGIAS[i % ALERGIAS.length] ?? []) : [],
    reacoes_previas: fase === ATIVO ? (REACOES[i % REACOES.length] ?? []) : [],
    observacoes: null,
    medico_responsavel_id: MEDICOS[i % Math.max(1, MEDICOS.length)] ?? null,
    convite_status: convite,
    convite_enviado_em: convite === "nao_enviado" ? null : iso(criado + DIA),
    ultimo_acesso_app_em: convite === "aceito" ? iso(REFERENCIA - (i % 9) * DIA) : null,
    desativado_em: inativo ? iso(REFERENCIA - (i % 30) * DIA) : null,
    motivo_desativacao: inativo ? "Tratamento concluído e alta do acompanhamento." : null,
    criado_em: iso(criado),
    atualizado_em: iso(criado + DIA),
  } satisfies PacienteMock;
});

export default pacientes;
