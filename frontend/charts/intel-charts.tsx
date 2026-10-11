"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  CartesianGrid, Cell, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";

import { GrowBar } from "@/components/common/motion";
import { formatCr, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { APPROVE_FLOOR, DECLINE_FLOOR } from "@/lib/policy";
import type { ResearchFinding } from "@/types/api";

const axis = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const tooltipBox = "rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-xl";

// ------------------------------------------------------------------ fraud heatmap
export function FraudHeatmap({ rows }: { rows: ({ entity: string } & Record<string, number | string>)[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No entity-level risk concentrations.</p>;
  const dims = [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => k !== "entity" && k !== "id" && typeof r[k] === "number")))];
  const norm = (v: number) => (v > 1 ? v / 100 : v);
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[560px] border-separate border-spacing-1 text-xs" aria-label="Fraud risk heatmap">
        <thead>
          <tr>
            <th className="pb-1 text-left font-medium text-muted-foreground">Entity</th>
            {dims.map((d) => <th key={d} className="px-1 pb-1 text-center font-medium text-muted-foreground">{titleCase(d)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={String(r.entity)}>
              <td className="max-w-[200px] truncate pr-2 font-medium">{r.entity}</td>
              {dims.map((d, di) => {
                const v = norm(Number(r[d] ?? 0));
                return (
                  <motion.td key={d} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (ri * dims.length + di) * 0.012 }}
                    className="h-9 rounded-lg text-center font-mono text-[11px]" title={`${titleCase(d)}: ${Math.round(v * 100)}`}
                    style={{ background: v ? `hsl(var(--destructive) / ${0.1 + v * 0.75})` : "hsl(var(--muted) / 0.7)" }}>
                    <span className={cn(v > 0.5 ? "font-semibold text-white" : "text-muted-foreground")}>{v ? Math.round(v * 100) : "·"}</span>
                  </motion.td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ sentiment
export function SentimentTimeline({ findings }: { findings: ResearchFinding[] }) {
  const data = findings
    .filter((f) => f.published_at)
    .map((f) => ({ t: new Date(f.published_at!).getTime(), s: f.sentiment, title: f.title, source: f.source, sev: f.severity, z: f.severity === "CRITICAL" ? 220 : f.severity === "HIGH" ? 150 : 90 }));
  if (!data.length) return <p className="text-sm text-muted-foreground">No dated coverage to plot.</p>;
  return (
    <div className="h-60" role="img" aria-label="News sentiment over time">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--grid))" vertical={false} />
          <ReferenceArea y1={-1} y2={-0.15} fill="hsl(var(--destructive))" fillOpacity={0.05} />
          <ReferenceArea y1={0.15} y2={1} fill="hsl(var(--success))" fillOpacity={0.05} />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          <XAxis dataKey="t" type="number" domain={["dataMin - 1500000000", "dataMax + 1500000000"]} tick={axis} axisLine={false} tickLine={false}
            tickFormatter={(t) => new Date(t).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })} />
          <YAxis dataKey="s" domain={[-1, 1]} tick={axis} width={34} axisLine={false} tickLine={false} ticks={[-1, -0.5, 0, 0.5, 1]} />
          <ZAxis dataKey="z" range={[70, 240]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className={cn(tooltipBox, "max-w-xs")}>
                  <p className="font-semibold">{d.title}</p>
                  <p className="mt-1 text-muted-foreground">{d.source} · sentiment {d.s.toFixed(2)}</p>
                </div>
              );
            }} />
          <Scatter data={data}>
            {data.map((d, i) => <Cell key={i} fill={d.s < -0.15 ? "hsl(var(--destructive))" : d.s > 0.15 ? "hsl(var(--success))" : "hsl(var(--muted-foreground))"} fillOpacity={0.85} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ------------------------------------------------------------------ portfolio risk map
export function PortfolioScatter({ points }: { points: { company: string; reference: string; score: number; fraud: number | null; amount: number }[] }) {
  const data = points.map((p) => ({ ...p, fraud: p.fraud ?? 0 }));
  const colour = (d: { score: number; fraud: number }) =>
    d.fraud >= 50 ? "hsl(var(--destructive))" : d.score >= APPROVE_FLOOR ? "hsl(var(--success))" : d.score >= DECLINE_FLOOR ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  return (
    <div className="relative h-[300px]" role="img" aria-label="Credit score versus fraud score">
      <div className="pointer-events-none absolute right-6 top-3 z-10 text-[11px] font-medium text-destructive/80">High fraud zone</div>
      <div className="pointer-events-none absolute bottom-10 right-6 z-10 text-[11px] font-medium text-success">Comfort zone</div>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 12, right: 18, left: -8, bottom: 6 }}>
          <CartesianGrid stroke="hsl(var(--grid))" />
          <ReferenceArea y1={50} y2={100} fill="hsl(var(--destructive))" fillOpacity={0.04} />
          <ReferenceArea x1={720} x2={900} y1={0} y2={35} fill="hsl(var(--success))" fillOpacity={0.07} />
          <XAxis dataKey="score" type="number" domain={[300, 900]} tick={axis} axisLine={false} tickLine={false} name="Credit score"
            label={{ value: "Credit score →", position: "insideBottomRight", offset: -2, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis dataKey="fraud" type="number" domain={[0, 100]} tick={axis} name="Fraud score" width={36} axisLine={false} tickLine={false}
            label={{ value: "Fraud ↑", angle: -90, position: "insideTopLeft", offset: 14, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <ZAxis dataKey="amount" range={[120, 900]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className={tooltipBox}>
                <p className="font-semibold">{d.company}</p>
                <p className="numeric mt-0.5 text-muted-foreground">{d.reference} · score {d.score} · fraud {d.fraud} · {formatCr(d.amount)}</p>
              </div>
            );
          }} />
          <Scatter data={data}>
            {data.map((d, i) => <Cell key={i} fill={colour(d)} fillOpacity={0.75} stroke={colour(d)} strokeWidth={2} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ------------------------------------------------------------------ risk mix
const RISK_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const RISK_COLOUR: Record<string, string> = {
  LOW: "hsl(var(--success))", MEDIUM: "hsl(var(--warning))", HIGH: "hsl(var(--destructive))", CRITICAL: "hsl(352 70% 38%)",
};

export function RiskMix({ byRisk }: { byRisk: Record<string, number> }) {
  const total = RISK_ORDER.reduce((s, k) => s + (byRisk[k] ?? 0), 0);
  if (!total) return <p className="text-sm text-muted-foreground">No scored cases yet.</p>;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {RISK_ORDER.filter((k) => byRisk[k]).map((k, i) => (
          <GrowBar key={k} pct={(byRisk[k] / total) * 100} delay={i * 100} style={{ background: RISK_COLOUR[k] }} className="first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {RISK_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-2 rounded-xl border border-border/70 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOUR[k] }} />
            <span className="text-[13px]">{titleCase(k.toLowerCase())}</span>
            <span className="numeric ml-auto text-sm font-semibold">{byRisk[k] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ pipeline funnel
const STAGES: { key: string[]; label: string; href: string; tone: string }[] = [
  { key: ["draft"], label: "Draft", href: "/cases?status=draft", tone: "hsl(var(--muted-foreground))" },
  { key: ["ingesting", "analyzing"], label: "Analysing", href: "/cases?status=ingesting,analyzing", tone: "hsl(var(--info))" },
  { key: ["in_review"], label: "In review", href: "/cases?status=in_review", tone: "hsl(var(--primary))" },
  { key: ["escalated"], label: "Committee", href: "/cases?status=escalated", tone: "hsl(var(--warning))" },
  { key: ["approved"], label: "Approved", href: "/cases?status=approved", tone: "hsl(var(--success))" },
  { key: ["rejected"], label: "Declined", href: "/cases?status=rejected", tone: "hsl(var(--destructive))" },
];

export function PipelineFunnel({ byStatus }: { byStatus: Record<string, number> }) {
  const counts = STAGES.map((s) => ({ ...s, n: s.key.reduce((a, k) => a + (byStatus[k] ?? 0), 0) }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  return (
    <ul className="space-y-2">
      {counts.map((s, i) => (
        <li key={s.label}>
          <Link href={s.href} className="group flex items-center gap-3 rounded-lg px-1 py-1 transition hover:bg-muted/60">
            <span className="w-[78px] shrink-0 text-[13px] text-muted-foreground group-hover:text-foreground">{s.label}</span>
            <div className="h-7 flex-1 overflow-hidden rounded-lg bg-muted/60">
              <GrowBar pct={Math.max(s.n ? 12 : 0, (s.n / max) * 100)} delay={i * 60} className="flex items-center rounded-lg px-2" style={{ background: s.tone }}>
                {s.n > 0 && <span className="numeric text-xs font-semibold text-white">{s.n}</span>}
              </GrowBar>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
