"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeftRight, Check, Copy, Grid3x3, Loader2, Network, ReceiptIndianRupee, RefreshCw, ShieldAlert, Undo2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FraudGraph, NodeIcon } from "@/charts/fraud-graph";
import { FraudHeatmap } from "@/charts/intel-charts";
import { useCaseContext } from "@/components/case/case-context";
import { BlockSkeleton, EmptyState, MeterBar, SectionCard, ToneBadge } from "@/components/common/primitives";
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

  if (isLoading) return <BlockSkeleton className="h-[560px]" />;
  if (!f) {
    return <EmptyState icon={Network} title="No fraud analysis yet" description="Runs as part of full analysis or on its own."
      action={can("analyst") && <Button onClick={() => run.mutate()} disabled={run.isPending}>{run.isPending ? <Loader2 className="animate-spin" /> : <Network />} Run fraud analysis</Button>} />;
  }

  const review = async (id: string, status: "confirmed" | "dismissed" | "open") => {
    try {
      await api.fraud.updateAlert(id, status);
      qc.invalidateQueries({ queryKey: qk.fraud(caseId) });
      toast.success(status === "open" ? "Alert re-opened" : `Alert ${status}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const copyCypher = async () => {
    try {
      const cypher = await api.fraud.cypher(caseId);
      await navigator.clipboard.writeText(cypher);
      toast.success("Neo4j Cypher copied", { description: "Paste into Neo4j Browser to explore the graph." });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const nodes = f.graph.nodes;
  const links = f.graph.links;
  const companies = nodes.filter((n) => n.type !== "person").length;
  const people = nodes.filter((n) => n.type === "person").length;
  const flaggedLinks = links.filter((l) => l.flagged).length;
  const tone = riskTone(f.risk_level);
  const name = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;
  const selectedAlerts = selected ? f.alerts.filter((a) => a.entities.includes(selected.id)) : [];
  const selectedLinks = selected ? links.filter((l) => l.source === selected.id || l.target === selected.id) : [];
  const open = f.alerts.filter((a) => a.status === "open").length;

  return (
    <div className="space-y-6">
      {/* Score strip */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
        <div className="panel relative overflow-hidden p-5">
          <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: toneHsl[tone] }} />
          <div className="flex items-center gap-5">
            <div>
              <p className="text-[13px] text-muted-foreground">Fraud risk score</p>
              <p className="numeric mt-1 text-5xl font-bold leading-none" style={{ color: toneHsl[tone] }}>{f.fraud_score}<span className="text-lg text-muted-foreground">/100</span></p>
            </div>
            <div className="min-w-0 flex-1">
              <ToneBadge tone={tone} dot pulse={f.fraud_score >= 50}>{f.risk_level} risk</ToneBadge>
              <p className="mt-2 line-clamp-3 text-[13px] text-muted-foreground">{f.summary}</p>
            </div>
          </div>
        </div>
        {[
          { label: "Entities", value: `${companies} companies · ${people} people`, icon: Network },
          { label: "Suspicious flows", value: `${flaggedLinks} of ${links.length} edges`, icon: ArrowLeftRight, hot: flaggedLinks > 0 },
          { label: "Open alerts", value: `${open} of ${f.alerts.length}`, icon: AlertTriangle, hot: open > 0 },
        ].map((s) => (
          <div key={s.label} className="panel flex items-center gap-3 p-4">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", s.hot ? "bg-destructive/12 text-destructive" : "bg-muted text-muted-foreground")}><s.icon className="h-5 w-5" /></span>
            <div className="min-w-0"><p className="text-xs text-muted-foreground">{s.label}</p><p className="truncate text-sm font-semibold">{s.value}</p></div>
          </div>
        ))}
      </div>

      {/* Graph + inspector */}
      <SectionCard title="Relationship & money-flow network" icon={Network} bodyClassName="p-3"
        info="Companies, directors, invoices and payments from GSTN and MCA data. Red animated edges trace suspicious loops; click any entity to inspect it."
        actions={<>
          {can("analyst") && <Button variant="ghost" size="sm" onClick={copyCypher}><Copy /> Neo4j Cypher</Button>}
          {can("analyst") && <Button variant="outline" size="sm" onClick={() => run.mutate()} disabled={run.isPending}>{run.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-run</Button>}
        </>}>
        <div className="relative">
          <FraudGraph nodes={nodes} links={links} borrowerId={f.graph.borrower_id} onSelect={setSelected} selectedId={selected?.id} />
          <AnimatePresence>
            {selected && (
              <motion.aside initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
                className="absolute right-3 top-3 z-20 max-h-[calc(100%-24px)] w-[300px] overflow-y-auto rounded-xl border border-border bg-popover/95 p-4 shadow-xl backdrop-blur scrollbar-thin">
                <div className="flex items-start gap-2">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", selected.flagged ? "bg-destructive/12 text-destructive" : "bg-muted text-muted-foreground")}><NodeIcon type={selected.type} /></span>
                  <div className="min-w-0 flex-1"><p className="font-semibold leading-tight">{selected.label}</p><p className="text-xs capitalize text-muted-foreground">{selected.type}</p></div>
                  <button onClick={() => setSelected(null)} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close inspector"><X className="h-4 w-4" /></button>
                </div>
                <div className="mt-3"><p className="mb-1 text-xs text-muted-foreground">Entity risk</p><MeterBar value={selected.risk * 100} /></div>
                {Object.keys(selected.meta).length > 0 && (
                  <dl className="mt-3 space-y-1 rounded-lg bg-muted/50 p-2.5 text-xs">
                    {Object.entries(selected.meta).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="truncate text-right font-medium">{v}</dd></div>)}
                  </dl>
                )}
                {selectedLinks.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs text-muted-foreground">Connections ({selectedLinks.length})</p>
                    <ul className="space-y-1">
                      {selectedLinks.slice(0, 10).map((l, i) => (
                        <li key={i} className={cn("flex items-center gap-2 rounded-md px-2 py-1 text-xs", l.flagged ? "bg-destructive/10 text-destructive" : "bg-muted/40")}>
                          <span>{l.source === selected.id ? "→" : "←"}</span>
                          <span className="min-w-0 flex-1 truncate">{name(l.source === selected.id ? l.target : l.source)}</span>
                          <span className="numeric shrink-0">{l.amount ? formatCr(l.amount, 1) : titleCase(l.type)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedAlerts.map((a) => <p key={a.id} className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs font-medium text-destructive">{a.title}</p>)}
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <SectionCard title={`Suspicious patterns (${f.alerts.length})`} icon={ShieldAlert} bodyClassName="p-0">
          <ul className="divide-y divide-border/70">
            {f.alerts.map((a, i) => (
              <motion.li key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={cn("px-5 py-4 transition", a.status === "dismissed" && "opacity-55")}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: toneHsl[severityTone(a.severity)].replace(")", " / 0.12)"), color: toneHsl[severityTone(a.severity)] }}>
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{a.title}</p>
                      <ToneBadge tone={severityTone(a.severity)}>{a.severity}</ToneBadge>
                      {a.status !== "open" && <ToneBadge tone={a.status === "confirmed" ? "destructive" : "muted"}>{titleCase(a.status)}</ToneBadge>}
                    </div>
                    <p className="mt-1 text-[13px] text-muted-foreground">{a.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="numeric text-xs text-muted-foreground">+{a.score_impact} fraud pts</span>
                      {a.entities.length > 0 && (
                        <button className="text-xs font-medium text-primary hover:underline" onClick={() => setSelected(nodes.find((n) => n.id === a.entities[0]) ?? null)}>Show in graph</button>
                      )}
                    </div>
                  </div>
                  {can("analyst") && (
                    <div className="flex shrink-0 gap-1">
                      {a.status === "open" ? <>
                        <Button size="sm" variant="outline" className="h-7 border-destructive/30 px-2 text-destructive hover:bg-destructive/10" onClick={() => review(a.id, "confirmed")}><Check className="h-3.5 w-3.5" /> Confirm</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => review(a.id, "dismissed")}><X className="h-3.5 w-3.5" /> Dismiss</Button>
                      </> : <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => review(a.id, "open")}><Undo2 className="h-3.5 w-3.5" /> Re-open</Button>}
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
            {!f.alerts.length && <li className="p-5"><EmptyState compact icon={Check} title="No suspicious patterns" description="Graph, GST and document checks found nothing material." /></li>}
          </ul>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="GST forensics" icon={ReceiptIndianRupee} bodyClassName="p-0">
            <ul className="divide-y divide-border/70">
              {f.gst_checks.map((c, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3">
                  <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", c.status === "pass" ? "bg-success/12 text-success" : c.status === "fail" ? "bg-destructive/12 text-destructive" : c.status === "warn" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>
                    {c.status === "pass" ? <Check className="h-3.5 w-3.5" /> : c.status === "na" ? "–" : <AlertTriangle className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{c.check}</p><p className="text-xs text-muted-foreground">{c.detail}</p></div>
                  <ToneBadge tone={statusTone(c.status)} className="uppercase">{c.status}</ToneBadge>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard title="Risk heatmap" icon={Grid3x3} info="Entity × risk dimension. Darker cells mean stronger evidence.">
            <FraudHeatmap rows={f.heatmap} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
