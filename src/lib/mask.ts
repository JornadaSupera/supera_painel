/**
 * Mascaramento de dados pessoais.
 *
 * REGRA DO PROJETO: CPF, telefone e e-mail são exibidos mascarados por padrão
 * em qualquer listagem. Revelar o valor completo é ação explícita do usuário —
 * e essa ação gera registro na trilha de auditoria.
 *
 * Reduz exposição incidental: painel aberto numa recepção, tela compartilhada
 * em reunião, captura enviada por engano.
 *
 * Isto é apresentação, não segurança. O dado completo não deve sequer chegar
 * ao navegador de quem não pode vê-lo — isso é a RLS no Postgres (Fase 15).
 */

const VAZIO = "—";

type Valor = string | null | undefined;

/**
 * "12345678909" → "•••.•••.789-09"
 *
 * Formato do protótipo: oculta os seis primeiros dígitos e mantém os cinco
 * finais, que é a convenção usada no Brasil para conferência sem exposição
 * total.
 *
 * > [!] Observação registrada para o cliente
 * Manter os cinco dígitos finais é mais permissivo do que ocultar também os
 * dígitos verificadores. Numa base pequena, os finais reduzem bastante o
 * espaço de busca de um CPF. Seguimos o protótipo por ser a fonte de verdade
 * visual, mas trocar para `•••.•••.789-••` é uma linha — e a decisão é do DPO
 * da clínica.
 */
export function mascararCpf(cpf: Valor): string {
  const digitos = somenteDigitos(cpf);
  if (digitos.length !== 11) return VAZIO;
  return `•••.•••.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
}

/** "12345678909" → "123.456.789-09". Só sob ação explícita e auditada. */
export function formatarCpf(cpf: Valor): string {
  const digitos = somenteDigitos(cpf);
  if (digitos.length !== 11) return VAZIO;
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/** "48991234521" → "(48) 9****-**21" */
export function mascararTelefone(telefone: Valor): string {
  const digitos = somenteDigitos(telefone);
  if (digitos.length < 10) return VAZIO;

  const ddd = digitos.slice(0, 2);
  const finais = digitos.slice(-2);
  const nono = digitos.length === 11 ? "9" : "";

  return `(${ddd}) ${nono}****-**${finais}`;
}

/** "48991234521" → "(48) 99123-4521" */
export function formatarTelefone(telefone: Valor): string {
  const digitos = somenteDigitos(telefone);
  if (digitos.length === 11) return digitos.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digitos.length === 10) return digitos.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return VAZIO;
}

/** "maria.souza@clinica.com.br" → "ma••••••@clinica.com.br" */
export function mascararEmail(email: Valor): string {
  const [usuario, dominio] = (email ?? "").split("@");
  if (!usuario || !dominio) return VAZIO;

  return `${usuario.slice(0, 2)}${"•".repeat(Math.max(3, usuario.length - 2))}@${dominio}`;
}

/**
 * "203.0.113.42" → "203.0.113.***"
 * Usado na Auditoria quando o log é exibido a quem não tem permissão de DPO.
 */
export function mascararIp(ip: Valor): string {
  const partes = (ip ?? "").split(".");
  if (partes.length !== 4) return VAZIO;
  return `${partes[0]}.${partes[1]}.${partes[2]}.***`;
}

/** Só os dígitos — o que vai para o backend. */
export function somenteDigitos(valor: Valor): string {
  return (valor ?? "").replace(/\D/g, "");
}
