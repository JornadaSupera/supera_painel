import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Light / dark / system theme.
 *
 * Light is the panel default. It is the theme the reference screens were drawn
 * in, and the one a clinic workstation is read in all day; following the
 * operating system would hand half the team a look nobody signed off on. Dark
 * and system stay one click away in the top bar.
 *
 * Zustand: pure client state — it never comes from the server, never needs
 * cache or invalidation. Server state belongs to TanStack Query.
 *
 * The theme preference is convenience data, not sensitive — it may live in
 * localStorage. No other panel data may.
 */

export type Theme = "light" | "dark" | "system";

const THEMES: Theme[] = ["light", "dark", "system"];

/** What someone opening the panel for the first time gets. */
const DEFAULT_THEME: Theme = "light";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applies the `dark` class on <html> — the shadcn/ui convention. */
function apply(theme: Theme): void {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: DEFAULT_THEME,

      setTheme: (theme) => {
        const valid = THEMES.includes(theme) ? theme : DEFAULT_THEME;
        apply(valid);
        set({ theme: valid });
      },

      toggleTheme: () => {
        const current = get().theme;
        const next: Theme =
          current === "system"
            ? prefersDark()
              ? "light"
              : "dark"
            : current === "dark"
              ? "light"
              : "dark";

        apply(next);
        set({ theme: next });
      },
    }),
    {
      name: "supera:theme",
      // Applies it on <html> as soon as the value is rehydrated from
      // localStorage, otherwise the first paint uses the wrong theme.
      onRehydrateStorage: () => (state) => apply(state?.theme ?? DEFAULT_THEME),
    },
  ),
);

/**
 * Keeps the `system` theme following the OS preference in real time.
 * Called once from `main.tsx`.
 */
export function watchSystemTheme(): void {
  apply(useThemeStore.getState().theme);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useThemeStore.getState().theme === "system") apply("system");
  });
}
