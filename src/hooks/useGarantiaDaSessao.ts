import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import { queryKeys } from "@/lib/queryKeys";
import { authApi, call } from "@/services/apiClient";

/**
 * O nível de garantia da sessão, confrontado com o que o backend exige.
 *
 * Fica em `hooks/` e não em uma feature porque dois lugares o consomem, e por
 * razões diferentes: a moldura do painel decide se abre as telas, e a tela de
 * Configurações decide se pode oferecer o interruptor da exigência.
 *
 * > [!] Não é uma checagem de permissão. É uma checagem de honestidade.
 * Com o segundo fator exigido no backend e a sessão em um fator, nenhuma tela
 * recebe erro: todas recebem **lista vazia**. O painel passaria a descrever uma
 * clínica sem pacientes, sem trilha e sem catálogo — e quem estivesse operando
 * não teria como saber que o número é falso.
 *
 * Roda uma vez por sessão e fica quente. O nível não muda sozinho: subir exige
 * verificar o segundo fator, e isso passa por um login novo. O que pode mudar
 * embaixo dos pés é a **exigência**, quando outro administrador a liga — e
 * nesse caso quem invalida esta chave é a própria tela que a ligou.
 */
export function useGarantiaDaSessao() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.auth.assurance(),
    queryFn: async () => (await call(() => authApi.getGarantia())).data,
    enabled: isAuthenticated,
    staleTime: Infinity,
    /*
     * Falhar aqui NÃO bloqueia o painel — ver `AdminLayout`. Uma checagem de
     * diagnóstico que derruba a tela quando ela própria falha transforma uma
     * queda de rede em painel inacessível, que é pior do que o problema que ela
     * veio denunciar.
     */
    retry: 1,
  });
}
