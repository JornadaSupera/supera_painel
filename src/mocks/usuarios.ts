import { ESPECIALIDADE, PAPEL, STATUS_USUARIO } from "@/lib/enums";
import type { Especialidade, Papel, StatusUsuario } from "@/lib/enums";
import type { Permissao } from "@/lib/rbac";

/**
 * Profissionais cadastrados.
 *
 * Espelha o cabeçalho do protótipo: "16 profissionais cadastrados ·
 * 7 especialidades", com a mesma distribuição — 3 médicos, 2 farmacêuticos,
 * 3 enfermeiros, 2 nutricionistas, 2 psicólogos, 2 dentistas,
 * 2 fisioterapeutas — mais os perfis de gestão.
 *
 * Campos em `snake_case`: são as colunas da futura tabela `usuarios`.
 *
 * > [!] `senha_mock` só existe no mock.
 * Nenhuma senha real trafega ou é comparada no front-end. Na Fase 15 quem
 * autentica é o `supabase.auth`, e este campo desaparece com o arquivo.
 */

export interface UsuarioMock {
  id: string;
  nome: string;
  /** Como a pessoa é tratada na clínica: Dra., Enf., Nutri. */
  tratamento: string | null;
  email: string;
  senha_mock: string;
  papel: Papel;
  especialidade: Especialidade | null;
  registro: string | null;
  avatar_url: string | null;
  status: StatusUsuario;
  mfa_ativo: boolean;
  /** Janela de atendimento no chat. Padrão do protótipo: 08:00–18:00. */
  horario_inicio: string | null;
  horario_fim: string | null;
  permissoes_extras: Permissao[];
  ultimo_acesso_em: string | null;
  criado_em: string;
}

const HORARIO_PADRAO = { horario_inicio: "08:00", horario_fim: "18:00" };
const SEM_EXTRAS: Permissao[] = [];

export const usuarios: UsuarioMock[] = [
  /* --------------------------------------------------------------- gestão */
  {
    id: "1f0a7b3c-5d21-4e88-9a10-2c4b6e8f1d90",
    nome: "Patrícia Nunes Bittencourt",
    tratamento: null,
    email: "patricia.nunes@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.ADMIN,
    especialidade: null,
    registro: null,
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-25T11:42:00.000Z",
    criado_em: "2025-11-03T13:00:00.000Z",
  },
  {
    id: "2b91c4de-7f30-4a55-8c62-1d3e5a7b9c04",
    nome: "Ricardo Amorim Steil",
    tratamento: null,
    email: "ricardo.steil@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.GESTOR,
    especialidade: null,
    registro: null,
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-25T09:15:00.000Z",
    criado_em: "2025-11-03T13:00:00.000Z",
  },

  /* ---------------------------------------------- médicos oncologistas (3) */
  {
    id: "3c82d5ef-8a41-4b66-9d73-2e4f6b8c0d15",
    nome: "Ana Beatriz Rocha",
    tratamento: "Dra.",
    email: "ana.rocha@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.MEDICO,
    registro: "CRM/SC 18432",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-25T12:05:00.000Z",
    criado_em: "2025-11-10T13:00:00.000Z",
  },
  {
    id: "4d73e6f0-9b52-4c77-8e84-3f5a7c9d1e26",
    nome: "Carlos Eduardo Lima",
    tratamento: "Dr.",
    email: "carlos.lima@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.MEDICO,
    registro: "CRM/SC 21907",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    horario_inicio: "13:00",
    horario_fim: "19:00",
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-24T20:31:00.000Z",
    criado_em: "2025-11-10T13:00:00.000Z",
  },
  {
    id: "5e64f7a1-0c63-4d88-9f95-4a6b8d0e2f37",
    nome: "Marcelo Tavares Bley",
    tratamento: "Dr.",
    email: "marcelo.bley@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.MEDICO,
    registro: "CRM/SC 15220",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: false,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-22T14:10:00.000Z",
    criado_em: "2025-12-01T13:00:00.000Z",
  },

  /* --------------------------------------------------- farmacêuticos (2) */
  {
    id: "6f55a8b2-1d74-4e99-8a06-5b7c9e1f3a48",
    nome: "Juliana Reis Fontana",
    tratamento: "Dra.",
    email: "juliana.fontana@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.FARMACEUTICO,
    registro: "CRF/SC 9114",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-25T10:48:00.000Z",
    criado_em: "2025-11-18T13:00:00.000Z",
  },
  {
    id: "7a46b9c3-2e85-4f00-9b17-6c8d0f2a4b59",
    nome: "Tiago Machado Vieira",
    tratamento: "Dr.",
    email: "tiago.vieira@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.FARMACEUTICO,
    registro: "CRF/SC 10388",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-25T08:02:00.000Z",
    criado_em: "2025-11-18T13:00:00.000Z",
  },

  /* ------------------------------------------------------- enfermeiros (3) */
  {
    id: "8b37c0d4-3f96-4a11-8c28-7d9e1a3b5c60",
    nome: "Rafael dos Santos",
    tratamento: "Enf.",
    email: "rafael.santos@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.ENFERMEIRO,
    registro: "COREN/SC 344120",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    horario_inicio: "07:00",
    horario_fim: "16:00",
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-25T12:30:00.000Z",
    criado_em: "2025-11-20T13:00:00.000Z",
  },
  {
    id: "9c28d1e5-4a07-4b22-9d39-8e0f2b4c6d71",
    nome: "Camila Souza",
    tratamento: "Enf.",
    email: "camila.souza@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.ENFERMEIRO,
    registro: "COREN/SC 351877",
    avatar_url: null,
    status: STATUS_USUARIO.PAUSADO,
    mfa_ativo: true,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-07-30T17:22:00.000Z",
    criado_em: "2025-11-20T13:00:00.000Z",
  },
  {
    id: "0d19e2f6-5b18-4c33-8e40-9f1a3c5d7e82",
    nome: "Bruno Kretzer Damiani",
    tratamento: "Enf.",
    email: "bruno.damiani@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.ENFERMEIRO,
    registro: "COREN/SC 362045",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: false,
    horario_inicio: "12:00",
    horario_fim: "21:00",
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-24T22:14:00.000Z",
    criado_em: "2026-01-12T13:00:00.000Z",
  },

  /* ----------------------------------------------------- nutricionistas (2) */
  {
    id: "1e0af3a7-6c29-4d44-9f51-0a2b4d6e8f93",
    nome: "Letícia Mafra",
    tratamento: "Nutri.",
    email: "leticia.mafra@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.NUTRICIONISTA,
    registro: "CRN-10 5521",
    avatar_url: null,
    status: STATUS_USUARIO.PAUSADO,
    mfa_ativo: true,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-01T13:40:00.000Z",
    criado_em: "2025-12-05T13:00:00.000Z",
  },
  {
    id: "2f1b04b8-7d30-4e55-8a62-1b3c5e7f9a04",
    nome: "Helena Duarte Prim",
    tratamento: "Nutri.",
    email: "helena.prim@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.NUTRICIONISTA,
    registro: "CRN-10 6103",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-25T09:58:00.000Z",
    criado_em: "2025-12-05T13:00:00.000Z",
  },

  /* --------------------------------------------------------- psicólogos (2) */
  {
    id: "3a2c15c9-8e41-4f66-9b73-2c4d6f8a0b15",
    nome: "Fernanda Colaço Ribas",
    tratamento: "Psic.",
    email: "fernanda.ribas@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.PSICOLOGO,
    registro: "CRP-12 09876",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-25T11:05:00.000Z",
    criado_em: "2025-12-15T13:00:00.000Z",
  },
  {
    id: "4b3d26da-9f52-4a77-8c84-3d5e7a9b1c26",
    nome: "Gustavo Peixoto Alencar",
    tratamento: "Psic.",
    email: "gustavo.alencar@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.PSICOLOGO,
    registro: "CRP-12 11204",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    horario_inicio: "09:00",
    horario_fim: "17:00",
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-23T16:44:00.000Z",
    criado_em: "2026-02-02T13:00:00.000Z",
  },

  /* ---------------------------------------------------------- dentistas (2) */
  {
    id: "5c4e37eb-0a63-4b88-9d95-4e6f8b0c2d37",
    nome: "Mariana Cardoso Feltrin",
    tratamento: "Dent.",
    email: "mariana.feltrin@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.DENTISTA,
    registro: "CRO/SC 14588",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-25T10:12:00.000Z",
    criado_em: "2026-01-20T13:00:00.000Z",
  },
  {
    id: "6d5f48fc-1b74-4c99-8e06-5f7a9c1d3e48",
    nome: "André Luiz Cavalheiro",
    tratamento: "Dent.",
    email: "andre.cavalheiro@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.DENTISTA,
    registro: "CRO/SC 15902",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: false,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-19T15:26:00.000Z",
    criado_em: "2026-01-20T13:00:00.000Z",
  },

  /* ----------------------------------------------------- fisioterapeutas (2) */
  {
    id: "7e60590d-2c85-4d00-9f17-6a8b0d2e4f59",
    nome: "Pedro Henrique Alves",
    tratamento: "Fisio.",
    email: "pedro.alves@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.FISIOTERAPEUTA,
    registro: "CREFITO-10 88213",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-25T08:37:00.000Z",
    criado_em: "2026-02-10T13:00:00.000Z",
  },
  {
    id: "8f716a1e-3d96-4e11-8a28-7b9c1e3f5a60",
    nome: "Vanessa Küster Amboni",
    tratamento: "Fisio.",
    email: "vanessa.amboni@cosc.com.br",
    senha_mock: "Supera@2026",
    papel: PAPEL.PROFISSIONAL,
    especialidade: ESPECIALIDADE.FISIOTERAPEUTA,
    registro: "CREFITO-10 91470",
    avatar_url: null,
    status: STATUS_USUARIO.ATIVO,
    mfa_ativo: true,
    ...HORARIO_PADRAO,
    permissoes_extras: SEM_EXTRAS,
    ultimo_acesso_em: "2026-08-24T11:19:00.000Z",
    criado_em: "2026-02-10T13:00:00.000Z",
  },
];

export default usuarios;
