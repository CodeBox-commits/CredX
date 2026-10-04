"use client";

import {
  Area, AreaChart, Bar, CartesianGrid, ComposedChart, Legend, Line, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { formatCr, pct, times } from "@/lib/format";
import type { FiveC, RatioRow } from "@/types/api";

const axis = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };

function ChartTooltip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="numeric flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {fmt?.[p.dataKey]?.(p.value) ?? p.value}
        </p>
      ))}
    </div>
  );
}

export function RevenueTrend({ trend }: { trend: RatioRow[] }) {
  const data = trend.map((r) => ({ fy: r.fiscal_year, revenue: r.revenue, ebitda: r.ebitda, margin: r.ebitda_margin }));
  return (
    <div className="h-64" role="img" aria-label="Revenue, EBITDA and margin trend">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--grid))" />
          <XAxis dataKey="fy" tick={axis} />
          <YAxis yAxisId="l" tick={axis} tickFormatter={(v) => `${(v / 1e7).toFixed(0)}`} width={40} label={{ value: "₹ Cr", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis yAxisId="r" orientation="right" tick={axis} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} width={36} />
          <Tooltip content={<ChartTooltip fmt={{ revenue: formatCr, ebitda: formatCr, margin: pct }} />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="l" dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={44} />
          <Bar yAxisId="l" dataKey="ebitda" name="EBITDA" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} maxBarSize={44} />
          <Line yAxisId="r" dataKey="margin" name="EBITDA margin" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LeverageTrend({ trend }: { trend: RatioRow[] }) {
  const data = trend.map((r) => ({ fy: r.fiscal_year, dscr: r.dscr, icr: r.interest_coverage, lev: r.debt_to_ebitda }));
  return (
    <div className="h-64" role="img" aria-label="Coverage and leverage trend">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--grid))" />
          <XAxis dataKey="fy" tick={axis} />
          <YAxis tick={axis} width={32} />
          <Tooltip content={<ChartTooltip fmt={{ dscr: times, icr: times, lev: times }} />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line dataKey="dscr" name="DSCR" stroke="hsl(var(--chart-3))" strokeWidth={2.5} dot={{ r: 4 }} />
          <Line dataKey="icr" name="Interest cover" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
          <Line dataKey="lev" name="Debt / EBITDA" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FiveCsRadar({ fiveCs }: { fiveCs: Record<string, FiveC> }) {
  const data = Object.entries(fiveCs).map(([k, v]) => ({ c: k[0].toUpperCase() + k.slice(1), score: v.score }));
  return (
    <div className="h-64" role="img" aria-label="Five Cs of credit radar">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="hsl(var(--grid))" />
          <PolarAngleAxis dataKey="c" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
          <Tooltip content={<ChartTooltip fmt={{ score: (v: number) => `${v}/100` }} />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyFlows({ monthly }: { monthly: { month: string; credits: number; debits: number }[] }) {
  return (
    <div className="h-56" role="img" aria-label="Monthly bank credits and debits">
      <ResponsiveContainer>
        <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="hsl(var(--success))" stopOpacity={0.35} /><stop offset="1" stopColor="hsl(var(--success))" stopOpacity={0} /></linearGradient>
            <linearGradient id="dr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="hsl(var(--destructive))" stopOpacity={0.3} /><stop offset="1" stopColor="hsl(var(--destructive))" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--grid))" />
          <XAxis dataKey="month" tick={axis} />
          <YAxis tick={axis} tickFormatter={(v) => (v / 1e7).toFixed(0)} width={32} />
          <Tooltip content={<ChartTooltip fmt={{ credits: formatCr, debits: formatCr }} />} />
          <Area dataKey="credits" name="Credits" stroke="hsl(var(--success))" fill="url(#cr)" strokeWidth={2} />
          <Area dataKey="debits" name="Debits" stroke="hsl(var(--destructive))" fill="url(#dr)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
