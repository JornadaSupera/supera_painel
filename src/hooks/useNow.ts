import { useEffect, useState } from "react";

/**
 * O instante de agora, renovado de tempos em tempos.
 *
 * Para o que depende da hora sem depender de dado novo — a linha do "agora" na
 * agenda, por exemplo. Só corre com a aba visível: uma aba esquecida em segundo
 * plano não acorda a cada minuto para mover uma linha que ninguém vê, e ao voltar
 * a aba o valor se atualiza na hora, sem esperar o próximo tique.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer === null) timer = setInterval(() => setNow(new Date()), intervalMs);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setNow(new Date());
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return now;
}
