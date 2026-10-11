"use client";

import { animate } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Info, TrendingDown, TrendingUp } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { GrowBar, useMounted } from "./motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { decisionLabel, titleCase } from "@/lib/format";
import { decisionTone, riskTone, scoreTone, statusTone, type Tone, toneClasses, toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ layout
export function PageHeader({ eyebrow, title, description, actions, icon: Icon }: {
  eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode; icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon && (
          <div className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="label mb-1">{eyebrow}</p>}
          <h1 className="text-[26px] font-bold leading-tight md:text-[28px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionCard({ title, eyebrow, actions, children, className, bodyClassName, info, icon: Icon }: {
  title?: ReactNode; eyebrow?: string; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; info?: string; icon?: LucideIcon;
}) {
  return (
    <section className={cn("panel reveal overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-3.5 w-3.5" /></span>}
            <div className="min-w-0">
              {eyebrow && <p className="label">{eyebrow}</p>}
              {title && (
                <h3 className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                  {title}
                  {info && (
                    <Tooltip>
                      <TooltipTrigger aria-label="About this panel" className="text-muted-foreground/70 hover:text-foreground"><Info className="h-3.5 w-3.5" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">{info}</TooltipContent>
                    </Tooltip>
                  )}
                </h3>
              )}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", (title || actions) && "pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ badges
export function ToneBadge({ tone, children, className, dot, pulse }: { tone: Tone; children: ReactNode; className?: string; dot?: boolean; pulse?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4", toneClasses[tone], className)}>
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full" style={{ background: toneHsl[tone] }} />}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: toneHsl[tone] }} />
        </span>
      )}
      {children}
    </span>
  );
}

export const RiskBadge = ({ risk }: { risk?: string | null }) =>
  risk ? <ToneBadge tone={riskTone(risk)} dot>{titleCase(risk.toLowerCase())} risk</ToneBadge> : <ToneBadge tone="muted">Unscored</ToneBadge>;
export const DecisionBadge = ({ decision, className }: { decision?: string | null; className?: string }) => (
  <ToneBadge tone={decisionTone(decision)} className={className}>{decisionLabel(decision)}</ToneBadge>
);
const LIVE = ["running", "ingesting", "analyzing", "processing", "queued"];
export const StatusBadge = ({ status }: { status?: string | null }) => (
  <ToneBadge tone={statusTone(status)} dot pulse={LIVE.includes(status ?? "")}>{titleCase(status)}</ToneBadge>
);

// ------------------------------------------------------------------ numbers
export function AnimatedNumber({ value, format = (v) => Math.round(v).toLocaleString("en-IN") }: { value: number; format?: (v: number) => string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, { duration: 1, ease: [0.16, 1, 0.3, 1], onUpdate: setDisplay });
    // rAF is throttled in background/hidden tabs — a timer guarantees the final value is shown.
    const settle = setTimeout(() => setDisplay(value), 1150);
    return () => {
      controls.stop();
      clearTimeout(settle);
    };
  }, [value]);
  return <span className="tabular">{format(display)}</span>;
}

export function Sparkline({ values, tone = "primary", className }: { values: number[]; tone?: Tone; className?: string }) {
  const id = useId();
  if (values.length < 2) return null;
  const w = 100, h = 32;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-8 w-24 duration-700 animate-in fade-in", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={toneHsl[tone]} stopOpacity={0.25} />
          <stop offset="100%" stopColor={toneHsl[tone]} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={toneHsl[tone]} strokeWidth={1.75} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Delta({ value, suffix = "%", invert = false }: { value: number | null | undefined; suffix?: string; invert?: boolean }) {
  if (value == null || Number.isNaN(value)) return null;
  const good = invert ? value < 0 : value >= 0;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", good ? "text-success" : "text-destructive")}>
      <Icon className="h-3 w-3" />
      {value > 0 ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}

export function MetricCard({ label, value, numeric, format, icon: Icon, hint, tone = "primary", delay = 0, trend, onClick }: {
  label: string; value?: ReactNode; numeric?: number | null; format?: (v: number) => string; icon: LucideIcon; hint?: ReactNode;
  tone?: Tone; delay?: number; trend?: number[]; onClick?: () => void;
}) {
  return (
    <div className="reveal h-full" style={{ animationDelay: `${delay * 1000}ms` }}>
      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(e) => onClick && (e.key === "Enter" || e.key === " ") && onClick()}
        className={cn("relative h-full overflow-hidden p-4", onClick ? "panel-interactive cursor-pointer" : "panel")}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl border", toneClasses[tone])}><Icon className="h-4 w-4" aria-hidden /></span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-2">
          <p className="numeric truncate text-[26px] font-semibold leading-none tracking-tight">
            {numeric !== undefined && numeric !== null ? <AnimatedNumber value={numeric} format={format} /> : (value ?? "—")}
          </p>
          {trend && <Sparkline values={trend} tone={tone} />}
        </div>
        {hint && <div className="mt-2.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ score ring
export function ScoreRing({ score, size = 132, stroke = 10, label = "CredX score", sublabel, min = 300, max = 900 }: {
  score: number | null | undefined; size?: number; stroke?: number; label?: string; sublabel?: ReactNode; min?: number; max?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // 270° gauge
  const frac = score == null ? 0 : Math.max(0, Math.min(1, (score - min) / (max - min)));
  const tone = scoreTone(score);
  const mounted = useMounted();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score ?? "not scored"}`}>
      <svg width={size} height={size} className="rotate-[135deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * arc} ${c}`} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={toneHsl[tone]} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${mounted ? c * arc * frac : 0} ${c}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1)", filter: `drop-shadow(0 0 6px ${toneHsl[tone].replace(")", " / 0.35)")})` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="numeric text-[28px] font-bold leading-none" style={{ fontSize: size * 0.22 }}>
          {score == null ? "—" : <AnimatedNumber value={score} />}
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        {sublabel && <span className="mt-0.5 text-[11px] font-semibold" style={{ color: toneHsl[tone] }}>{sublabel}</span>}
      </div>
    </div>
  );
}

export function MeterBar({ value, max = 100, tone, className, showLabel = true }: { value: number; max?: number; tone?: Tone; className?: string; showLabel?: boolean }) {
  const frac = Math.max(0, Math.min(1, value / max));
  const t = tone ?? (frac >= 0.75 ? "destructive" : frac >= 0.5 ? "warning" : frac >= 0.25 ? "primary" : "success");
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <GrowBar pct={frac * 100} className="rounded-full" style={{ background: toneHsl[t] }} />
      </div>
      {showLabel && <span className="numeric w-8 text-right text-[11px] text-muted-foreground">{Math.round(value)}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ states
export function EmptyState({ icon: Icon, title, description, action, compact }: { icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-2/50 px-6 text-center", compact ? "py-8" : "py-14")}>
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-surface text-primary shadow-sm"><Icon className="h-5 w-5" /></div>
      </div>
      <p className="font-display text-base font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function CardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)}
    </div>
  );
}

export function BlockSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-64 w-full rounded-2xl", className)} />;
}

export function ConfidenceBar({ value, className }: { value: number | null | undefined; className?: string }) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  const tone: Tone = v >= 0.85 ? "success" : v >= 0.65 ? "warning" : "destructive";
  return (
    <div className={cn("flex items-center gap-2", className)} aria-label={`Confidence ${Math.round(v * 100)}%`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <GrowBar pct={v * 100} className="rounded-full" style={{ background: toneHsl[tone] }} />
      </div>
      <span className="numeric text-[11px] text-muted-foreground">{Math.round(v * 100)}%</span>
    </div>
  );
}

export function Stat({ label, value, sub, className, tone }: { label: string; value: ReactNode; sub?: ReactNode; className?: string; tone?: Tone }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="numeric mt-1 truncate text-lg font-semibold" style={tone ? { color: toneHsl[tone] } : undefined}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export { decisionTone, riskTone, statusTone };
