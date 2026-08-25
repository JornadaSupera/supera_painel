import { ACAO_AUDITORIA, ORIGEM_AUDITORIA } from "@/lib/enums";
import type { LogAcesso } from "@/types/usuario";
import { usuarios } from "./usuarios";

/**
 * Histórico de acesso por profissional — o que a gaveta da tela de Usuários
 * mostra.
 *
 * É um recorte da mesma trilha que a tela de Auditoria (Fase 10) lê inteira:
 * aqui filtrada por um profissional, lá por período e recurso. Uma tabela só,
 * duas leituras.
 *
 * Determinístico a partir do índice — recarregar a página não reescreve o
 * histórico de ninguém.
 */

const DIA = 86_400_000;
const HORA = 3_600_000;

/** Um rastro plausível de quem usa o painel: entra, consulta, edita, sai. */
const TRILHA = [
  { acao: ACAO_AUDITORIA.LOGIN, recurso: "auth" },
  { acao: ACAO_AUDITORIA.LEITURA, recurso: "pacientes" },
  { acao: ACAO_AUDITORIA.LEITURA, recurso: "dashboard" },
  { acao: ACAO_AUDITORIA.EDICAO, recurso: "pacientes" },
  { acao: ACAO_AUDITORIA.SIGILOSO, recurso: "pacientes" },
  { acao: ACAO_AUDITORIA.LEITURA, recurso: "conteudo" },
  { acao: ACAO_AUDITORIA.EXPORTACAO, recurso: "relatorios" },
  { acao: ACAO_AUDITORIA.LOGOUT, recurso: "auth" },
] as const;

const NAVEGADORES = [
  "Chrome 141 · Windows 11",
  "Edge 141 · Windows 11",
  "Safari 19 · macOS 15",
  "Chrome 141 · Android 15",
];

/** Faixa interna da clínica; um acesso remoto no meio, que é o que se procura. */
const IPS = ["10.12.4.31", "10.12.4.52", "10.12.4.77", "189.45.201.18"];

const REFERENCIA = Date.parse("2026-08-25T12:00:00.000Z");

export const acessos: LogAcesso[] = usuarios.flatMap((usuario, indiceUsuario) =>
  TRILHA.map((evento, indiceEvento) => {
    const posicao = indiceUsuario * TRILHA.length + indiceEvento;
    const quando = REFERENCIA - indiceEvento * 3 * HORA - (indiceUsuario % 6) * DIA;

    return {
      id: `log-${String(posicao + 1).padStart(4, "0")}`,
      usuario_id: usuario.id,
      acao: evento.acao,
      recurso: evento.recurso,
      origem: ORIGEM_AUDITORIA.PAINEL,
      ip: IPS[posicao % IPS.length] ?? "10.12.4.31",
      user_agent: NAVEGADORES[indiceUsuario % NAVEGADORES.length] ?? "Chrome 141 · Windows 11",
      criado_em: new Date(quando).toISOString(),
    } satisfies LogAcesso;
  }),
);

export default acessos;
