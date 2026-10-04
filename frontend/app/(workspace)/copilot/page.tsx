"use client";

import { useState } from "react";

import { PageHeader } from "@/components/common/primitives";
import { CopilotChat } from "@/components/copilot/copilot-chat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCases } from "@/hooks/queries";

export default function CopilotPage() {
  const { data } = useCases();
  const [caseId, setCaseId] = useState<string | null>(null);
  const selected = caseId ?? data?.items[0]?.id ?? null;
  return (
    <>
      <PageHeader
        eyebrow="AI copilot"
        title="Underwriting assistant"
        description="Claude, OpenAI or Gemini with automatic fallback to a deterministic grounded engine — every answer cites the case's own data."
        actions={
          <Select value={selected ?? undefined} onValueChange={setCaseId}>
            <SelectTrigger className="w-80" aria-label="Case"><SelectValue placeholder="Select a case" /></SelectTrigger>
            <SelectContent>{data?.items.map((c) => <SelectItem key={c.id} value={c.id}>{c.company.name} · {c.reference}</SelectItem>)}</SelectContent>
          </Select>
        }
      />
      <CopilotChat key={selected ?? "none"} caseId={selected} />
    </>
  );
}
