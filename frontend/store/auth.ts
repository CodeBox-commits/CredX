"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Role, User } from "@/types/api";

const RANK: Record<Role, number> = { viewer: 0, analyst: 1, credit_manager: 2, admin: 3 };

interface AuthState {
  token: string | null;
  user: User | null;
  expiresAt: number | null;
  hydrated: boolean;
  setSession: (token: string, user: User, expiresIn: number) => void;
  logout: () => void;
  can: (minimum: Role) => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      expiresAt: null,
      hydrated: false,
      setSession: (token, user, expiresIn) => set({ token, user, expiresAt: Date.now() + expiresIn * 1000 }),
      logout: () => set({ token: null, user: null, expiresAt: null }),
      can: (minimum) => {
        const role = get().user?.role;
        return role ? RANK[role] >= RANK[minimum] : false;
      },
    }),
    {
      name: "credx-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, user: s.user, expiresAt: s.expiresAt }),
      onRehydrateStorage: () => (state) => {
        if (state?.expiresAt && state.expiresAt < Date.now()) state.logout();
      },
    },
  ),
);

// localStorage rehydrates synchronously inside create(), before `useAuth` is assigned, so the
// hydrated flag must be set from here rather than from onRehydrateStorage.
const markHydrated = () => useAuth.setState({ hydrated: true });
if (typeof window !== "undefined" && useAuth.persist) {
  if (useAuth.persist.hasHydrated()) markHydrated();
  else useAuth.persist.onFinishHydration(markHydrated);
}

export const roleLabel = (r?: Role | null) =>
  ({ admin: "Admin", credit_manager: "Credit manager", analyst: "Analyst", viewer: "Viewer" })[r ?? "viewer"];
