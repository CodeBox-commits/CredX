"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { Contribution, Overlay } from "@/types/api";

interface Step {
  name: string;
  base: number;
  delta: number;
  kind: "base" | "feature" | "overlay" | "total";
  detail?: string;
}

/**
 * Score waterfall: base points -> each SHAP feature contribution -> overlays -> final score.
 * Because contributions are exact TreeSHAP values scaled by PDO, the bars reconcile to the score.
 */
export function ShapWaterfall({ base, contributions, overlays, finalScore, maxFeatures = 9 }: {
  base: number; contributions: Contribution[]; overlays: Overlay[]; finalScore: number; maxFeatures?: number;
}) {
  const nonZero = contributions.filter((c) => c.points !== 0);
  const top = nonZero.slice(0, maxFeatures);
  const rest = nonZero.slice(maxFeatures).reduce((s, c) => s + c.points, 0);
  const steps: Step[] = [];
  let running = base;
  steps.push({ name: "Base", base: 0, delta: base, kind: "base", detail: "Portfolio average (model bias)" });
  for (const c of top) {
    steps.push({ name: c.label, base: running, delta: c.points, kind: "feature", detail: `${c.display_value}` });
    running += c.points;
  }
  if (rest) {
    steps.push({ name: `${nonZero.length - top.length} other factors`, base: running, delta: rest, kind: "feature" });
    running += rest;
  }
  for (const o of overlays) {
    steps.push({ name: o.source === "analyst_note" ? `Note: ${o.label.slice(0, 26)}…` : o.label.slice(0, 30), base: running, delta: o.points, kind: "overlay", detail: o.rationale });
    running += o.points;
  }
  if (running !== finalScore) {
    steps.push({ name: running < finalScore ? "Score floor" : "Score cap", base: running, delta: finalScore - running, kind: "overlay", detail: "Scores are bounded to the 300–900 scale" });
  }
  steps.push({ name: "Final score", base: 0, delta: finalScore, kind: "total" });

  const data = steps.map((s) => ({
    ...s,
    lo: s.kind === "base" || s.kind === "total" ? 0 : Math.min(s.base, s.base + s.delta),
    span: s.kind === "base" || s.kind === "total" ? s.delta : Math.abs(s.delta),
  }));
  const values = steps.flatMap((s) => (s.kind === "base" || s.kind === "total" ? [s.delta] : [s.base, s.base + s.delta]));
  const minY = Math.max(0, Math.floor((Math.min(...values) - 25) / 50) * 50);
  const maxY = Math.min(950, Math.ceil((Math.max(...values) + 25) / 50) * 50);

  const color = (s: Step) =>
    s.kind === "base" ? "hsl(var(--muted-foreground))" : s.kind === "total" ? "hsl(var(--primary))"
      : s.delta >= 0 ? "hsl(var(--success))" : s.kind === "overlay" ? "hsl(var(--accent))" : "hsl(var(--destructive))";

  return (
    <div className="h-[340px] w-full" role="img" aria-label="Score explanation waterfall">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 64 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--grid))" />
          <XAxis dataKey="name" interval={0} angle={-38} textAnchor="end" height={70} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis domain={[minY, maxY]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDataOverflow />
          <ReferenceLine y={680} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ value: "680", fontSize: 9, fill: "hsl(var(--muted-foreground))", position: "right" }} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const s = payload[0].payload as Step;
              return (
                <div className="max-w-xs rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
                  <p className="font-semibold">{s.name}</p>
                  <p className="numeric mt-0.5">{s.kind === "base" || s.kind === "total" ? `${s.delta} pts` : `${s.delta > 0 ? "+" : ""}${s.delta} pts`}</p>
                  {s.detail && <p className="mt-1 text-muted-foreground">{s.detail}</p>}
                </div>
              );
            }}
          />
          <Bar dataKey="lo" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="span" stackId="w" radius={[3, 3, 3, 3]} animationDuration={700}>
            {data.map((s, i) => <Cell key={i} fill={color(s)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Diverging bars of every feature's point contribution, grouped visually by direction. */
export function ContributionBars({ contributions }: { contributions: Contribution[] }) {
  const max = Math.max(1, ...contributions.map((c) => Math.abs(c.points)));
  return (
    <ul className="space-y-1.5">
      {contributions.map((c) => (
        <li key={c.feature} className="grid grid-cols-[minmax(120px,1.2fr)_minmax(70px,auto)_2fr_44px] items-center gap-2 text-xs">
          <span className="truncate" title={c.description}>{c.label}</span>
          <span className={`numeric truncate text-right ${c.missing ? "italic text-muted-foreground" : ""}`}>{c.display_value}</span>
          <div className="relative h-2.5 rounded-full bg-muted/60">
            <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
            <div
              className="absolute inset-y-0 rounded-full"
              style={{
                left: c.points >= 0 ? "50%" : `${50 - (Math.abs(c.points) / max) * 50}%`,
                width: `${(Math.abs(c.points) / max) * 50}%`,
                background: c.points >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))",
              }}
            />
          </div>
          <span className={`numeric text-right font-semibold ${c.points > 0 ? "text-success" : c.points < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {c.points > 0 ? "+" : ""}{c.points}
          </span>
        </li>
      ))}
    </ul>
  );
}
