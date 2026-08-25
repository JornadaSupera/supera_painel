import type { Cid } from "@/types/catalogo";

/**
 * Catálogo CID-10 — os diagnósticos presentes na base de pacientes.
 *
 * Não é o CID-10 inteiro: é o recorte oncológico que a clínica usa, que é
 * também o conjunto que aparece na coluna "CID" do protótipo. Na Fase 15 a
 * tabela é populada por migração e, havendo integração, sincronizada com o
 * Gemed.
 *
 * `codigo` é a chave natural — `pacientes.cid` aponta para cá.
 */
export const cids: Cid[] = [
  { codigo: "C18.9", descricao: "Neoplasia maligna do cólon, não especificado", grupo: "Aparelho digestivo" },
  { codigo: "C20", descricao: "Neoplasia maligna do reto", grupo: "Aparelho digestivo" },
  { codigo: "C16.9", descricao: "Neoplasia maligna do estômago, não especificado", grupo: "Aparelho digestivo" },
  { codigo: "C34.9", descricao: "Neoplasia maligna dos brônquios ou pulmões, não especificado", grupo: "Aparelho respiratório" },
  { codigo: "C50.9", descricao: "Neoplasia maligna da mama, não especificado", grupo: "Mama" },
  { codigo: "C53.9", descricao: "Neoplasia maligna do colo do útero, não especificado", grupo: "Aparelho geniturinário" },
  { codigo: "C64", descricao: "Neoplasia maligna do rim, exceto pelve renal", grupo: "Aparelho geniturinário" },
  { codigo: "C67.9", descricao: "Neoplasia maligna da bexiga, não especificado", grupo: "Aparelho geniturinário" },
  { codigo: "C71.9", descricao: "Neoplasia maligna do encéfalo, não especificado", grupo: "Sistema nervoso central" },
  { codigo: "C73", descricao: "Neoplasia maligna da glândula tireoide", grupo: "Glândulas endócrinas" },
  { codigo: "C81.9", descricao: "Doença de Hodgkin, não especificada", grupo: "Tecidos linfático e hematopoético" },
  { codigo: "C85.9", descricao: "Linfoma não-Hodgkin, não especificado", grupo: "Tecidos linfático e hematopoético" },
  { codigo: "C91.0", descricao: "Leucemia linfoblástica aguda", grupo: "Tecidos linfático e hematopoético" },
  { codigo: "C92.0", descricao: "Leucemia mieloide aguda", grupo: "Tecidos linfático e hematopoético" },
];

export default cids;
