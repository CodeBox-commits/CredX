"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";

import { jobLabel } from "@/hooks/queries";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Job } from "@/types/api";

export function JobProgress({ job, compact = false }: { job: Job; compact?: boolean }) {
  const done = job.status === "succeeded";
  const failed = job.status === "failed";
  return (
    <div className={cn("rounded-xl border bg-card/80 p-3", failed ? "border-destructive/40" : done ? "border-success/40" : "border-primary/30")}>
      <div className="flex items-center gap-2 text-sm">
        {failed ? <XCircle className="h-4 w-4 text-destructive" /> : done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        <span className="font-medium">{jobLabel(job.kind)}</span>
        <span className="truncate text-muted-foreground">· {failed ? job.error : job.message ?? titleCase(job.stage)}</span>
        <span className="numeric ml-auto text-xs text-muted-foreground">{job.progress}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className={cn("h-full rounded-full", failed ? "bg-destructive" : done ? "bg-success" : "bg-primary")}
          animate={{ width: `${Math.max(job.progress, 3)}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </div>
      {!compact && job.steps?.length > 0 && (
        <ol className="mt-3 grid gap-1.5 sm:grid-cols-4">
          <AnimatePresence initial={false}>
            {job.steps.map((s) => (
              <motion.li key={s.key} layout className="flex items-center gap-1.5 text-xs">
                {s.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : s.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className={cn(s.status === "pending" && "text-muted-foreground")}>{s.label}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}
