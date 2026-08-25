import { somenteDigitos } from "./mask";

/**
 * Validações de documento e contato brasileiros.
 *
 * Ficam aqui, e não dentro de um schema zod, porque a mesma regra vale em mais
 * de um domínio — CPF em Pacientes, telefone em Pacientes e Usuários — e porque
 * regra pura é testável sem montar formulário.
 */

/**
 * CPF com dígitos verificadores conferidos.
 *
 * Rejeita as sequências repetidas ("111.111.111-11"): elas passam no cálculo do
 * DV, mas nenhuma é um CPF emitido. Sem essa checagem, o campo aceitaria o
 * preenchimento mais comum de quem quer burlar o cadastro.
 */
export function cpfValido(valor: string | null | undefined): boolean {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  const dv = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i += 1) {
      soma += Number(digitos[i]) * (ate + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return dv(9) === Number(digitos[9]) && dv(10) === Number(digitos[10]);
}

/** Celular ou fixo brasileiro: 10 ou 11 dígitos, DDD entre 11 e 99. */
export function telefoneValido(valor: string | null | undefined): boolean {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 10 && digitos.length !== 11) return false;

  const ddd = Number(digitos.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  // Celular tem 11 dígitos e o nono sempre começa com 9.
  return digitos.length === 10 || digitos[2] === "9";
}

/** Data no passado e dentro de um intervalo plausível para pessoa viva. */
export function nascimentoValido(iso: string | null | undefined): boolean {
  if (!iso) return false;

  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return false;

  const hoje = new Date();
  const limite = new Date();
  limite.setFullYear(hoje.getFullYear() - 120);

  return data <= hoje && data >= limite;
}

/** "12345678909" → "123.456.789-09", aplicado enquanto a pessoa digita. */
export function aplicarMascaraCpf(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);

  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

/** "48991234521" → "(48) 99123-4521", aplicado enquanto a pessoa digita. */
export function aplicarMascaraTelefone(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;

  const ddd = `(${d.slice(0, 2)})`;
  const resto = d.slice(2);

  if (resto.length <= 4) return `${ddd} ${resto}`;
  if (resto.length <= 8) return `${ddd} ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `${ddd} ${resto.slice(0, 5)}-${resto.slice(5)}`;
}
