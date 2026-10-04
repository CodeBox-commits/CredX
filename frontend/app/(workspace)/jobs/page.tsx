"use client";

import { Activity } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { JobProgress } from "@/components/common/job-progress";
import { EmptyState, MetricCard, PageHeader, SectionCard, StatusBadge } from "@/components/common/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { jobLabel, useJobs } from "@/hooks/queries";
import { relativeTime } from "@/lib/format";

export default function JobsPage() {
  const [status, setStatus] = useState("all");
  const { data: jobs, isLoading } = useJobs(status === "all" ? {} : { status });
  const active = jobs?.filter((j) => j.status === "running" || j.status === "queued") ?? [];
  const done = jobs?.filter((j) => j.status === "succeeded") ?? [];
  const failed = jobs?.filter((j) => j.status === "failed") ?? [];
  const avg = done.length ? done.reduce((s, j) => s + (j.duration_ms ?? 0), 0) / done.length / 1000 : null;
  return (
    <>
      <PageHeader eyebrow="Async pipelines" title="Job monitor" description="OCR, ingestion, research crawling, fraud analysis, scoring and CAM generation run as background jobs (Celery + Redis in production, an in-process pool in demo mode)." />
      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <MetricCard label="Active" numeric={active.length} icon={Activity} tone="primary" />
        <MetricCard label="Succeeded" numeric={done.length} icon={Activity} tone="success" />
        <MetricCard label="Failed" numeric={failed.length} icon={Activity} tone={failed.length ? "destructive" : "muted"} />
        <MetricCard label="Avg duration" value={avg ? `${avg.toFixed(1)}s` : "—"} icon={Activity} tone="accent" />
      </div>
      {active.length > 0 && <div className="mb-5 grid gap-2">{active.map((j) => <JobProgress key={j.id} job={j} />)}</div>}
      <SectionCard title="Recent jobs" bodyClassName="p-0" actions={
        <ToggleGroup type="single" value={status} onValueChange={(v) => v && setStatus(v)} aria-label="Filter jobs">
          {["all", "running", "succeeded", "failed"].map((s) => <ToggleGroupItem key={s} value={s} size="sm" className="h-7 text-xs capitalize">{s}</ToggleGroupItem>)}
        </ToggleGroup>
      }>
        {isLoading ? <Skeleton className="m-5 h-40" /> : !jobs?.length ? <div className="p-5"><EmptyState icon={Activity} title="No jobs yet" /></div> : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-2">Job</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Stage</th><th className="px-4 py-2">Backend</th><th className="px-4 py-2 text-right">Duration</th><th className="px-4 py-2 text-right">Started</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="px-4 py-2">{j.case_id ? <Link className="hover:underline" href={`/cases/${j.case_id}`}>{jobLabel(j.kind)}</Link> : jobLabel(j.kind)}<p className="font-mono text-[10px] text-muted-foreground">{j.id.slice(0, 8)}{j.attempts > 1 && ` · ${j.attempts} attempts`}</p></td>
                    <td className="px-4 py-2"><StatusBadge status={j.status} /></td>
                    <td className="max-w-[280px] truncate px-4 py-2 text-xs text-muted-foreground" title={j.error ?? j.message ?? ""}>{j.error ?? j.message}</td>
                    <td className="px-4 py-2 font-mono text-xs">{j.backend}</td>
                    <td className="numeric px-4 py-2 text-right">{j.duration_ms ? `${(j.duration_ms / 1000).toFixed(1)}s` : "—"}</td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">{relativeTime(j.started_at ?? j.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
