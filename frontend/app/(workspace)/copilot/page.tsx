"use client";

import { Bot, Layers, Search } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/common/primitives";
import { CopilotChat } from "@/components/copilot/copilot-chat";
import { Input } from "@/components/ui/input";
import { useCases } from "@/hooks/queries";
import { scoreTone, toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";

export default function CopilotPage() {
  const { data } = useCases();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const items = (data?.items ?? []).filter((c) => `${c.company.name} ${c.reference}`.toLowerCase().includes(q.toLowerCase()));
  const selected = data?.items.find((c) => c.id === caseId);

  return (
    <>
      <PageHeader icon={Bot} title="AI Copilot"
        description="Claude, OpenAI or Gemini with automatic fallback to a grounded local engine. Answers cite the case's own data — pick a case, or ask about the whole portfolio." />
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="panel flex max-h-[calc(100vh-230px)] flex-col overflow-hidden">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-9 pl-9" placeholder="Find a case" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a case" />
            </div>
          </div>
          <ul className="flex-1 space-y-0.5 overflow-y-auto p-2 scrollbar-thin">
            <li>
              <button onClick={() => setCaseId(null)} className={cn("flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition", !caseId ? "bg-primary/10" : "hover:bg-muted")}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white"><Layers className="h-4 w-4" /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold">Whole portfolio</span><span className="block text-xs text-muted-foreground">{data?.total ?? 0} cases</span></span>
              </button>
            </li>
            <li className="label px-2.5 pb-1 pt-3">Cases</li>
            {items.map((c) => (
              <li key={c.id}>
                <button onClick={() => setCaseId(c.id)} className={cn("flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition", caseId === c.id ? "bg-primary/10" : "hover:bg-muted")}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">{c.company.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{c.company.name.replace(/ (Private )?Limited$/, "")}</span><span className="block font-mono text-[11px] text-muted-foreground">{c.reference}</span></span>
                  <span className="numeric text-xs font-semibold" style={{ color: toneHsl[scoreTone(c.latest_score)] }}>{c.latest_score ?? "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <CopilotChat key={caseId ?? "portfolio"} caseId={caseId} companyName={selected?.company.name} />
      </div>
    </>
  );
}
