"use client";

import { Activity, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";

import { titleCase } from "@/lib/format";
import { scoreTone, severityTone, toneHsl } from "@/lib/tones";
import type { AuditEntry, DashboardSummary } from "@/types/api";

interface TickerItem {
  key: string;
  href: string;
  icon: typeof Activity;
  colour: string;
  text: string;
  meta?: string;
}

/** Bloomberg-style scrolling strip of portfolio events. CSS-animated; pauses on hover. */
export function LiveTicker({ data, activity }: { data?: DashboardSummary; activity?: AuditEntry[] }) {
  if (!data) return null;
  const items: TickerItem[] = [
    ...data.score_distribution.map((p) => {
      const caseId = data.recent_cases.find((c) => c.reference === p.reference)?.id;
      return {
        key: `s-${p.reference}`, href: caseId ? `/cases/${caseId}` : "/cases",
        icon: p.score >= 700 ? TrendingUp : TrendingDown, colour: toneHsl[scoreTone(p.score)],
        text: `${p.company.replace(/ (Private )?Limited$/, "")} ${p.score}`, meta: p.risk.toLowerCase(),
      };
    }),
    ...data.alerts.slice(0, 4).map((a) => ({
      key: `a-${a.id}`, href: `/cases/${a.case_id}/fraud`, icon: ShieldAlert, colour: toneHsl[severityTone(a.severity)],
      text: a.title.length > 60 ? `${a.title.slice(0, 58)}…` : a.title, meta: a.company.replace(/ (Private )?Limited$/, ""),
    })),
    ...(activity ?? []).slice(0, 5).map((e) => ({
      key: `e-${e.id}`, href: e.case_id ? `/cases/${e.case_id}` : "/dashboard", icon: Activity, colour: "hsl(var(--muted-foreground))",
      text: (e.summary ?? titleCase(e.action)).slice(0, 70), meta: e.actor_email?.split("@")[0] ?? "system",
    })),
  ];
  if (!items.length) return null;
  const loop = [...items, ...items];
  return (
    <div className="panel relative flex items-center overflow-hidden py-2.5" aria-label="Live portfolio feed">
      <span className="z-10 flex shrink-0 items-center gap-1.5 border-r border-border bg-card pl-4 pr-3 text-[11px] font-semibold uppercase tracking-wider text-success">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-success" /><span className="relative h-2 w-2 rounded-full bg-success" /></span>
        Live
      </span>
      <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
        <div className="animate-ticker flex w-max items-center">
          {loop.map((it, i) => (
            <Link key={`${it.key}-${i}`} href={it.href} className="flex shrink-0 items-center gap-2 px-5 text-[13px] transition-colors hover:text-primary" tabIndex={i >= items.length ? -1 : 0} aria-hidden={i >= items.length}>
              <it.icon className="h-3.5 w-3.5" style={{ color: it.colour }} />
              <span className="numeric font-medium">{it.text}</span>
              {it.meta && <span className="text-xs text-muted-foreground">{it.meta}</span>}
              <span className="ml-3 h-1 w-1 rounded-full bg-border" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
