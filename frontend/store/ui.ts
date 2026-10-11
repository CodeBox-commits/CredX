"use client";

import { create } from "zustand";

interface UiState {
  paletteOpen: boolean;
  newCaseOpen: boolean;
  setPalette: (open: boolean) => void;
  setNewCase: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  paletteOpen: false,
  newCaseOpen: false,
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setNewCase: (newCaseOpen) => set({ newCaseOpen }),
}));
