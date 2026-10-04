"use client";

import { create } from "zustand";

interface UiState {
  paletteOpen: boolean;
  newCaseOpen: boolean;
  sidebarCollapsed: boolean;
  setPalette: (open: boolean) => void;
  setNewCase: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useUi = create<UiState>((set) => ({
  paletteOpen: false,
  newCaseOpen: false,
  sidebarCollapsed: false,
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setNewCase: (newCaseOpen) => set({ newCaseOpen }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
