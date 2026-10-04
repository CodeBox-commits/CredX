"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { decisionLabel, titleCase } from "@/lib/format";
import { decisionTone, riskTone, statusTone, type Tone, toneClasses, toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold md:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionCard({ title, eyebrow, actions, children, className, bodyClassName, info }: {
  title?: ReactNode; eyebrow?: string; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; info?: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-border/70 bg-card/90 shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3.5">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (
              <h3 className="flex items-center gap-1.5 text-[15px] font-semibold">
                {title}
                {info && (
                  <Tooltip>
                    <TooltipTrigger aria-label="About this panel"><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">{info}</TooltipContent>
                  </Tooltip>
                )}
              </h3>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function ToneBadge({ tone, children, className, dot }: { tone: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", toneClasses[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneHsl[tone] }} />}
      {children}
    </span>
  );
}

export const RiskBadge = ({ risk }: { risk?: string | null }) =>
  risk ? <ToneBadge tone={riskTone(risk)} dot>{risk}</ToneBadge> : <ToneBadge tone="muted">Unscored</ToneBadge>;
export const DecisionBadge = ({ decision }: { decision?: string | null }) => <ToneBadge tone={decisionTone(decision)}>{decisionLabel(decision)}</ToneBadge>;
export const StatusBadge = ({ status }: { status?: string | null }) => (
  <ToneBadge tone={statusTone(status)} dot className={cn(["running", "ingesting", "analyzing", "processing"].includes(status ?? "") && "[&>span]:animate-pulse-dot")}>
    {titleCase(status)}
  </ToneBadge>
);

export function AnimatedNumber({ value, format = (v) => Math.round(v).toLocaleString("en-IN") }: { value: number; format?: (v: number) => string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    // Background tabs pause rAF and reduced-motion users opt out: show the real value immediately.
    if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span>{text}</motion.span>;
}

export function MetricCard({ label, value, numeric, format, icon: Icon, hint, tone = "primary", delay = 0 }: {
  label: string; value?: ReactNode; numeric?: number | null; format?: (v: number) => string; icon: LucideIcon; hint?: ReactNode; tone?: Tone; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }}>
      <Card className="card-hover relative h-full overflow-hidden border-border/70 p-4">
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.12] blur-2xl" style={{ background: toneHsl[tone] }} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{label}</p>
            <p className="numeric mt-2 truncate text-2xl font-semibold leading-none">
              {numeric !== undefined && numeric !== null ? <AnimatedNumber value={numeric} format={format} /> : (value ?? "—")}
            </p>
            {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
          </div>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", toneClasses[tone])}>
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <p className="font-display text-base font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function CardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
    </div>
  );
}

export function BlockSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-64 w-full rounded-xl", className)} />;
}

export function ConfidenceBar({ value, className }: { value: number | null | undefined; className?: string }) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  const tone: Tone = v >= 0.85 ? "success" : v >= 0.65 ? "warning" : "destructive";
  return (
    <div className={cn("flex items-center gap-2", className)} aria-label={`Confidence ${Math.round(v * 100)}%`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <motion.div className="h-full rounded-full" style={{ background: toneHsl[tone] }} initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} />
      </div>
      <span className="numeric text-[11px] text-muted-foreground">{Math.round(v * 100)}%</span>
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow">{label}</p>
      <p className="numeric mt-1 truncate text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
