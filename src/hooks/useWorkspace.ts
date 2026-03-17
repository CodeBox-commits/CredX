import { useEffect, useState } from "react";
import {
  loadWorkspaceState,
  resetWorkspaceState,
  updateWorkspaceState,
  type WorkspaceState,
} from "@/lib/intelliCredit";
import type { UploadedFileMeta } from "@/lib/creditTypes";

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() =>
    loadWorkspaceState(),
  );

  useEffect(() => {
    const sync = () => {
      setWorkspace(loadWorkspaceState());
    };

    window.addEventListener("credx-workspace-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("credx-workspace-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    workspace,
    setCompanyName: (companyName: string) =>
      setWorkspace(updateWorkspaceState({ companyName })),
    setDueDiligenceNote: (dueDiligenceNote: string) =>
      setWorkspace(updateWorkspaceState({ dueDiligenceNote })),
    setRequestedAmountCr: (requestedAmountCr: number) =>
      setWorkspace(updateWorkspaceState({ requestedAmountCr })),
    setDocuments: (documents: UploadedFileMeta[]) =>
      setWorkspace(updateWorkspaceState({ documents })),
    resetWorkspace: () => setWorkspace(resetWorkspaceState()),
    refreshWorkspace: () => setWorkspace(loadWorkspaceState()),
  };
}
