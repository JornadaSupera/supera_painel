import { buildAdapter } from "../_stub";

/**
 * O ADAPTER MOCK, AUSENTE.
 * =============================================================================
 * Este arquivo substitui `adapters/mock/index.ts` na build quando
 * `VITE_API_MODE=supabase`. A troca é feita em `vite.config.ts`, por caminho
 * resolvido — ver o plugin `supera:excluir-mocks`.
 *
 * **Por que a substituição existe.** `apiClient` importa os dois adapters e
 * escolhe um em tempo de execução. A escolha é constante na build, mas o
 * import não é: os dois entravam no bundle, e com o mock vinha tudo que ele
 * alcança — a base fictícia de pacientes, com nome e CPF, e a tabela de
 * usuários fictícios **com senha em texto puro**. Um painel de saúde servido
 * publicamente com `senha@ano` na primeira linha do JavaScript não é aceitável
 * nem sendo a senha de uma pessoa que não existe: o endereço de e-mail usa o
 * domínio real da clínica, e o que parece credencial é tratado como
 * credencial por quem a encontra.
 *
 * **Por que um stub, e não a remoção do import.** Trocar o import por uma
 * importação dinâmica mudaria a forma de `apiClient` — que é síncrono e
 * consumido por toda tela — para resolver um problema de empacotamento. O
 * stub mantém o código igual nos dois modos e resolve onde o problema está.
 *
 * **O que sobra.** `buildAdapter` sem implementação devolve a superfície
 * inteira do contrato, com toda operação respondendo `NOT_IMPLEMENTED`. Nada
 * aqui é alcançável com `VITE_API_MODE=supabase` — `apiClient` escolhe o
 * adapter do Supabase —, mas se algum dia for, falha com o erro do contrato
 * em vez de `undefined is not a function`.
 *
 * A guarda `npm run verify-bundle` é o que impede a regressão: com
 * `VITE_API_MODE=supabase` ela procura os rastros do mock no `dist` e recusa a
 * build se encontrar.
 */

export const mockAdapter = buildAdapter({ name: "mock" });

/**
 * Vazio de propósito.
 *
 * `INDISPONIVEIS` explica à tela por que uma ação não existe naquele backend.
 * Só a lista do Supabase é consultada quando o modo é Supabase, e é ela que
 * carrega os motivos reais.
 */
export const INDISPONIVEIS: Readonly<Record<string, string>> = {};

export default mockAdapter;
