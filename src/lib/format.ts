/**
 * Formatação pt-BR.
 *
 * A camada de dados trabalha em ISO 8601 UTC e números crus. A conversão para
 * o formato brasileiro acontece só na renderização — nunca no mock, nunca no
 * adapter. Isso mantém ordenação, filtro e exportação corretos.
 */

const LOCALE = "pt-BR";
const FUSO = "America/Sao_Paulo";
const VAZIO = "—";

type IsoDate = string | null | undefined;

/* ------------------------------------------------------------------- datas */

/** "25/08/2026" */
export function formatarData(iso: IsoDate): string {
  if (!iso) return VAZIO;
  return new Date(iso).toLocaleDateString(LOCALE, { timeZone: FUSO });
}

/** "25/08/2026 14:32" */
export function formatarDataHora(iso: IsoDate): string {
  if (!iso) return VAZIO;
  return new Date(iso).toLocaleString(LOCALE, {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "25 de agosto de 2026" */
export function formatarDataExtenso(iso: IsoDate): string {
  if (!iso) return VAZIO;
  return new Date(iso).toLocaleDateString(LOCALE, {
    timeZone: FUSO,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * "há 5 min", "há 2 h", "ontem" — como na tela de Auditoria do protótipo.
 *
 * Acima de 7 dias volta à data absoluta: "há 43 dias" não ajuda ninguém a
 * localizar um evento.
 */
export function tempoRelativo(iso: IsoDate): string {
  if (!iso) return VAZIO;

  const segundos = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(segundos);

  if (abs < 60) return "agora há pouco";

  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

  if (abs < 3600) return rtf.format(Math.round(segundos / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(segundos / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(segundos / 86400), "day");

  return formatarData(iso);
}

/** Idade em anos a partir da data de nascimento. */
export function idade(isoNascimento: IsoDate): number | null {
  if (!isoNascimento) return null;

  const nascimento = new Date(isoNascimento);
  const hoje = new Date();

  let anos = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) anos -= 1;

  return anos;
}

/* ------------------------------------------------------------------ números */

/** "1.234" */
export function formatarNumero(
  valor: number | null | undefined,
  opcoes?: Intl.NumberFormatOptions,
): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return VAZIO;
  return valor.toLocaleString(LOCALE, opcoes);
}

/** "12,4%" */
export function formatarPercentual(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return VAZIO;
  return `${valor.toLocaleString(LOCALE, {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

/** "7 min", "1 h 12 min" */
export function formatarDuracao(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined) return VAZIO;

  const total = Math.round(minutos);
  if (total < 60) return `${total} min`;

  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/* -------------------------------------------------------------------- texto */

/**
 * Iniciais a partir do nome — primeiro e último, ignorando preposições.
 * "Maria das Graças Silva" → "MS"
 */
export function iniciais(nome = ""): string {
  const ignorar = new Set(["de", "da", "do", "das", "dos", "e"]);
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((parte) => parte && !ignorar.has(parte.toLowerCase()));

  const primeira = partes[0];
  if (!primeira) return "?";
  if (partes.length === 1) return primeira.slice(0, 2).toUpperCase();

  const ultima = partes[partes.length - 1] ?? primeira;
  return `${primeira[0] ?? ""}${ultima[0] ?? ""}`.toUpperCase();
}

/** Corta preservando palavra inteira. */
export function truncar(texto: string | null | undefined, limite = 80): string {
  const valor = texto ?? "";
  if (valor.length <= limite) return valor;

  const corte = valor.lastIndexOf(" ", limite);
  return `${valor.slice(0, corte > 0 ? corte : limite)}…`;
}
