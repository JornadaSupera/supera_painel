import type { EfeitoAdverso, Protocolo } from "@/types/catalogo";

/**
 * Protocolos terapêuticos em uso na clínica.
 *
 * São exatamente os 15 nomes que aparecem na coluna "Protocolo" do protótipo.
 * `ciclos: null` marca terapia contínua — hormonioterapia oral não tem número
 * de ciclos, e forçar um zero ali produziria relatório errado na Fase 8.
 */
export const protocolos: Protocolo[] = [
  {
    id: "a1c3e5f7-1111-4a2b-8c3d-0e1f2a3b4c50",
    nome: "FOLFOX",
    medicamentos: ["Oxaliplatina", "Leucovorina", "Fluoruracila"],
    ciclos: 12,
    via: "intravenosa",
    ativo: true,
  },
  {
    id: "a1c3e5f7-2222-4a2b-8c3d-0e1f2a3b4c51",
    nome: "FOLFIRI",
    medicamentos: ["Irinotecano", "Leucovorina", "Fluoruracila"],
    ciclos: 12,
    via: "intravenosa",
    ativo: true,
  },
  {
    id: "a1c3e5f7-3333-4a2b-8c3d-0e1f2a3b4c52",
    nome: "CAPOX",
    medicamentos: ["Capecitabina", "Oxaliplatina"],
    ciclos: 8,
    via: "intravenosa",
    ativo: true,
  },
  {
    id: "a1c3e5f7-4444-4a2b-8c3d-0e1f2a3b4c53",
    nome: "FLOT",
    medicamentos: ["Fluoruracila", "Leucovorina", "Oxaliplatina", "Docetaxel"],
    ciclos: 8,
    via: "intravenosa",
    ativo: true,
  },
  {
    id: "a1c3e5f7-5555-4a2b-8c3d-0e1f2a3b4c54",
    nome: "R-CHOP",
    medicamentos: ["Rituximabe", "Ciclofosfamida", "Doxorrubicina", "Vincristina", "Prednisona"],
    ciclos: 6,
    via: "intravenosa",
    ativo: true,
  },
  {
    id: "a1c3e5f7-6666-4a2b-8c3d-0e1f2a3b4c55",
    nome: "ABVD",
    medicamentos: ["Doxorrubicina", "Bleomicina", "Vimblastina", "Dacarbazina"],
    ciclos: 6,
    via: "intravenosa",
    ativo: true,
  },
  {
    id: "a1c3e5f7-7777-4a2b-8c3d-0e1f2a3b4c56",
    nome: "TCH",
    medicamentos: ["Docetaxel", "Carboplatina", "Trastuzumabe"],
    ciclos: 6,
    via: "intravenosa",
    ativo: true,
  },
  {
    id: "a1c3e5f7-8888-4a2b-8c3d-0e1f2a3b4c57",
    nome: "Carboplatina + Paclitaxel",
    medicamentos: ["Carboplatina", "Paclitaxel"],
    ciclos: 6,
    via: "intravenosa",
    ativo: true,
  },
  {
    id: "a1c3e5f7-9999-4a2b-8c3d-0e1f2a3b4c58",
    nome: "Cisplatina + Etoposídeo",
    medicamentos: ["Cisplatina", "Etoposídeo"],
    ciclos: 4,
    via: "intravenosa",
    ativo: true,
  },
  {
    id: "a1c3e5f7-aaaa-4a2b-8c3d-0e1f2a3b4c59",
    nome: "Gencitabina + nab-Paclitaxel",
    medicamentos: ["Gencitabina", "nab-Paclitaxel"],
    ciclos: 6,
    via: "intravenosa",
    ativo: true,
  },
  {
    id: "a1c3e5f7-bbbb-4a2b-8c3d-0e1f2a3b4c5a",
    nome: "Paclitaxel + Trastuzumabe",
    medicamentos: ["Paclitaxel", "Trastuzumabe"],
    ciclos: 12,
    via: "intravenosa",
    ativo: true,
  },
  {
    id: "a1c3e5f7-cccc-4a2b-8c3d-0e1f2a3b4c5b",
    nome: "Trastuzumabe (manutenção)",
    medicamentos: ["Trastuzumabe"],
    ciclos: 14,
    via: "intravenosa",
    ativo: true,
  },
  {
    id: "a1c3e5f7-dddd-4a2b-8c3d-0e1f2a3b4c5c",
    nome: "Capecitabina (oral)",
    medicamentos: ["Capecitabina"],
    ciclos: 8,
    via: "oral",
    ativo: true,
  },
  {
    id: "a1c3e5f7-eeee-4a2b-8c3d-0e1f2a3b4c5d",
    nome: "Tamoxifeno (oral)",
    medicamentos: ["Tamoxifeno"],
    ciclos: null,
    via: "oral",
    ativo: true,
  },
  {
    id: "a1c3e5f7-ffff-4a2b-8c3d-0e1f2a3b4c5e",
    nome: "Letrozol (oral)",
    medicamentos: ["Letrozol"],
    ciclos: null,
    via: "oral",
    ativo: true,
  },
];

/** Busca por nome — usada pelos mocks para montar a base de pacientes. */
export function protocoloPorNome(nome: string): Protocolo | undefined {
  return protocolos.find((protocolo) => protocolo.nome === nome);
}

/**
 * Efeitos adversos catalogados (CTCAE).
 *
 * São os 12 sintomas do Diário do app do paciente, que é a origem do dado.
 * Aqui servem ao campo "reações prévias" da ficha; na Fase 12 são um dos eixos
 * do cruzamento Protocolo × Efeito × Grau.
 */
export const efeitosAdversos: EfeitoAdverso[] = [
  { id: "ef-01", nome: "Náusea", sistema: "Gastrointestinal" },
  { id: "ef-02", nome: "Vômito", sistema: "Gastrointestinal" },
  { id: "ef-03", nome: "Diarreia", sistema: "Gastrointestinal" },
  { id: "ef-04", nome: "Constipação", sistema: "Gastrointestinal" },
  { id: "ef-05", nome: "Mucosite oral", sistema: "Gastrointestinal" },
  { id: "ef-06", nome: "Fadiga", sistema: "Constitucional" },
  { id: "ef-07", nome: "Febre", sistema: "Constitucional" },
  { id: "ef-08", nome: "Perda de apetite", sistema: "Constitucional" },
  { id: "ef-09", nome: "Neuropatia periférica", sistema: "Neurológico" },
  { id: "ef-10", nome: "Alteração de paladar", sistema: "Neurológico" },
  { id: "ef-11", nome: "Reação cutânea", sistema: "Pele e anexos" },
  { id: "ef-12", nome: "Alopecia", sistema: "Pele e anexos" },
];

export default protocolos;
