"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, Check, Copy, FileUp, Gavel, Loader2, MoreHorizontal, Play, Radar, ReceiptText, RefreshCw, ShieldAlert, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";

import { CaseContext } from "@/components/case/case-context";
import { DecisionDialog } from "@/components/decision/decision-dialog";
import { JobProgress } from "@/components/common/job-progress";
import { DecisionBadge, ScoreRing, StatusBadge, ToneBadge } from "@/components/common/primitives";
import { CopilotChat } from "@/components/copilot/copilot-chat";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage, qk, useJobWatcher } from "@/hooks/queries";
import { formatCr, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CASE_EXTRA, CASE_STAGES, type StageState, stageStates } from "@/layouts/nav";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";

function WatchedJob({ jobId, caseId, onSettled }: { jobId: string; caseId: string; onSettled: (id: string) => void }) {
  const job = useJobWatcher(jobId, caseId, () => setTimeout(() => onSettled(jobId), 2200));
  return job ? <JobProgress job={job} compact={job.kind !== "full_analysis"} /> : null;
}

const STATE_STYLE: Record<StageState, string> = {
  done: "border-success bg-success text-success-foreground",
  active: "border-primary bg-surface text-primary",
  ready: "border-primary/40 bg-primary/10 text-primary",
  blocked: "border-border bg-muted text-muted-foreground",
  attention: "border-warning bg-warning text-warning-foreground",
};
const STATE_HINT: Record<StageState, string> = {
  done: "Complete", active: "In progress", ready: "Ready — next up", blocked: "Waiting on an earlier stage", attention: "Complete — needs attention",
};

function CopyChip({ value, label }: { value: string; label: string }) {
  return (
    <button onClick={() => { navigator.clipboard?.writeText(value); toast.success(`${label} copied`); }}
      className="group inline-flex items-center gap-1 rounded-md px-1 font-mono text-[12px] text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={`Copy ${label}`}>
      {value}<Copy className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}

export default function CaseLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const can = useAuth((s) => s.can);
  const [watched, setWatched] = useState<string[]>([]);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const { data: overview, isLoading, error } = useQuery({
    queryKey: qk.overview(id),
    queryFn: () => api.cases.overview(id),
    refetchInterval: (q) => (q.state.data?.active_jobs.length ? 2000 : false),
  });
  const watchJob = useCallback((jobId: string) => setWatched((w) => (w.includes(jobId) ? w : [...w, jobId])), []);
  const settle = useCallback((jobId: string) => setWatched((w) => w.filter((x) => x !== jobId)), []);
  const jobs = [...new Set([...watched, ...(overview?.active_jobs.map((j) => j.id) ?? [])])];

  const start = async (fn: () => Promise<{ id: string }>, label: string) => {
    try {
      const job = await fn();
      watchJob(job.id);
      toast.message(`${label} started`, { description: "Runs in the background — keep working." });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (error) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-10 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="font-medium">{errorMessage(error)}</p>
        <Button variant="outline" asChild><Link href="/cases"><ArrowLeft /> Back to cases</Link></Button>
      </div>
    );
  }

  const c = overview?.case_record;
  const score = overview?.score;
  const base = `/cases/${id}`;
  const running = jobs.length > 0;
  const states = stageStates(overview);
  const hasDocs = !!overview?.facts.documents.length;
  const seg = pathname.slice(base.length).split("/")[1] ?? "";
  const inIntel = seg === "research" || seg === "fraud";

  // One obvious next action, derived from where the case is in its lifecycle.
  let primary: { label: string; icon: typeof Play; onClick: () => void; disabled?: boolean } | null = null;
  if (overview && can("analyst")) {
    if (!hasDocs) primary = { label: "Upload documents", icon: FileUp, onClick: () => router.push(`${base}/documents`) };
    else if (!score) primary = { label: "Run full analysis", icon: Play, onClick: () => start(() => api.cases.analyze(id), "Full analysis"), disabled: running };
    else if (!c?.final_decision && can("credit_manager")) primary = { label: "Record decision", icon: Gavel, onClick: () => setDecisionOpen(true) };
    else if (!overview.latest_cam_version) primary = { label: "Generate CAM", icon: ReceiptText, onClick: () => start(() => api.cam.generate(id), "CAM generation"), disabled: running };
    else primary = { label: "Open CAM", icon: ReceiptText, onClick: () => router.push(`${base}/cam`) };
  }

  return (
    <CaseContext.Provider value={{ caseId: id, overview, watchJob, openCopilot: () => setCopilotOpen(true) }}>
      <div className="mb-6 space-y-4">
        {isLoading || !c ? (
          <Skeleton className="h-[164px] w-full rounded-2xl" />
        ) : (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("panel relative overflow-hidden transition-shadow", running && "ring-running shadow-[0_16px_40px_-24px_hsl(var(--primary)/0.6)]")}>
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent font-display text-lg font-bold text-white shadow-lg shadow-primary/20 sm:flex">
                  {c.company.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-[22px] font-bold leading-tight md:text-2xl">{c.company.name}</h1>
                    <StatusBadge status={c.status} />
                    {c.priority === "HIGH" && <ToneBadge tone="warning">High priority</ToneBadge>}
                    {c.is_demo && <ToneBadge tone="accent">Demo · fictional</ToneBadge>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                    <span className="font-mono">{c.reference}</span>
                    <span className="h-1 w-1 rounded-full bg-border" />
                    <span><b className="font-semibold text-foreground">{formatCr(c.requested_amount)}</b> {c.facility_type} · {c.tenure_months}m</span>
                    {c.company.sector && <><span className="h-1 w-1 rounded-full bg-border" /><span>{titleCase(c.company.sector)}</span></>}
                    {c.company.city && <><span className="h-1 w-1 rounded-full bg-border" /><span>{c.company.city}</span></>}
                    {c.company.gstin && <><span className="h-1 w-1 rounded-full bg-border" /><CopyChip value={c.company.gstin} label="GSTIN" /></>}
                  </div>
                  {c.purpose && <p className="mt-2 line-clamp-1 max-w-2xl text-[13px] text-muted-foreground">{c.purpose}</p>}
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div className="flex items-center gap-4">
                  <ScoreRing score={score?.credit_score} size={92} stroke={8} label="Score" sublabel={score?.rating} />
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">{c.final_decision ? "Final decision" : "Recommendation"}</p>
                    {score || c.final_decision ? <DecisionBadge decision={c.final_decision ?? score?.decision} className="text-xs" /> : <ToneBadge tone="muted">Not scored</ToneBadge>}
                    {score && <p className="numeric text-xs text-muted-foreground">PD {(score.probability_of_default * 100).toFixed(2)}% · {score.suggested_rate.toFixed(2)}%</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative flex flex-wrap items-center gap-2 border-t border-border/70 bg-surface-2/60 px-5 py-3 md:px-6">
              {primary && (
                <Button onClick={primary.onClick} disabled={primary.disabled}>
                  {primary.disabled ? <Loader2 className="animate-spin" /> : <primary.icon />} {primary.label}
                </Button>
              )}
              <Button variant="outline" onClick={() => setCopilotOpen(true)}><Sparkles className="text-primary" /> Ask copilot</Button>
              {can("analyst") && hasDocs && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem disabled={running} onClick={() => start(() => api.cases.analyze(id), "Full analysis")}><RefreshCw className="mr-2 h-4 w-4" /> Re-run full analysis</DropdownMenuItem>
                    <DropdownMenuItem disabled={running || !score} onClick={() => start(() => api.cases.rescore(id), "Re-scoring")}><Gavel className="mr-2 h-4 w-4" /> Re-score only</DropdownMenuItem>
                    <DropdownMenuItem disabled={running} onClick={() => start(() => api.cases.research(id), "Research")}><Radar className="mr-2 h-4 w-4" /> Refresh research</DropdownMenuItem>
                    <DropdownMenuItem disabled={running} onClick={() => start(() => api.cases.fraud(id), "Fraud analysis")}><ShieldAlert className="mr-2 h-4 w-4" /> Re-run fraud graph</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={running || !score} onClick={() => start(() => api.cam.generate(id), "CAM generation")}><ReceiptText className="mr-2 h-4 w-4" /> Generate new CAM version</DropdownMenuItem>
                    {can("credit_manager") && score && <DropdownMenuItem onClick={() => setDecisionOpen(true)}><Gavel className="mr-2 h-4 w-4" /> Record final decision</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Link href="/cases" className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"><ArrowLeft className="h-3.5 w-3.5" /> All cases</Link>
            </div>
          </motion.section>
        )}

        {jobs.length > 0 && <div className="grid gap-3">{jobs.map((j) => <WatchedJob key={j} jobId={j} caseId={id} onSettled={settle} />)}</div>}

        {/* Stage stepper */}
        <nav aria-label="Case stages" className="panel flex items-stretch overflow-x-auto p-1.5 scrollbar-none">
          {CASE_EXTRA.slice(0, 1).map((x) => {
            const active = pathname === base;
            return (
              <Link key="overview" href={base} aria-current={active ? "page" : undefined}
                className={cn("relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground", active && "text-foreground")}>
                {active && <motion.span layoutId="stage-active" className="absolute inset-0 rounded-xl bg-muted" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                <x.icon className="relative h-4 w-4" /><span className="relative">{x.label}</span>
              </Link>
            );
          })}
          <div className="mx-1 my-2 w-px shrink-0 bg-border" />
          {CASE_STAGES.map((s, i) => {
            const st = states[s.key];
            const active = s.slugs.includes(seg);
            return (
              <Tooltip key={s.key}>
                <TooltipTrigger asChild>
                  <Link href={`${base}/${s.slugs[0]}`} aria-current={active ? "page" : undefined}
                    className={cn("group relative flex min-w-[124px] flex-1 shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 transition", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {active && <motion.span layoutId="stage-active" className="absolute inset-0 rounded-xl bg-muted" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                    <span className={cn("relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition", STATE_STYLE[st])}>
                      {st === "done" ? <Check className="h-3.5 w-3.5" /> : st === "active" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : st === "attention" ? <AlertTriangle className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className="relative min-w-0 leading-tight">
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="hidden truncate text-[11px] text-muted-foreground 2xl:block">{s.description}</span>
                    </span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{STATE_HINT[st]}</TooltipContent>
              </Tooltip>
            );
          })}
          <div className="mx-1 my-2 w-px shrink-0 bg-border" />
          {CASE_EXTRA.slice(1).map((x) => {
            const active = seg === x.slug;
            return (
              <Link key={x.slug} href={`${base}/${x.slug}`} aria-current={active ? "page" : undefined}
                className={cn("relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground", active && "text-foreground")}>
                {active && <motion.span layoutId="stage-active" className="absolute inset-0 rounded-xl bg-muted" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                <x.icon className="relative h-4 w-4" /><span className="relative">{x.label}</span>
                {!!overview?.notes.length && <span className="numeric relative rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">{overview.notes.length}</span>}
              </Link>
            );
          })}
        </nav>

        {inIntel && (
          <div className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-sm">
            {[{ slug: "research", label: "Research intelligence" }, { slug: "fraud", label: "Fraud graph" }].map((t) => (
              <Link key={t.slug} href={`${base}/${t.slug}`} className={cn("relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition", seg === t.slug ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {seg === t.slug && <motion.span layoutId="intel-tab" className="absolute inset-0 rounded-lg bg-primary" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                <span className="relative">{t.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <motion.div key={seg} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {children}
      </motion.div>

      <Sheet open={copilotOpen} onOpenChange={setCopilotOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-[520px]">
          <SheetTitle className="sr-only">CredX Copilot</SheetTitle>
          <CopilotChat caseId={id} variant="panel" companyName={c?.company.name} />
        </SheetContent>
      </Sheet>
      {c && score && <DecisionDialog open={decisionOpen} onOpenChange={setDecisionOpen} caseId={id} suggested={score.decision} />}
    </CaseContext.Provider>
  );
}
