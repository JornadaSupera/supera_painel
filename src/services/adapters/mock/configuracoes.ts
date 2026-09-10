import { efeitosAdversos } from "@/mocks/protocolos";
import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type { Configuracoes, ItemCatalogo, VersaoLegal } from "@/types/configuracao";
import { simulate } from "./_helpers";

/**
 * Configurações — catálogos sobre a base fictícia.
 *
 * Recusa a escrita exatamente como o adapter Supabase, e pela mesma razão de
 * produto: catálogo do sistema muda por migração revisada, não por formulário.
 * Um mock que aceitasse salvar faria a tela prometer um botão que o backend
 * real nega.
 */

function item(codigo: string, label: string, detalhe: string | null): ItemCatalogo {
  return { id: `cat-${codigo}`, codigo, label, detalhe, ativo: true };
}

const SINTOMAS: ItemCatalogo[] = efeitosAdversos.map((efeito) =>
  item(efeito.id, efeito.nome, efeito.sistema),
);

const NOTIFICACOES: ItemCatalogo[] = [
  item("appointment_reminder_24h", "Lembrete de compromisso", "Agenda · pode ser silenciada"),
  item("appointment_scheduled", "Novo compromisso agendado", "Agenda · pode ser silenciada"),
  item("appointment_changed", "Compromisso alterado", "Agenda · não silenciável"),
  item("chat_message", "Nova mensagem da equipe", "Chat · pode ser silenciada"),
  item("chat_assigned", "Conversa atribuída a você", "Chat · pode ser silenciada"),
  item("content_published", "Nova orientação disponível", "Conteúdo · pode ser silenciada"),
  item("critical_alert", "Alerta de sintoma crítico", "Clínico · não silenciável"),
];

const CATEGORIAS: ItemCatalogo[] = [
  item("nutrition", "Nutrição", "Nutricionista"),
  item("psychology", "Psicologia", "Psicólogo"),
  item("dentistry", "Odontologia", "Dentista"),
  item("physiotherapy", "Fisioterapia", "Fisioterapeuta"),
  item("nursing", "Enfermagem", "Enfermeiro"),
  item("oral_medication", "Medicação Oral", "Transversal"),
];

const ASSUNTOS: ItemCatalogo[] = [
  item("symptoms", "Dúvida sobre sintomas", "Qualquer área"),
  item("medication", "Dúvida sobre medicação", "Farmacêutico"),
  item("appointment", "Agenda e compromissos", "Qualquer área"),
  item("other", "Outro assunto", "Qualquer área"),
];

const TERMOS: VersaoLegal[] = [
  {
    id: "legal-001",
    tipo: "termos_de_uso",
    tipo_label: "Termos de uso",
    versao: 7,
    vigente: true,
    publicado_em: "2026-04-12T12:00:00.000Z",
    corpo:
      "Estes termos regem o uso do aplicativo Jornada Supera pelos pacientes do Centro de Oncologia de Santa Catarina.\n\nO aplicativo não substitui atendimento presencial nem serve para emergências. Em caso de sintoma grave, procure o pronto-atendimento.",
  },
  {
    id: "legal-002",
    tipo: "politica_de_privacidade",
    tipo_label: "Política de privacidade",
    versao: 4,
    vigente: true,
    publicado_em: "2026-04-12T12:00:00.000Z",
    corpo:
      "Os dados registrados no aplicativo são dados de saúde e recebem o tratamento previsto na Lei Geral de Proteção de Dados.\n\nO acesso é restrito à equipe assistencial responsável pelo seu cuidado, e todo acesso fica registrado em trilha de auditoria.",
  },
];

export async function get(): Promise<SingleResult<Configuracoes>> {
  return simulate(() =>
    okOne({
      sintomas: SINTOMAS,
      notificacoes: NOTIFICACOES,
      categorias_conteudo: CATEGORIAS,
      assuntos_chat: ASSUNTOS,
      sem_origem: [],
    }),
  );
}

export async function getTermos(): Promise<ListResult<VersaoLegal>> {
  return simulate(() => ok(TERMOS));
}

const SO_POR_MIGRACAO =
  "Os catálogos do sistema mudam por migração versionada, com revisão, e não por formulário: o mesmo vocabulário alimenta o diário do paciente, os relatórios e os gatilhos de alerta.";

export async function update(): Promise<SingleResult<Configuracoes>> {
  return fail(ERROR_CODE.FORBIDDEN, SO_POR_MIGRACAO);
}

export async function uploadLogo(): Promise<SingleResult<{ url: string }>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, "Não há onde guardar a identidade visual.");
}

export async function publishTermos(): Promise<SingleResult<VersaoLegal>> {
  return fail(
    ERROR_CODE.FORBIDDEN,
    "Publicar nova versão dos termos cria obrigação de novo aceite para todos os pacientes — é feito pela migração que traz o texto revisado.",
  );
}
