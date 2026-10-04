"use client";

import { createContext, useContext } from "react";

import type { CaseOverview } from "@/types/api";

interface CaseCtx {
  caseId: string;
  overview: CaseOverview | undefined;
  /** Track a background job started from any tab: progress banner + refresh on completion. */
  watchJob: (jobId: string) => void;
}

export const CaseContext = createContext<CaseCtx | null>(null);

export function useCaseContext() {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error("useCaseContext must be used inside the case layout");
  return ctx;
}
