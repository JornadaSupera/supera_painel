import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Preferências de layout.
 *
 * Zustand, conforme o Anexo I: estado de cliente puro. Persistido porque
 * reabrir o painel com o menu recolhido é o que a pessoa escolheu da última
 * vez — preferência de interface não é dado sensível.
 *
 * O menu mobile fica **fora** da persistência: uma gaveta aberta é estado de
 * momento, e restaurá-la aberta na próxima visita seria confuso.
 */

interface LayoutState {
  sidebarColapsada: boolean;
  alternarSidebar: () => void;
  setSidebarColapsada: (colapsada: boolean) => void;

  menuMobileAberto: boolean;
  setMenuMobileAberto: (aberto: boolean) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarColapsada: false,
      alternarSidebar: () => set((s) => ({ sidebarColapsada: !s.sidebarColapsada })),
      setSidebarColapsada: (sidebarColapsada) => set({ sidebarColapsada }),

      menuMobileAberto: false,
      setMenuMobileAberto: (menuMobileAberto) => set({ menuMobileAberto }),
    }),
    {
      name: "supera:layout",
      partialize: (state) => ({ sidebarColapsada: state.sidebarColapsada }),
    },
  ),
);
