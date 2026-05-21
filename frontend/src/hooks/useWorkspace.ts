import { useEffect, useState } from "react";
import {
  loadWorkspaceState,
  resetWorkspaceState,
  updateWorkspaceState,
  type WorkspaceState,
} from "@/lib/intelliCredit";
import type { UploadedFileMeta } from "@/lib/creditTypes";
import {
  PLATFORM_ANALYSIS_EVENT,
  loadPlatformAnalysisState,
  resetPlatformAnalysisState,
  syncPlatformAnalysis,
  updatePlatformAnalysisState,
} from "@/lib/platformWorkspace";

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() =>
    loadWorkspaceState(),
  );
  const [analysis, setAnalysis] = useState(() => loadPlatformAnalysisState());

  useEffect(() => {
    const sync = () => {
      setWorkspace(loadWorkspaceState());
      setAnalysis(loadPlatformAnalysisState());
    };

    window.addEventListener("credx-workspace-updated", sync);
    window.addEventListener(PLATFORM_ANALYSIS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("credx-workspace-updated", sync);
      window.removeEventListener(PLATFORM_ANALYSIS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    workspace,
    analysis,
    setCompanyName: (companyName: string) =>
      setWorkspace(updateWorkspaceState({ companyName })),
    setDueDiligenceNote: (dueDiligenceNote: string) =>
      setWorkspace(updateWorkspaceState({ dueDiligenceNote })),
    setRequestedAmountCr: (requestedAmountCr: number) =>
      setWorkspace(updateWorkspaceState({ requestedAmountCr })),
    setDocuments: (documents: UploadedFileMeta[]) =>
      setWorkspace(updateWorkspaceState({ documents })),
    markAnalysisFallback: (message: string) => {
      const nextAnalysis = updatePlatformAnalysisState({
        status: "fallback",
        message,
      });
      setAnalysis(nextAnalysis);
      return nextAnalysis;
    },
    syncPlatformAnalysis: async (
      patch?: Partial<
        Pick<
          WorkspaceState,
          | "companyName"
          | "cin"
          | "sector"
          | "facilityType"
          | "requestedAmountCr"
          | "dueDiligenceNote"
          | "documents"
        >
      >,
    ) => {
      const nextAnalysis = await syncPlatformAnalysis(patch);
      setAnalysis(nextAnalysis);
      setWorkspace(loadWorkspaceState());
      return nextAnalysis;
    },
    resetWorkspace: () => {
      setWorkspace(resetWorkspaceState());
      setAnalysis(resetPlatformAnalysisState());
    },
    refreshWorkspace: () => {
      setWorkspace(loadWorkspaceState());
      setAnalysis(loadPlatformAnalysisState());
    },
  };
}
