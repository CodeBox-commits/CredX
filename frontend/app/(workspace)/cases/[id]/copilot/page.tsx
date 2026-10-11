"use client";

import { useCaseContext } from "@/components/case/case-context";
import { CopilotChat } from "@/components/copilot/copilot-chat";

export default function CaseCopilotPage() {
  const { caseId, overview } = useCaseContext();
  return <CopilotChat caseId={caseId} companyName={overview?.company.name} />;
}
