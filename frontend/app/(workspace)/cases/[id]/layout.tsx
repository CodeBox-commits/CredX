"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Gavel, Loader2, Play, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";

import { CaseContext } from "@/components/case/case-context";
import { DecisionDialog } from "@/components/case/decision-dialog";
import { JobProgress } from "@/components/common/job-progress";
import { DecisionBadge, RiskBadge, StatusBadge, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, qk, useJobWatcher } from "@/hooks/queries";
import { formatCr, titleCase } from "@/lib/format";
import { scoreTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { CASE_TABS } from "@/layouts/nav";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";

function WatchedJob({ jobId, caseId, onSettled }: { jobId: string; caseId: string; onSettled: (id: string) => void }) {
  const job = useJobWatcher(jobId, caseId, () => setTimeout(() => onSettled(jobId), 2500));
  return job ? <JobProgress job={job} compact={job.kind !== "full_analysis"} /> : null;
}

export default function CaseLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const can = useAuth((s) => s.can);
  const [watched, setWatched] = useState<string[]>([]);
  const [decisionOpen, setDecisionOpen] = useState(false);

  const { data: overview, isLoading, error } = useQuery({
    queryKey: qk.overview(id),
    queryFn: () => api.cases.overview(id),
    refetchInterval: (q) => (q.state.data?.active_jobs.length ? 2500 : false),
  });
  const watchJob = useCallback((jobId: string) => setWatched((w) => (w.includes(jobId) ? w : [...w, jobId])), []);
  const settle = useCallback((jobId: string) => setWatched((w) => w.filter((x) => x !== jobId)), []);
  const jobs = [...new Set([...watched, ...(overview?.active_jobs.map((j) => j.id) ?? [])])];

  const start = async (fn: () => Promise<{ id: string }>, label: string) => {
    try {
      const job = await fn();
      watchJob(job.id);
      toast.message(`${label} started`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (error) return <p className="text-destructive">{errorMessage(error)}</p>;
  const c = overview?.case_record;
  const score = overview?.score;
  const base = `/cases/${id}`;
  const running = jobs.length > 0;

  return (
    <CaseContext.Provider value={{ caseId: id, overview, watchJob }}>
      <div className="mb-5">
        <Link href="/cases" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Cases</Link>
        {isLoading || !c ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold">{c.company.name}</h1>
                <StatusBadge status={c.status} />
                {c.is_demo && <ToneBadge tone="accent">Demo · fictional</ToneBadge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-mono">{c.reference}</span> · {c.facility_type} {formatCr(c.requested_amount)} · {c.tenure_months}m
                {c.company.sector && ` · ${titleCase(c.company.sector)}`}{c.company.gstin && <> · <span className="font-mono">{c.company.gstin}</span></>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {score && (
                <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-2">
                  <div><p className="eyebrow">Score</p><ToneBadge tone={scoreTone(score.credit_score)} className="numeric mt-0.5 text-sm">{score.credit_score} · {score.rating}</ToneBadge></div>
                  <div><p className="eyebrow">Risk</p><div className="mt-0.5"><RiskBadge risk={score.risk_level} /></div></div>
                  <div><p className="eyebrow">Model view</p><div className="mt-0.5"><DecisionBadge decision={score.decision} /></div></div>
                  {c.final_decision && <div><p className="eyebrow">Final</p><div className="mt-0.5"><DecisionBadge decision={c.final_decision} /></div></div>}
                </div>
              )}
              <div className="flex gap-2">
                {can("analyst") && (
                  <Button onClick={() => start(() => api.cases.analyze(id), "Full analysis")} disabled={running || !overview?.facts.documents.length}
                    title={!overview?.facts.documents.length ? "Upload documents first" : undefined}>
                    {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    {score ? "Re-run analysis" : "Run analysis"}
                  </Button>
                )}
                {can("analyst") && score && (
                  <Button variant="outline" onClick={() => start(() => api.cam.generate(id), "CAM generation")} disabled={running}>
                    <ReceiptText className="mr-2 h-4 w-4" /> CAM
                  </Button>
                )}
                {can("credit_manager") && score && (
                  <Button variant="secondary" onClick={() => setDecisionOpen(true)}><Gavel className="mr-2 h-4 w-4" /> Decide</Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
        {jobs.length > 0 && (
          <div className="mt-4 grid gap-2">
            {jobs.map((j) => <WatchedJob key={j} jobId={j} caseId={id} onSettled={settle} />)}
          </div>
        )}
        <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-border scrollbar-thin" aria-label="Case sections">
          {CASE_TABS.map((t) => {
            const href = t.slug ? `${base}/${t.slug}` : base;
            const active = t.slug ? pathname.startsWith(href) : pathname === base;
            return (
              <Link key={t.slug} href={href} aria-current={active ? "page" : undefined}
                className={cn("relative whitespace-nowrap px-3 py-2.5 text-sm text-muted-foreground transition hover:text-foreground", active && "font-medium text-foreground")}>
                {t.label}
                {active && <motion.span layoutId="case-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
      {c && score && <DecisionDialog open={decisionOpen} onOpenChange={setDecisionOpen} caseId={id} suggested={score.decision} />}
    </CaseContext.Provider>
  );
}
