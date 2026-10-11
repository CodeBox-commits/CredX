"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, FileSearch, History, Lightbulb, LineChart, Network, Radar, Sparkles } from "lucide-react";
import Link from "next/link";

import { FiveCsRadar } from "@/charts/financial-charts";
import { useCaseContext } from "@/components/case/case-context";
import { BlockSkeleton, DecisionBadge, Delta, EmptyState, ScoreRing, SectionCard, Sparkline, Stat, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { useTimeline } from "@/hooks/queries";
import { formatCr, pct, relativeTime, times, titleCase } from "@/lib/format";
import { riskTone, severityTone, statusTone, toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { Drivers, NextStep, Onboarding } from "@/components/case/overview-panels";

export default function CaseOverviewPage() {
  const { caseId, overview } = useCaseContext();
  const { data: timeline } = useTimeline(caseId);
  if (!overview) return <BlockSkeleton className="h-96" />;
  const { score, research, fraud, facts } = overview;
  if (!score) return <Onboarding overview={overview} caseId={caseId} />;

  const trend = score.ratios.trend;
  const latest = score.ratios.latest;
  const series = (k: keyof typeof latest) => trend.map((r) => Number(r[k] ?? 0));
  const flagsBySev = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => ({ s, n: facts.red_flags.filter((f) => f.severity === s).length })).filter((x) => x.n);

  return (
    <div className="space-y-6">
      <NextStep overview={overview} caseId={caseId} />

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Recommendation */}
        <SectionCard className="xl:col-span-2" title="Recommendation" icon={Sparkles}
          info="Final score = model score (XGBoost, SHAP-decomposed) plus bounded, cited overlays from analyst notes and red flags."
          actions={<Button variant="ghost" size="sm" asChild><Link href={`/cases/${caseId}/decision`}>Explainability <ArrowRight /></Link></Button>}>
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex flex-col items-center gap-2">
              <ScoreRing score={score.credit_score} size={156} sublabel={`${score.rating} · ${titleCase(score.risk_level.toLowerCase())} risk`} />
              <p className="numeric text-xs text-muted-foreground">model {score.model_score} {score.overlay_total >= 0 ? "+" : "−"} {Math.abs(score.overlay_total)} overlays</p>
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <DecisionBadge decision={score.decision} className="px-3 py-1 text-sm" />
                {score.policy.knockouts.length > 0 && <ToneBadge tone="destructive">{score.policy.knockouts.length} policy knock-out</ToneBadge>}
                {score.policy.deviations.length > 0 && <ToneBadge tone="warning">{score.policy.deviations.length} deviation{score.policy.deviations.length > 1 ? "s" : ""}</ToneBadge>}
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Recommended" value={formatCr(score.recommended_amount)} sub={`of ${formatCr(score.loan_sizing.requested_amount)}`} />
                <Stat label="Pricing" value={`${score.suggested_rate.toFixed(2)}%`} sub={`+${score.pricing.spread_over_benchmark.toFixed(2)}% spread`} />
                <Stat label="PD (1 year)" value={pct(score.probability_of_default, 2)} />
                <Stat label="Approval odds" value={pct(score.approval_probability, 0)} />
              </div>
              <ul className="space-y-1.5 border-t border-border/70 pt-3 text-[13px]">
                {score.decision_reasons.slice(0, 4).map((r) => <li key={r} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{r}</li>)}
              </ul>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Five Cs" icon={Radar} info="Each C blends model drivers and analyst overlays mapped to it.">
          <FiveCsRadar fiveCs={score.five_cs} />
          <div className="mt-1 grid grid-cols-5 gap-1 text-center">
            {Object.entries(score.five_cs).map(([k, c]) => (
              <div key={k}><p className="numeric text-sm font-semibold" style={{ color: toneHsl[c.score >= 72 ? "success" : c.score >= 55 ? "warning" : "destructive"] }}>{c.score}</p><p className="text-[10px] text-muted-foreground">{c.title}</p></div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title="What moved the score" icon={Lightbulb} info="Exact SHAP contributions in score points; green pushes the score up, red pulls it down.">
          <Drivers score={score} />
          {score.overlays.length > 0 && (
            <div className="mt-5 border-t border-border/70 pt-4">
              <p className="label mb-2">Analyst & document overlays</p>
              <div className="flex flex-wrap gap-2">
                {score.overlays.map((o, i) => (
                  <span key={i} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border px-2.5 py-1 text-xs" title={o.rationale}>
                    <span className={cn("numeric font-semibold", o.points >= 0 ? "text-success" : "text-destructive")}>{o.points >= 0 ? "+" : ""}{o.points}</span>
                    <span className="truncate">{o.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title={`Financials · ${score.ratios.latest_year ?? ""}`} icon={LineChart}
          actions={<Button variant="ghost" size="sm" asChild><Link href={`/cases/${caseId}/financials`}>Spreads <ArrowRight /></Link></Button>}>
          <ul className="space-y-3.5">
            {[
              { label: "Revenue", value: formatCr(latest.revenue), s: series("revenue"), delta: latest.revenue_growth != null ? latest.revenue_growth * 100 : null },
              { label: "EBITDA margin", value: pct(latest.ebitda_margin), s: series("ebitda_margin") },
              { label: "DSCR", value: times(latest.dscr), s: series("dscr") },
              { label: "Debt / EBITDA", value: times(latest.debt_to_ebitda), s: series("debt_to_ebitda"), invert: true },
            ].map((m) => (
              <li key={m.label} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="numeric flex items-center gap-2 text-[15px] font-semibold">{m.value}{"delta" in m && <Delta value={m.delta} />}</p>
                </div>
                <Sparkline values={m.s} tone={m.invert ? (m.s[m.s.length - 1] > m.s[0] ? "destructive" : "success") : m.s[m.s.length - 1] >= m.s[0] ? "success" : "destructive"} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="External & forensic view" icon={Network} className="xl:col-span-1"
          actions={<Button variant="ghost" size="sm" asChild><Link href={`/cases/${caseId}/research`}>Intelligence <ArrowRight /></Link></Button>}>
          <div className="grid grid-cols-2 gap-2">
            {research && <>
              <div className="rounded-xl border border-border/70 p-3"><p className="text-xs text-muted-foreground">Litigation</p><ToneBadge tone={riskTone(research.litigation_risk)} className="mt-1">{research.litigation_risk}</ToneBadge></div>
              <div className="rounded-xl border border-border/70 p-3"><p className="text-xs text-muted-foreground">Sentiment</p><ToneBadge tone={statusTone(research.promoter_sentiment)} className="mt-1">{research.promoter_sentiment}</ToneBadge></div>
              <div className="rounded-xl border border-border/70 p-3"><p className="text-xs text-muted-foreground">Sector outlook</p><ToneBadge tone={statusTone(research.sector_outlook)} className="mt-1">{research.sector_outlook}</ToneBadge></div>
            </>}
            {fraud && <div className="rounded-xl border border-border/70 p-3"><p className="text-xs text-muted-foreground">Fraud score</p><p className="numeric mt-1 text-sm font-semibold" style={{ color: toneHsl[riskTone(fraud.risk_level)] }}>{fraud.fraud_score}/100</p></div>}
          </div>
          {research && <p className="mt-4 line-clamp-4 text-[13px] leading-relaxed text-muted-foreground">{research.summary}</p>}
        </SectionCard>

        <SectionCard title="Evidence from documents" icon={FileSearch} className="xl:col-span-1" bodyClassName="p-0"
          actions={flagsBySev.length > 0 && <div className="flex gap-1">{flagsBySev.map((f) => <ToneBadge key={f.s} tone={severityTone(f.s)}>{f.n} {f.s.toLowerCase()}</ToneBadge>)}</div>}>
          <ul className="max-h-[300px] divide-y divide-border/70 overflow-y-auto scrollbar-thin">
            {facts.red_flags.map((f) => (
              <li key={f.label} className="flex items-start gap-3 px-5 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: toneHsl[severityTone(f.severity)] }} />
                <div className="min-w-0"><p className="text-[13px] font-medium">{f.label}</p><p className="line-clamp-2 text-xs text-muted-foreground">“{f.evidence}” — {f.filename}{f.page ? `, p.${f.page}` : ""}</p></div>
              </li>
            ))}
            {!facts.red_flags.length && facts.positive_signals.map((p) => (
              <li key={p} className="flex items-start gap-3 px-5 py-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><p className="text-[13px]">{p}</p></li>
            ))}
            {!facts.red_flags.length && !facts.positive_signals.length && <li className="p-5"><EmptyState compact icon={CheckCircle2} title="No red flags extracted" /></li>}
          </ul>
        </SectionCard>

        <SectionCard title="Timeline" icon={History} bodyClassName="max-h-[340px] overflow-y-auto pt-1 scrollbar-thin">
          <ol className="relative space-y-4 border-l border-border pl-4">
            {timeline?.slice(0, 20).map((e, i) => (
              <li key={i} className="relative">
                <span className={cn("absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-card", e.type === "job" ? "bg-primary" : e.type === "note" ? "bg-accent" : "bg-muted-foreground")} />
                <p className="text-[13px] leading-snug">{e.summary ?? titleCase(e.action)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{e.actor?.split("@")[0] ?? "system"} · {relativeTime(e.at)}</p>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
