import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Tema claro / escuro / sistema.
 *
 * Zustand, conforme o Anexo I: é estado de cliente puro — nunca vem do
 * servidor, nunca precisa de cache ou invalidação. Estado de servidor fica com
 * o TanStack Query.
 *
 * A preferência de tema é dado de conveniência, não sensível — pode viver em
 * localStorage. Nenhum outro dado do painel pode.
 */

export type Theme = "light" | "dark" | "system";

const THEMES: Theme[] = ["light", "dark", "system"];

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function prefereEscuro(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Aplica a classe `dark` no <html> — convenção do shadcn/ui. */
function aplicar(theme: Theme): void {
  const escuro = theme === "dark" || (theme === "system" && prefereEscuro());
  document.documentElement.classList.toggle("dark", escuro);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",

      setTheme: (theme) => {
        const valido = THEMES.includes(theme) ? theme : "system";
        aplicar(valido);
        set({ theme: valido });
      },

      toggleTheme: () => {
        const atual = get().theme;
        const proximo: Theme =
          atual === "system" ? (prefereEscuro() ? "light" : "dark") : atual === "dark" ? "light" : "dark";

        aplicar(proximo);
        set({ theme: proximo });
      },
    }),
    {
      name: "supera:tema",
      // Aplica no <html> assim que o valor é reidratado do localStorage,
      // senão a primeira pintura sai no tema errado.
      onRehydrateStorage: () => (state) => aplicar(state?.theme ?? "system"),
    },
  ),
);

/**
 * Mantém o tema `system` acompanhando a preferência do SO em tempo real.
 * Chamado uma vez em `main.tsx`.
 */
export function observarTemaDoSistema(): void {
  aplicar(useThemeStore.getState().theme);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useThemeStore.getState().theme === "system") aplicar("system");
  });
}
