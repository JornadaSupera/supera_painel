/**
 * Enums do domínio — fonte única de verdade.
 *
 * Estes valores viram `enum` / `CHECK constraint` nas migrações SQL da Fase 15.
 * O código persistido é sempre `snake_case` neutro; o rótulo em pt-BR fica
 * separado, para nunca acoplar banco a texto de interface.
 */

/* ------------------------------------------------------------------------
   PAPÉIS E ESPECIALIDADES
   ------------------------------------------------------------------------ */

export const PAPEL = {
  ADMIN: "admin",
  GESTOR: "gestor",
  PROFISSIONAL: "profissional",
} as const;

export type Papel = (typeof PAPEL)[keyof typeof PAPEL];

export const PAPEL_LABEL: Record<Papel, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  profissional: "Profissional clínico",
};

/** As 7 especialidades da equipe multidisciplinar (PDF §1). */
export const ESPECIALIDADE = {
  MEDICO: "medico_oncologista",
  FARMACEUTICO: "farmaceutico",
  ENFERMEIRO: "enfermeiro",
  NUTRICIONISTA: "nutricionista",
  PSICOLOGO: "psicologo",
  DENTISTA: "dentista",
  FISIOTERAPEUTA: "fisioterapeuta",
} as const;

export type Especialidade = (typeof ESPECIALIDADE)[keyof typeof ESPECIALIDADE];

export const ESPECIALIDADE_LABEL: Record<Especialidade, string> = {
  medico_oncologista: "Médico Oncologista",
  farmaceutico: "Farmacêutico",
  enfermeiro: "Enfermeiro",
  nutricionista: "Nutricionista",
  psicologo: "Psicólogo",
  dentista: "Dentista",
  fisioterapeuta: "Fisioterapeuta",
};

/** Conselho profissional por especialidade — usado na validação do registro. */
export const CONSELHO_POR_ESPECIALIDADE: Record<Especialidade, string> = {
  medico_oncologista: "CRM",
  farmaceutico: "CRF",
  enfermeiro: "COREN",
  nutricionista: "CRN",
  psicologo: "CRP",
  dentista: "CRO",
  fisioterapeuta: "CREFITO",
};

/* ------------------------------------------------------------------------
   STATUS
   ------------------------------------------------------------------------ */

export const STATUS_USUARIO = {
  ATIVO: "ativo",
  PAUSADO: "pausado",
  INATIVO: "inativo",
} as const;

export type StatusUsuario = (typeof STATUS_USUARIO)[keyof typeof STATUS_USUARIO];

export const STATUS_USUARIO_LABEL: Record<StatusUsuario, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  inativo: "Inativo",
};

export const STATUS_PACIENTE = {
  ATIVO: "ativo",
  INATIVO: "inativo",
} as const;

export type StatusPaciente = (typeof STATUS_PACIENTE)[keyof typeof STATUS_PACIENTE];

export const STATUS_PACIENTE_LABEL: Record<StatusPaciente, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

/** Fase do tratamento — rótulos exatos do protótipo (minúsculos). */
export const FASE_TRATAMENTO = {
  ATIVO: "ativo",
  SEGUIMENTO: "seguimento",
  MANUTENCAO: "manutencao",
  REMISSAO: "remissao",
  FINALIZACAO: "finalizacao",
} as const;

export type FaseTratamento = (typeof FASE_TRATAMENTO)[keyof typeof FASE_TRATAMENTO];

export const FASE_TRATAMENTO_LABEL: Record<FaseTratamento, string> = {
  ativo: "ativo",
  seguimento: "seguimento",
  manutencao: "manutenção",
  remissao: "remissão",
  finalizacao: "finalização",
};

export const RISCO = {
  BAIXO: "baixo",
  MEDIO: "medio",
  ALTO: "alto",
} as const;

export type Risco = (typeof RISCO)[keyof typeof RISCO];

export const RISCO_LABEL: Record<Risco, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};

/* ------------------------------------------------------------------------
   ALERTAS
   ------------------------------------------------------------------------ */

export const SEVERIDADE = {
  BAIXA: "baixa",
  MEDIA: "media",
  ALTA: "alta",
  CRITICA: "critica",
} as const;

export type Severidade = (typeof SEVERIDADE)[keyof typeof SEVERIDADE];

export const SEVERIDADE_LABEL: Record<Severidade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const STATUS_ALERTA = {
  PENDENTE: "pendente",
  ASSUMIDO: "assumido",
  RESOLVIDO: "resolvido",
} as const;

export type StatusAlerta = (typeof STATUS_ALERTA)[keyof typeof STATUS_ALERTA];

export const STATUS_ALERTA_LABEL: Record<StatusAlerta, string> = {
  pendente: "Pendente",
  assumido: "Assumido",
  resolvido: "Resolvido",
};

/* ------------------------------------------------------------------------
   CONTEÚDO
   ------------------------------------------------------------------------ */

export const STATUS_CONTEUDO = {
  RASCUNHO: "rascunho",
  EM_REVISAO: "em_revisao",
  APROVADO: "aprovado",
  PUBLICADO: "publicado",
  DEVOLVIDO: "devolvido",
  REJEITADO: "rejeitado",
  DESPUBLICADO: "despublicado",
} as const;

export type StatusConteudo = (typeof STATUS_CONTEUDO)[keyof typeof STATUS_CONTEUDO];

export const STATUS_CONTEUDO_LABEL: Record<StatusConteudo, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovado: "Aprovado",
  publicado: "Publicado",
  devolvido: "Devolvido para ajustes",
  rejeitado: "Rejeitado",
  despublicado: "Despublicado",
};

export const TIPO_CONTEUDO = {
  ARTIGO: "artigo",
  PDF: "pdf",
  VIDEO: "video",
} as const;

export type TipoConteudo = (typeof TIPO_CONTEUDO)[keyof typeof TIPO_CONTEUDO];

export const TIPO_CONTEUDO_LABEL: Record<TipoConteudo, string> = {
  artigo: "Artigo",
  pdf: "PDF",
  video: "Vídeo",
};

/* ------------------------------------------------------------------------
   AUDITORIA — categorias dos cards de 24 h do protótipo
   ------------------------------------------------------------------------ */

export const ACAO_AUDITORIA = {
  LEITURA: "leitura",
  EDICAO: "edicao",
  EXCLUSAO: "exclusao",
  SIGILOSO: "sigiloso",
  EXPORTACAO: "exportacao",
  LOGIN: "login",
  LOGOUT: "logout",
} as const;

export type AcaoAuditoria = (typeof ACAO_AUDITORIA)[keyof typeof ACAO_AUDITORIA];

export const ACAO_AUDITORIA_LABEL: Record<AcaoAuditoria, string> = {
  leitura: "Leitura",
  edicao: "Edição",
  exclusao: "Exclusão",
  sigiloso: "Sigiloso",
  exportacao: "Exportação",
  login: "Login",
  logout: "Logout",
};

/**
 * O que foi acessado, em português.
 *
 * A trilha guarda o nome técnico do recurso; a tela precisa dizer "Ficha de
 * paciente", não `patients`. O mapa cobre os recursos que a trilha registra
 * hoje e serve de fallback para o próprio nome quando aparecer um novo — um
 * recurso não mapeado ainda aparece na lista, só que com o nome cru, o que é
 * muito melhor do que sumir da auditoria.
 */
export const RECURSO_AUDITORIA_LABEL: Record<string, string> = {
  patients: "Ficha de paciente",
  pacientes: "Ficha de paciente",
  patient_diagnoses: "Diagnóstico (CID)",
  patient_clinical_history: "Histórico clínico",
  treatment_plans: "Plano terapêutico",
  diary_entries: "Diário de sintomas",
  diary_symptom_reports: "Sintoma registrado no diário",
  appointments: "Agenda",
  conversations: "Conversa no chat",
  messages: "Mensagem do chat",
  specialty_notes: "Anotação de atendimento",
  content_items: "Orientação",
  content_versions: "Versão de orientação",
  conteudos: "Orientação",
  accounts: "Conta de usuário",
  usuarios: "Conta de usuário",
  "usuarios/acessos": "Histórico de acessos",
  "conteudos/comparacao": "Comparação de versões",
  permissoes: "Matriz de permissões",
  consent_records: "Aceite de termos",
  data_subject_requests: "Pedido do titular (LGPD)",
  caregiver_invitations: "Convite de acompanhante",
  patient_caregivers: "Vínculo de acompanhante",
};

/** Origem do registro — inclui a integração Gemed (nível Médio). */
export const ORIGEM_AUDITORIA = {
  PAINEL: "painel",
  APP_PACIENTE: "app_paciente",
  APP_CUIDADOR: "app_cuidador",
  GEMED: "gemed",
  SISTEMA: "sistema",
} as const;

export type OrigemAuditoria = (typeof ORIGEM_AUDITORIA)[keyof typeof ORIGEM_AUDITORIA];

export const ORIGEM_AUDITORIA_LABEL: Record<OrigemAuditoria, string> = {
  painel: "Painel",
  app_paciente: "App do paciente",
  app_cuidador: "App do cuidador",
  gemed: "Gemed",
  sistema: "Sistema",
};

/* ------------------------------------------------------------------------
   PERÍODO — dashboard e relatórios
   ------------------------------------------------------------------------ */

export const PERIODO = {
  DIARIO: "diario",
  SEMANAL: "semanal",
  MENSAL: "mensal",
} as const;

export type Periodo = (typeof PERIODO)[keyof typeof PERIODO];

export const PERIODO_LABEL: Record<Periodo, string> = {
  diario: "Diário",
  semanal: "Semanal",
  mensal: "Mensal",
};

/** Grau de efeito adverso (CTCAE) — 1 a 5. */
export const GRAU_EFEITO = [1, 2, 3, 4, 5] as const;
export type GrauEfeito = (typeof GRAU_EFEITO)[number];

/* ------------------------------------------------------------------------
   REVISÃO EDITORIAL — o que um administrador decide sobre uma versão
   ------------------------------------------------------------------------ */

/**
 * As quatro decisões do workflow de conteúdo.
 *
 * São AÇÕES, e por isso não se confundem com `STATUS_CONTEUDO`, que é o
 * ESTADO resultante: devolver leva a "devolvido", aprovar leva a "publicado".
 * Manter os dois vocabulários separados evita a confusão clássica de tratar
 * "aprovar" como se fosse um status que a versão poderia ficar tendo.
 */
export const ACAO_REVISAO = {
  APROVAR: "aprovar",
  DEVOLVER: "devolver",
  REJEITAR: "rejeitar",
  DESPUBLICAR: "despublicar",
} as const;

export type AcaoRevisao = (typeof ACAO_REVISAO)[keyof typeof ACAO_REVISAO];

export const ACAO_REVISAO_LABEL: Record<AcaoRevisao, string> = {
  aprovar: "Aprovar",
  devolver: "Revisar texto",
  rejeitar: "Rejeitar",
  despublicar: "Despublicar",
};

/**
 * Ações que exigem comentário — o banco recusa sem ele.
 *
 * Devolver e rejeitar interrompem o trabalho de outra pessoa; sem o motivo
 * escrito, quem escreveu o conteúdo não sabe o que corrigir. A tela cobra
 * antes de enviar, para que a recusa não chegue como erro do servidor.
 */
export const REVISAO_EXIGE_COMENTARIO: readonly AcaoRevisao[] = [
  ACAO_REVISAO.DEVOLVER,
  ACAO_REVISAO.REJEITAR,
];

/* ------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------ */

export interface Option {
  value: string;
  label: string;
}

/** Converte um mapa de rótulos em `[{ value, label }]` para <Select>. */
export function toOptions<T extends string>(labelMap: Record<T, string>): Option[] {
  return (Object.entries(labelMap) as [T, string][]).map(([value, label]) => ({
    value,
    label,
  }));
}
