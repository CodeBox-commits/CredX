"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, Network, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FraudGraph, NodeIcon } from "@/charts/fraud-graph";
import { FraudHeatmap } from "@/charts/intel-charts";
import { useCaseContext } from "@/components/case/case-context";
import { BlockSkeleton, EmptyState, SectionCard, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { errorMessage, qk, useCaseAction, useFraud } from "@/hooks/queries";
import { formatCr, titleCase } from "@/lib/format";
import { riskTone, severityTone, statusTone, toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";
import type { GraphNode } from "@/types/api";

export default function FraudPage() {
  const { caseId, watchJob } = useCaseContext();
  const { data: f, isLoading } = useFraud(caseId);
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const run = useCaseAction(caseId, "fraud", (j) => watchJob(j.id));
  const [selected, setSelected] = useState<GraphNode | null>(null);

  if (isLoading) return <BlockSkeleton className="h-[520px]" />;
  if (!f) return <EmptyState icon={Network} title="No fraud analysis yet" description="Runs as part of full analysis or on its own." action={can("analyst") && <Button onClick={() => run.mutate()}>Run fraud analysis</Button>} />;

  const review = async (id: string, status: "confirmed" | "dismissed" | "open") => {
    try {
      await api.fraud.updateAlert(id, status);
      qc.invalidateQueries({ queryKey: qk.fraud(caseId) });
      toast.success(`Alert ${status}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const copyCypher = async () => {
    const cypher = await api.fraud.cypher(caseId);
    await navigator.clipboard.writeText(cypher);
    toast.success("Neo4j Cypher copied", { description: `${cypher.split("\n").length} MERGE statements` });
  };
  const selectedAlerts = selected ? f.alerts.filter((a) => a.entities.includes(selected.id)) : [];
  const selectedLinks = selected ? f.graph.links.filter((l) => l.source === selected.id || l.target === selected.id) : [];
  const name = (id: string) => f.graph.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <div className="grid gap-5 xl:grid-cols-4">
      <SectionCard eyebrow="Entity graph" title="Relationship & money-flow network" className="xl:col-span-3" bodyClassName="p-3"
        actions={<>
          {can("analyst") && <Button variant="ghost" size="sm" onClick={copyCypher}><Copy className="mr-1.5 h-3.5 w-3.5" />Cypher</Button>}
          {can("analyst") && <Button variant="outline" size="sm" onClick={() => run.mutate()}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Re-run</Button>}
        </>}>
        <FraudGraph nodes={f.graph.nodes} links={f.graph.links} borrowerId={f.graph.borrower_id} onSelect={setSelected} selectedId={selected?.id} />
      </SectionCard>

      <div className="space-y-5">
        <SectionCard eyebrow="Forensic score" title="Fraud risk">
          <div className="flex items-end gap-3">
            <p className="numeric text-5xl font-semibold" style={{ color: toneHsl[riskTone(f.risk_level)] }}>{f.fraud_score}</p>
            <div className="pb-1.5"><ToneBadge tone={riskTone(f.risk_level)}>{f.risk_level}</ToneBadge><p className="mt-1 text-xs text-muted-foreground">out of 100</p></div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{f.summary}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-muted/50 p-2"><p className="numeric text-base font-semibold">{f.stats.companies}</p>companies</div>
            <div className="rounded-lg bg-muted/50 p-2"><p className="numeric text-base font-semibold">{f.stats.people}</p>people</div>
            <div className="rounded-lg bg-muted/50 p-2"><p className="numeric text-base font-semibold text-destructive">{f.stats.cycles}</p>loops</div>
          </div>
        </SectionCard>
        <SectionCard eyebrow="Inspector" title={selected ? selected.label : "Select a node"}>
          {!selected ? <p className="text-sm text-muted-foreground">Click an entity in the graph to see its relationships, flows and alerts. Drag to rearrange, scroll to zoom.</p> : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><NodeIcon type={selected.type} /><span className="capitalize">{selected.type}</span>{selected.flagged && <ToneBadge tone="destructive">flagged</ToneBadge>}</div>
              {Object.entries(selected.meta).map(([k, v]) => <p key={k} className="font-mono text-xs"><span className="text-muted-foreground">{k}:</span> {v}</p>)}
              <ul className="space-y-1 text-xs">
                {selectedLinks.slice(0, 8).map((l, i) => (
                  <li key={i} className={cn(l.flagged && "text-destructive")}>
                    {l.source === selected.id ? "→" : "←"} {name(l.source === selected.id ? l.target : l.source)} · {titleCase(l.type)} {l.amount ? formatCr(l.amount) : ""}
                  </li>
                ))}
              </ul>
              {selectedAlerts.map((a) => <p key={a.id} className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{a.title}</p>)}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard eyebrow="Alerts" title={`Suspicious patterns (${f.alerts.length})`} className="xl:col-span-2" bodyClassName="p-0">
        <ul className="divide-y divide-border">
          {f.alerts.map((a) => (
            <li key={a.id} className={cn("px-5 py-3", a.status === "dismissed" && "opacity-50")}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: toneHsl[severityTone(a.severity)] }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{a.title}</p>
                    <ToneBadge tone={severityTone(a.severity)}>{a.severity}</ToneBadge>
                    {a.status !== "open" && <ToneBadge tone={a.status === "confirmed" ? "destructive" : "muted"}>{a.status}</ToneBadge>}
                    <span className="numeric text-xs text-muted-foreground">+{a.score_impact}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
                </div>
                {can("analyst") && a.status === "open" && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => review(a.id, "confirmed")} aria-label="Confirm alert"><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => review(a.id, "dismissed")} aria-label="Dismiss alert"><X className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
            </li>
          ))}
          {!f.alerts.length && <li className="px-5 py-6 text-center text-sm text-muted-foreground">No graph or document fraud alerts.</li>}
        </ul>
      </SectionCard>

      <div className="space-y-5 xl:col-span-2">
        <SectionCard eyebrow="GST forensics" title="Return reconciliation" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {f.gst_checks.map((c, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                <ToneBadge tone={statusTone(c.status)} className="mt-0.5 w-12 justify-center uppercase">{c.status}</ToneBadge>
                <div><p className="font-medium">{c.check}</p><p className="text-xs text-muted-foreground">{c.detail}</p></div>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard eyebrow="Heatmap" title="Entity × risk dimension">
          <FraudHeatmap rows={f.heatmap} />
        </SectionCard>
      </div>
    </div>
  );
}
