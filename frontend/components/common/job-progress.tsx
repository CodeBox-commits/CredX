"use client";

import { motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";

import { GrowBar } from "@/components/common/motion";
import { jobLabel } from "@/hooks/queries";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Job } from "@/types/api";

/** Live pipeline tracker: connected step nodes with an animated progress rail. */
export function JobProgress({ job, compact = false }: { job: Job; compact?: boolean }) {
  const done = job.status === "succeeded";
  const failed = job.status === "failed";
  const steps = job.steps ?? [];
  return (
    <motion.div layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className={cn("relative overflow-hidden rounded-2xl border bg-card p-4", failed ? "border-destructive/40" : done ? "border-success/40" : "border-primary/25")}>
      {!done && !failed && <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/[0.04] via-transparent to-accent/[0.04]" />}
      <div className="relative flex items-center gap-2.5 text-sm">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", failed ? "bg-destructive/12 text-destructive" : done ? "bg-success/12 text-success" : "bg-primary/12 text-primary")}>
          {failed ? <X className="h-3.5 w-3.5" /> : done ? <Check className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </span>
        <span className="font-semibold">{jobLabel(job.kind)}</span>
        <span className="truncate text-muted-foreground">{failed ? job.error : done ? "Completed" : job.message ?? titleCase(job.stage)}</span>
        <span className="numeric ml-auto text-xs font-semibold text-muted-foreground">{job.progress}%</span>
      </div>

      {compact || steps.length < 2 ? (
        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100}>
          <GrowBar pct={Math.max(job.progress, 3)} duration={500} className={cn("rounded-full", failed ? "bg-destructive" : done ? "bg-success" : "bg-gradient-to-r from-primary to-accent")} />
        </div>
      ) : (
        <div role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${jobLabel(job.kind)} progress`}>
        <ol className="relative mt-4 flex items-start" aria-label="Pipeline steps">
          {steps.map((s, i) => {
            const state = done ? "done" : s.status;
            return (
              <li key={s.key} className="relative flex flex-1 flex-col items-center text-center">
                {i > 0 && (
                  <div className="absolute right-1/2 top-3 -z-0 h-0.5 w-full bg-muted">
                    <GrowBar pct={state === "pending" ? 0 : 100} duration={500} className="bg-primary" />
                  </div>
                )}
                <span className={cn("relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-card text-[10px] transition-colors",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "running" && "border-primary text-primary",
                  state === "pending" && "border-border text-muted-foreground")}>
                  {state === "done" ? <Check className="h-3 w-3" /> : state === "running" ? <span className="h-2 w-2 animate-pulse-dot rounded-full bg-primary" /> : i + 1}
                </span>
                <span className={cn("mt-1.5 px-1 text-[11px] leading-tight", state === "pending" ? "text-muted-foreground" : "font-medium")}>{s.label}</span>
              </li>
            );
          })}
        </ol>
        </div>
      )}
    </motion.div>
  );
}
