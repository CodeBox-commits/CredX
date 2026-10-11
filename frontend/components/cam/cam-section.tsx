"use client";

import { ToneBadge } from "@/components/common/primitives";
import { decisionTone, statusTone, toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";
import type { CamSection } from "@/types/api";

export function SectionBody({ s }: { s: CamSection }) {
  const c = s.content;
  if (s.kind === "decision") {
    const tone = decisionTone(c.decision_code);
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-l-4 p-4" style={{ borderColor: toneHsl[tone], background: toneHsl[tone].replace(")", " / 0.07)") }}>
          <p className="text-sm font-bold" style={{ color: toneHsl[tone] }}>Recommendation: {c.decision}</p>
          <p className="mt-1.5 text-[14px] leading-relaxed">{c.narrative}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {c.metrics.map((m: { label: string; value: string }) => (
            <div key={m.label} className="rounded-xl border border-border p-3"><p className="text-[11px] text-muted-foreground">{m.label}</p><p className="numeric mt-0.5 font-semibold">{m.value}</p></div>
          ))}
        </div>
      </div>
    );
  }
  if (s.kind === "kv") {
    return (
      <dl className="grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
        {c.map((m: { label: string; value: string }) => (
          <div key={m.label} className="border-b border-border/60 pb-2"><dt className="text-xs text-muted-foreground">{m.label}</dt><dd className="mt-0.5">{m.value}</dd></div>
        ))}
      </dl>
    );
  }
  if (s.kind === "text") return <p className="text-[14px] leading-relaxed">{c}</p>;
  if (s.kind === "table") {
    return (
      <div className="space-y-3">
        <Table header={c.header} rows={c.rows} />
        {s.secondary && <Table header={s.secondary.header} rows={s.secondary.rows} />}
        {s.note && <p className="text-xs italic text-muted-foreground">{s.note}</p>}
      </div>
    );
  }
  if (s.kind === "five_cs") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {c.map((x: { c: string; score: number; assessment: string; evidence: string[] }) => {
          const tone = x.score >= 72 ? "success" : x.score >= 55 ? "warning" : "destructive";
          return (
            <div key={x.c} className="rounded-xl border border-border p-3 text-xs">
              <p className="font-semibold">{x.c}</p>
              <p className="numeric mt-1 text-2xl font-bold" style={{ color: toneHsl[tone] }}>{x.score}</p>
              <p className="text-muted-foreground">{x.assessment}</p>
              <ul className="mt-2 space-y-0.5 text-muted-foreground">{x.evidence.slice(0, 3).map((e) => <li key={e}>• {e}</li>)}</ul>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="space-y-3 text-[14px] leading-relaxed">
      <p>{c.summary}</p>
      {c.badges && <div className="flex flex-wrap gap-2">{c.badges.map((b: { label: string; value: string }) => <span key={b.label} className="rounded-full border border-border px-2.5 py-0.5 text-xs">{b.label}: <b>{b.value}</b></span>)}</div>}
      {c.bullets?.length > 0 && <ul className="space-y-1.5 pl-1">{c.bullets.map((b: string) => <li key={b} className="flex gap-2.5 text-muted-foreground"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />{b}</li>)}</ul>}
      {c.groups?.filter((g: { lines?: string[] }) => g.lines?.length).map((g: { title: string; lines: string[] }) => (
        <div key={g.title}><p className="mt-2 text-sm font-semibold">{g.title}</p><ul className="mt-1 space-y-1 pl-1">{g.lines.map((l) => <li key={l} className="flex gap-2.5 text-muted-foreground"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />{l}</li>)}</ul></div>
      ))}
    </div>
  );
}

export function Table({ header, rows }: { header: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 scrollbar-thin">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead className="bg-muted/50"><tr>{header.map((h, i) => <th key={h} className={cn("px-3 py-2 text-left font-semibold", i > 0 && "text-right")}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => {
                const status = /^(PASS|FAIL|WARN|NA)$/.test(c) ? c.toLowerCase() : null;
                return (
                  <td key={j} className={cn("px-3 py-2 align-top", j > 0 && /^[₹+\-\d—]/.test(c) && "numeric text-right")}>
                    {status ? <ToneBadge tone={statusTone(status)}>{c}</ToneBadge> : c}
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
