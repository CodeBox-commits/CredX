"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, FileUp, Gavel, Loader2, Play, ReceiptText, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useCaseContext } from "@/components/case/case-context";
import { GrowBar } from "@/components/common/motion";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/hooks/queries";
import { relativeTime } from "@/lib/format";
import { toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { stageStates } from "@/layouts/nav";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";
import type { CaseOverview, Score } from "@/types/api";

export function Onboarding({ overview, caseId }: { overview: CaseOverview; caseId: string }) {
  const { watchJob } = useCaseContext();
  const can = useAuth((s) => s.can);
  const [busy, setBusy] = useState(false);
  const hasDocs = overview.facts.documents.length > 0;
  const analysing = overview.active_jobs.some((j) => j.kind === "full_analysis");
  const run = async () => {
    setBusy(true);
    try {
      const job = await api.cases.analyze(caseId);
      watchJob(job.id);
      toast.message("Full analysis started", { description: "Research, fraud graph, scoring and a CAM draft run as one pipeline." });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const steps = [
    { icon: FileUp, title: "Upload the document pack", text: "Annual report, GST returns (1/3B/2A), bank statement, sanction letter, MCA and legal notices.", done: hasDocs, active: !hasDocs,
      action: <Button asChild><Link href={`/cases/${caseId}/documents`}><FileUp /> Upload documents</Link></Button> },
    { icon: Play, title: "Run the AI analysis", text: "Extraction, secondary research, fraud graph, explainable scoring and a CAM draft — in about a minute.", done: false, active: hasDocs,
      action: can("analyst") && <Button onClick={run} disabled={busy || analysing || !hasDocs}>{busy || analysing ? <Loader2 className="animate-spin" /> : <Play />} {analysing ? "Analysing…" : "Run full analysis"}</Button> },
    { icon: Gavel, title: "Review, decide & export", text: "Inspect SHAP drivers, add field notes, record the decision and export the CAM.", done: false, active: false, action: null },
  ];
  return (
    <div className="panel relative overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">
        <p className="label">Getting started</p>
        <h2 className="mt-1 text-xl font-bold">Three steps from documents to a decision</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.li key={s.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={cn("relative rounded-2xl border p-5 transition", s.active ? "border-primary/40 bg-primary/[0.04] shadow-[0_12px_30px_-20px_hsl(var(--primary)/0.6)]" : "border-border bg-surface")}>
              <div className="flex items-center justify-between">
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", s.done ? "bg-success/12 text-success" : s.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {s.done ? <CheckCircle2 className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                </span>
                <span className="numeric text-xs text-muted-foreground">Step {i + 1}</span>
              </div>
              <p className="mt-4 font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              {s.active && s.action && <div className="mt-4">{s.action}</div>}
              {s.done && <p className="mt-4 text-sm font-medium text-success">{overview.facts.documents.length} document(s) ingested</p>}
            </motion.li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function NextStep({ overview, caseId }: { overview: CaseOverview; caseId: string }) {
  const states = stageStates(overview);
  const c = overview.case_record;
  const item =
    states.intelligence === "attention" && !c.final_decision
      ? { icon: ShieldAlert, tone: "destructive" as const, title: "Review the fraud graph before deciding", text: `Fraud score ${overview.fraud?.fraud_score}/100 — ${overview.fraud?.alerts.length ?? 0} alert(s) need a forensic look.`, href: `/cases/${caseId}/fraud`, cta: "Open fraud graph" }
      : states.decision === "ready"
        ? { icon: Gavel, tone: "primary" as const, title: "Ready for a credit decision", text: "Check the drivers, policy rules and pricing, then record the decision or escalate.", href: `/cases/${caseId}/decision`, cta: "Review decision" }
        : states.cam === "ready"
          ? { icon: ReceiptText, tone: "primary" as const, title: "Generate the credit appraisal memo", text: "A committee-ready CAM with Five Cs, fraud observations and pricing.", href: `/cases/${caseId}/cam`, cta: "Open CAM" }
          : { icon: CheckCircle2, tone: "success" as const, title: "This case is complete", text: c.final_decision ? `Final decision recorded ${relativeTime(c.decided_at)}.` : "All stages are done.", href: `/cases/${caseId}/cam`, cta: "View CAM" };
  return (
    <Link href={item.href} className="panel-interactive group flex items-center gap-4 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: toneHsl[item.tone].replace(")", " / 0.12)"), color: toneHsl[item.tone] }}>
        <item.icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="label">Next step</span>
        <span className="block font-semibold">{item.title}</span>
        <span className="block truncate text-sm text-muted-foreground">{item.text}</span>
      </span>
      <span className="hidden items-center gap-1 text-sm font-medium text-primary sm:flex">{item.cta}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
    </Link>
  );
}

export function Drivers({ score }: { score: Score }) {
  const items = score.contributions.filter((c) => !c.missing && c.points !== 0).slice(0, 7);
  const max = Math.max(...items.map((i) => Math.abs(i.points)), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((c, i) => {
        const pos = c.points > 0;
        const w = (Math.abs(c.points) / max) * 50;
        return (
          <li key={c.feature} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_44px] items-center gap-3 text-[13px]">
            <span className="truncate" title={c.description}>{c.label} <span className="text-muted-foreground">· {c.display_value}</span></span>
            <div className="relative h-5">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div className={cn("absolute inset-y-0.5 w-1/2", pos ? "left-1/2" : "right-1/2 flex justify-end")}>
                <GrowBar pct={w * 2} delay={i * 50} className={cn("rounded", pos ? "bg-success/80" : "bg-destructive/80")} />
              </div>
            </div>
            <span className={cn("numeric text-right font-semibold", pos ? "text-success" : "text-destructive")}>{pos ? "+" : ""}{c.points}</span>
          </li>
        );
      })}
    </ul>
  );
}
