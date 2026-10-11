"use client";

import { motion } from "framer-motion";
import { Activity, CheckCircle2, Clock3, FileSearch, Gauge, Network, Radar, ReceiptText, Workflow, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { JobProgress } from "@/components/common/job-progress";
import { EmptyState, MetricCard, PageHeader, SectionCard, StatusBadge } from "@/components/common/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { jobLabel, useJobs } from "@/hooks/queries";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Job } from "@/types/api";

const KIND_ICON: Record<Job["kind"], typeof Activity> = {
  ingest_document: FileSearch, research: Radar, fraud: Network, score: Gauge, cam: ReceiptText, full_analysis: Workflow,
};
const FILTERS = [{ v: "all", l: "All" }, { v: "running", l: "Running" }, { v: "succeeded", l: "Succeeded" }, { v: "failed", l: "Failed" }];

export default function JobsPage() {
  const [status, setStatus] = useState("all");
  const { data: jobs, isLoading } = useJobs(status === "all" ? {} : { status });
  const active = jobs?.filter((j) => j.status === "running" || j.status === "queued") ?? [];
  const done = jobs?.filter((j) => j.status === "succeeded") ?? [];
  const failed = jobs?.filter((j) => j.status === "failed") ?? [];
  const avg = done.length ? done.reduce((s, j) => s + (j.duration_ms ?? 0), 0) / done.length / 1000 : null;
  return (
    <>
      <PageHeader icon={Workflow} title="Pipelines"
        description="OCR, extraction, research crawling, fraud analysis, scoring and CAM generation run as background jobs — Celery + Redis in production, a thread pool locally." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Running now" numeric={active.length} icon={Activity} tone="primary" />
        <MetricCard label="Succeeded" numeric={done.length} icon={CheckCircle2} tone="success" delay={0.05} />
        <MetricCard label="Failed" numeric={failed.length} icon={XCircle} tone={failed.length ? "destructive" : "muted"} delay={0.1} />
        <MetricCard label="Average duration" value={avg ? `${avg.toFixed(1)}s` : "—"} icon={Clock3} tone="accent" delay={0.15} />
      </div>
      {active.length > 0 && <div className="mb-6 grid gap-3">{active.map((j) => <JobProgress key={j.id} job={j} />)}</div>}
      <SectionCard title="Job history" icon={Activity} bodyClassName="p-0" actions={
        <div className="flex rounded-lg border border-border p-0.5">
          {FILTERS.map((f) => (
            <button key={f.v} onClick={() => setStatus(f.v)} className={cn("relative rounded-md px-2.5 py-1 text-xs font-medium transition", status === f.v ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {status === f.v && <motion.span layoutId="jobs-filter" className="absolute inset-0 rounded-md bg-muted" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
              <span className="relative">{f.l}</span>
            </button>
          ))}
        </div>
      }>
        {isLoading ? <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div> : !jobs?.length ? (
          <div className="p-5"><EmptyState icon={Activity} title="No jobs yet" description="Upload documents or run an analysis to see pipeline activity here." /></div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border/70 text-left text-xs text-muted-foreground">
                <tr><th className="px-5 py-3 font-medium">Job</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Stage</th><th className="px-4 py-3 font-medium">Backend</th><th className="px-4 py-3 text-right font-medium">Duration</th><th className="px-5 py-3 text-right font-medium">Started</th></tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {jobs.map((j) => {
                  const Icon = KIND_ICON[j.kind] ?? Activity;
                  return (
                    <tr key={j.id} className="transition hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
                          <div>
                            {j.case_id ? <Link className="font-medium hover:text-primary" href={`/cases/${j.case_id}`}>{jobLabel(j.kind)}</Link> : <span className="font-medium">{jobLabel(j.kind)}</span>}
                            <p className="font-mono text-[10px] text-muted-foreground">{j.id.slice(0, 12)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={j.status} /></td>
                      <td className="max-w-[280px] truncate px-4 py-3 text-xs text-muted-foreground" title={j.error ?? j.message ?? ""}>{j.error ?? j.message}</td>
                      <td className="px-4 py-3 font-mono text-xs">{j.backend}</td>
                      <td className="numeric px-4 py-3 text-right">{j.duration_ms ? `${(j.duration_ms / 1000).toFixed(1)}s` : j.status === "running" ? `${j.progress}%` : "—"}</td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground">{relativeTime(j.started_at ?? j.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
