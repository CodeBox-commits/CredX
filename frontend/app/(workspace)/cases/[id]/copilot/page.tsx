"use client";

import { useCaseContext } from "@/components/case/case-context";
import { CopilotChat } from "@/components/copilot/copilot-chat";

export default function CaseCopilotPage() {
  const { caseId } = useCaseContext();
  return <CopilotChat caseId={caseId} />;
}
