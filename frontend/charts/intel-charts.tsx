"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";

import { formatCr } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResearchFinding } from "@/types/api";

const axis = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };
const DIMENSIONS = ["Circularity", "Related party", "Shell indicators", "Pass-through", "Invoice anomaly", "Flow concentration"];

export function FraudHeatmap({ rows }: { rows: ({ entity: string } & Record<string, number | string>)[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No entity-level risk concentrations.</p>;
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[620px] border-separate border-spacing-1 text-xs" aria-label="Fraud risk heatmap">
        <thead>
          <tr>
            <th className="text-left font-medium text-muted-foreground">Entity</th>
            {DIMENSIONS.map((d) => <th key={d} className="px-1 text-center font-medium text-muted-foreground">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.entity)}>
              <td className="max-w-[200px] truncate pr-2 font-medium">{r.entity}</td>
              {DIMENSIONS.map((d) => {
                const v = Number(r[d] ?? 0);
                return (
                  <td key={d} className="h-8 rounded-md text-center font-mono" style={{ background: v ? `hsl(var(--destructive) / ${0.12 + v * 0.7})` : "hsl(var(--muted) / 0.6)" }} title={`${d}: ${(v * 100).toFixed(0)}%`}>
                    <span className={cn(v > 0.55 ? "text-destructive-foreground" : "text-muted-foreground")}>{v ? (v * 100).toFixed(0) : "·"}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SentimentTimeline({ findings }: { findings: ResearchFinding[] }) {
  const data = findings
    .filter((f) => f.published_at)
    .map((f) => ({ t: new Date(f.published_at!).getTime(), s: f.sentiment, title: f.title, source: f.source, sev: f.severity, z: f.severity === "CRITICAL" ? 200 : f.severity === "HIGH" ? 140 : 80 }));
  if (!data.length) return <p className="text-sm text-muted-foreground">No dated coverage to plot.</p>;
  return (
    <div className="h-56" role="img" aria-label="News sentiment over time">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--grid))" />
          <ReferenceArea y1={-1} y2={-0.15} fill="hsl(var(--destructive))" fillOpacity={0.05} />
          <ReferenceArea y1={0.15} y2={1} fill="hsl(var(--success))" fillOpacity={0.05} />
          <XAxis dataKey="t" type="number" domain={["dataMin - 1500000000", "dataMax + 1500000000"]} tick={axis}
            tickFormatter={(t) => new Date(t).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })} />
          <YAxis dataKey="s" domain={[-1, 1]} tick={axis} width={34} />
          <ZAxis dataKey="z" range={[60, 220]} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="max-w-xs rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
                  <p className="font-semibold">{d.title}</p>
                  <p className="mt-1 text-muted-foreground">{d.source} · sentiment {d.s.toFixed(2)}</p>
                </div>
              );
            }}
          />
          <Scatter data={data}>
            {data.map((d, i) => <Cell key={i} fill={d.s < -0.15 ? "hsl(var(--destructive))" : d.s > 0.15 ? "hsl(var(--success))" : "hsl(var(--muted-foreground))"} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PortfolioScatter({ points }: { points: { company: string; reference: string; score: number; fraud: number | null; amount: number }[] }) {
  const data = points.map((p) => ({ ...p, fraud: p.fraud ?? 0 }));
  return (
    <div className="h-72" role="img" aria-label="Credit score versus fraud score">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 10, right: 16, left: -6, bottom: 4 }}>
          <CartesianGrid stroke="hsl(var(--grid))" />
          <ReferenceArea x1={300} x2={600} fill="hsl(var(--destructive))" fillOpacity={0.05} />
          <ReferenceArea x1={760} x2={900} fill="hsl(var(--success))" fillOpacity={0.05} />
          <XAxis dataKey="score" type="number" domain={[300, 900]} tick={axis} name="Credit score" label={{ value: "Credit score", position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis dataKey="fraud" type="number" domain={[0, 100]} tick={axis} name="Fraud score" width={36} />
          <ZAxis dataKey="amount" range={[80, 600]} />
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
                <p className="font-semibold">{d.company}</p>
                <p className="numeric text-muted-foreground">{d.reference} · score {d.score} · fraud {d.fraud} · {formatCr(d.amount)}</p>
              </div>
            );
          }} />
          <Scatter data={data}>
            {data.map((d, i) => <Cell key={i} fill={d.fraud >= 50 ? "hsl(var(--destructive))" : d.score >= 720 ? "hsl(var(--success))" : d.score >= 640 ? "hsl(var(--warning))" : "hsl(var(--destructive))"} fillOpacity={0.8} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

const RISK_COLORS: Record<string, string> = { LOW: "hsl(var(--success))", MEDIUM: "hsl(var(--warning))", HIGH: "hsl(var(--destructive))", CRITICAL: "hsl(0 70% 38%)" };

export function RiskDonut({ byRisk }: { byRisk: Record<string, number> }) {
  const data = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].filter((k) => byRisk[k]).map((k) => ({ name: k, value: byRisk[k] }));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative h-56" role="img" aria-label="Portfolio risk mix">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none">
            {data.map((d) => <Cell key={d.name} fill={RISK_COLORS[d.name]} />)}
          </Pie>
          <Tooltip formatter={(v: number, n: string) => [`${v} case(s)`, n]} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="numeric text-2xl font-semibold">{total}</p>
        <p className="eyebrow">scored</p>
      </div>
    </div>
  );
}

export function StatusBars({ byStatus }: { byStatus: Record<string, number> }) {
  const order = ["draft", "ingesting", "analyzing", "in_review", "escalated", "approved", "rejected"];
  const data = order.filter((k) => byStatus[k]).map((k) => ({ name: k.replace("_", " "), value: byStatus[k] }));
  return (
    <div className="h-56" role="img" aria-label="Pipeline by status">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ ...axis, fontSize: 11 }} width={80} />
          <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
