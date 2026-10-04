"use client";

import { AlertTriangle, CheckCircle2, CircleDot, FileSearch, Network, Play, Upload } from "lucide-react";
import Link from "next/link";

import { FiveCsRadar } from "@/charts/financial-charts";
import { ScoreGauge } from "@/charts/score-gauge";
import { useCaseContext } from "@/components/case/case-context";
import { BlockSkeleton, DecisionBadge, EmptyState, SectionCard, Stat, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { useTimeline } from "@/hooks/queries";
import { formatCr, pct, relativeTime, times, titleCase } from "@/lib/format";
import { riskTone, severityTone, statusTone } from "@/lib/tones";

export default function CaseOverviewPage() {
  const { caseId, overview } = useCaseContext();
  const { data: timeline } = useTimeline(caseId);
  if (!overview) return <BlockSkeleton className="h-96" />;
  const { score, research, fraud, facts } = overview;

  if (!score) {
    const hasDocs = facts.documents.length > 0;
    return (
      <SectionCard title="Get this case to a decision" eyebrow="Next steps">
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Upload, title: "Upload the document pack", text: "Annual report, GST returns, bank statement, MCA & legal notices.", done: hasDocs, href: `/cases/${caseId}/documents`, cta: "Upload documents" },
            { icon: Play, title: "Run full analysis", text: "Research, fraud graph, explainable scoring and CAM run as one async pipeline.", done: false, href: null, cta: null },
            { icon: FileSearch, title: "Review & decide", text: "Inspect SHAP drivers, add site-visit notes, generate the CAM and record the sanction decision.", done: false, href: null, cta: null },
          ].map((s, i) => (
            <li key={s.title} className="rounded-xl border border-border p-4">
              <div className="mb-2 flex items-center gap-2">
                {s.done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border font-mono text-[10px]">{i + 1}</span>}
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="font-medium">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              {s.href && !s.done && <Button asChild size="sm" className="mt-3"><Link href={s.href}>{s.cta}</Link></Button>}
            </li>
          ))}
        </ol>
        {hasDocs && <p className="mt-4 text-sm text-muted-foreground">{facts.documents.length} document(s) ingested — use <b>Run analysis</b> above.</p>}
      </SectionCard>
    );
  }

  const latest = score.ratios.latest;
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <SectionCard eyebrow="Decision" title="Credit assessment" className="xl:row-span-2"
        info="Final score = model score (XGBoost + SHAP) plus bounded, cited overlays from analyst notes and unmodelled red flags.">
        <ScoreGauge score={score.credit_score} modelScore={score.model_score} label={`${score.rating} · ${score.risk_level} risk`} />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Stat label="PD (1y)" value={pct(score.probability_of_default, 2)} sub={`model ${score.model_score}${score.overlay_total ? `, overlays ${score.overlay_total > 0 ? "+" : ""}${score.overlay_total}` : ""}`} />
          <Stat label="Approval likelihood" value={pct(score.approval_probability, 0)} />
          <Stat label="Recommended" value={formatCr(score.recommended_amount)} sub={`of ${formatCr(score.loan_sizing.requested_amount)} · ${score.loan_sizing.binding_constraint}`} />
          <Stat label="Suggested rate" value={`${score.suggested_rate}%`} sub={`+${score.pricing.spread_over_benchmark}% over benchmark`} />
        </div>
        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-2"><DecisionBadge decision={score.decision} /><span className="text-xs text-muted-foreground">model recommendation</span></div>
          <ul className="space-y-1 text-sm">{score.decision_reasons.map((r) => <li key={r} className="flex gap-2"><CircleDot className="mt-1 h-3 w-3 shrink-0 text-primary" />{r}</li>)}</ul>
        </div>
        <Button asChild variant="outline" className="mt-4 w-full"><Link href={`/cases/${caseId}/decision`}>Open explainability →</Link></Button>
      </SectionCard>

      <SectionCard eyebrow="Drivers" title="What moved the score" className="xl:col-span-2">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-destructive">Top risk factors</p>
            <ul className="space-y-1.5 text-sm">{score.top_risk_factors.slice(0, 6).map((r) => <li key={r} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />{r}</li>)}
              {!score.top_risk_factors.length && <li className="text-muted-foreground">No material negatives.</li>}</ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-success">Strengths</p>
            <ul className="space-y-1.5 text-sm">{score.top_strengths.slice(0, 6).map((r) => <li key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />{r}</li>)}</ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Five Cs" title="Credit profile">
        <FiveCsRadar fiveCs={score.five_cs} />
      </SectionCard>

      <SectionCard eyebrow="Financials" title={`Key ratios · ${score.ratios.latest_year ?? ""}`}>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Revenue" value={formatCr(latest.revenue)} sub={latest.revenue_growth !== null ? `${pct(latest.revenue_growth)} YoY` : undefined} />
          <Stat label="EBITDA margin" value={pct(latest.ebitda_margin)} />
          <Stat label="DSCR" value={times(latest.dscr)} />
          <Stat label="Debt / EBITDA" value={times(latest.debt_to_ebitda)} />
          <Stat label="Current ratio" value={times(latest.current_ratio)} />
          <Stat label="Receivable days" value={latest.receivable_days ? Math.round(latest.receivable_days) : "—"} />
        </div>
      </SectionCard>

      <SectionCard eyebrow="External" title="Research & forensics" actions={<Button asChild variant="ghost" size="sm"><Link href={`/cases/${caseId}/fraud`}><Network className="mr-1 h-3.5 w-3.5" />Graph</Link></Button>}>
        <div className="flex flex-wrap gap-2">
          {research && (<>
            <ToneBadge tone={riskTone(research.litigation_risk)}>Litigation {research.litigation_risk}</ToneBadge>
            <ToneBadge tone={statusTone(research.promoter_sentiment)}>Sentiment {research.promoter_sentiment}</ToneBadge>
            <ToneBadge tone={statusTone(research.sector_outlook)}>Sector {research.sector_outlook}</ToneBadge>
          </>)}
          {fraud && <ToneBadge tone={riskTone(fraud.risk_level)}>Fraud {fraud.fraud_score}/100</ToneBadge>}
        </div>
        {research && <p className="mt-3 line-clamp-5 text-sm text-muted-foreground">{research.summary}</p>}
        {fraud && <p className="mt-3 text-sm">{fraud.summary}</p>}
      </SectionCard>

      <SectionCard eyebrow="Evidence" title="Red flags from documents" className="xl:col-span-2" bodyClassName="p-0">
        <ul className="divide-y divide-border">
          {facts.red_flags.slice(0, 8).map((f) => (
            <li key={f.label} className="flex items-start gap-3 px-5 py-2.5 text-sm">
              <ToneBadge tone={severityTone(f.severity)} className="mt-0.5 w-20 justify-center">{f.severity}</ToneBadge>
              <div className="min-w-0"><p className="font-medium">{f.label}</p><p className="truncate text-xs text-muted-foreground">“{f.evidence}” — {f.filename}{f.page ? `, p.${f.page}` : ""}</p></div>
            </li>
          ))}
          {!facts.red_flags.length && <li className="px-5 py-6"><EmptyState icon={CheckCircle2} title="No red flags extracted" description={facts.positive_signals.join(" · ") || undefined} /></li>}
        </ul>
      </SectionCard>

      <SectionCard eyebrow="Activity" title="Timeline" bodyClassName="max-h-80 overflow-y-auto p-0 scrollbar-thin">
        <ol className="relative ml-6 border-l border-border py-3">
          {timeline?.slice(0, 25).map((e, i) => (
            <li key={i} className="mb-3 ml-4">
              <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${e.type === "job" ? "bg-primary" : e.type === "note" ? "bg-accent" : "bg-muted-foreground"}`} />
              <p className="text-xs text-muted-foreground">{relativeTime(e.at)} · {e.actor ?? "system"}</p>
              <p className="text-sm">{e.summary ?? titleCase(e.action)}</p>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}
