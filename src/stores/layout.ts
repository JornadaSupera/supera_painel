import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Layout preferences.
 *
 * Zustand: pure client state. Persisted because reopening the panel with the
 * menu collapsed is what the person chose last time — an interface preference
 * is not sensitive data.
 *
 * The mobile menu stays **out** of persistence: an open drawer is momentary
 * state, and restoring it open on the next visit would be confusing.
 */

interface LayoutState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      mobileMenuOpen: false,
      setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
    }),
    {
      name: "supera:layout",
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
