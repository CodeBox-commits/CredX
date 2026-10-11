"use client";

import { motion } from "framer-motion";
import { BadgeIndianRupee, CheckCircle2, CircleSlash, Gavel, History, Landmark, Loader2, RefreshCw, Scale, Sparkles, TrendingUp, Users, Wand2, XCircle } from "lucide-react";
import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ContributionBars, ShapWaterfall } from "@/charts/shap-waterfall";
import { useCaseContext } from "@/components/case/case-context";
import { DecisionDialog } from "@/components/decision/decision-dialog";
import { BlockSkeleton, DecisionBadge, EmptyState, ScoreRing, SectionCard, Stat, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { useCaseAction, useScore, useScoreHistory } from "@/hooks/queries";
import { decisionLabel, formatCr, pct, relativeTime } from "@/lib/format";
import { decisionTone, scoreTone, toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { WhatIf } from "@/components/decision/what-if";
import { OverridePanel } from "@/components/decision/override-panel";
import { EscalateDialog } from "@/components/decision/escalate-dialog";

type Tab = "explain" | "policy" | "structure" | "governance";
const TABS: { key: Tab; label: string; icon: typeof Sparkles }[] = [
  { key: "explain", label: "Explainability", icon: Sparkles },
  { key: "policy", label: "Policy & Five Cs", icon: Scale },
  { key: "structure", label: "Structure & pricing", icon: BadgeIndianRupee },
  { key: "governance", label: "Overrides & history", icon: History },
];
const FIVE_C_TONE = (s: number) => (s >= 72 ? "success" : s >= 55 ? "primary" : s >= 40 ? "warning" : "destructive") as "success" | "primary" | "warning" | "destructive";

export default function DecisionPage() {
  const { caseId, watchJob, overview } = useCaseContext();
  const { data: s, isLoading } = useScore(caseId);
  const { data: history } = useScoreHistory(caseId);
  const can = useAuth((st) => st.can);
  const rescore = useCaseAction(caseId, "rescore", (j) => watchJob(j.id));
  const [tab, setTab] = useState<Tab>("explain");
  const [decideOpen, setDecideOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);

  if (isLoading) return <BlockSkeleton className="h-96" />;
  if (!s) return <EmptyState icon={Sparkles} title="Not scored yet" description="Run analysis to generate an explainable credit decision." />;
  const final = overview?.case_record.final_decision;
  const tone = decisionTone(final ?? s.decision);
  const positive = s.pricing.components.filter((c) => c.bps > 0);
  const totalBps = positive.reduce((a, c) => a + c.bps, 0);
  const positiveColour = (component: string) => `hsl(var(--chart-${(positive.findIndex((c) => c.component === component) % 5) + 1}))`;

  return (
    <div className="space-y-6">
      {/* Verdict */}
      <section className="panel relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: toneHsl[tone] }} />
        <div className="grid gap-6 p-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <ScoreRing score={s.credit_score} size={140} sublabel={`${s.rating} · PD ${pct(s.probability_of_default, 1)}`} />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{final ? "Final decision" : "CredX recommendation"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold" style={{ color: toneHsl[tone] }}>{decisionLabel(final ?? s.decision)}</h2>
              {final && final !== s.decision && <ToneBadge tone="accent">Model said: {decisionLabel(s.decision)}</ToneBadge>}
            </div>
            <ul className="mt-3 space-y-1.5 text-[13px]">
              {s.decision_reasons.slice(1, 4).map((r) => <li key={r} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: toneHsl[tone] }} />{r}</li>)}
            </ul>
            <div className="mt-4 grid max-w-xl grid-cols-3 gap-4">
              <Stat label="Recommended" value={formatCr(s.recommended_amount)} sub={`of ${formatCr(s.loan_sizing.requested_amount)}`} />
              <Stat label="Rate" value={`${s.suggested_rate.toFixed(2)}%`} sub={`grade ${s.pricing.grade}`} />
              <Stat label="Approval odds" value={pct(s.approval_probability, 0)} sub={`model v${s.version}`} />
            </div>
          </div>
          <div className="flex flex-row flex-wrap gap-2 lg:flex-col">
            {can("credit_manager") && <Button onClick={() => setDecideOpen(true)}><Gavel /> Record decision</Button>}
            {can("analyst") && overview?.case_record.status !== "escalated" && <Button variant="outline" onClick={() => setEscalateOpen(true)}><Users /> Escalate</Button>}
            {can("analyst") && <Button variant="ghost" onClick={() => rescore.mutate()} disabled={rescore.isPending}>{rescore.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-score</Button>}
          </div>
        </div>
      </section>

      <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface p-1 shadow-sm" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn("relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition", tab === t.key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {tab === t.key && <motion.span layoutId="decision-tab" className="absolute inset-0 rounded-lg bg-primary" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
            <t.icon className="relative h-4 w-4" /><span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {tab === "explain" && (
          <div className="grid gap-6 xl:grid-cols-3">
            <SectionCard className="xl:col-span-2" title="Score waterfall" icon={Sparkles}
              info="Each bar is a feature's TreeSHAP contribution converted to score points (PDO scaling), so the bars reconcile exactly to the score. Purple bars are qualitative overlays."
              actions={<span className="hidden text-xs text-muted-foreground md:inline">Model {s.model_version}{s.model_metrics.auc ? ` · AUC ${s.model_metrics.auc}` : ""}</span>}>
              <ShapWaterfall base={s.base_points} contributions={s.contributions} overlays={s.overlays} finalScore={s.credit_score} />
              <p className="mt-1 text-xs text-muted-foreground">
                Base {s.base_points} {s.model_score - s.base_points >= 0 ? "+" : "−"} {Math.abs(s.model_score - s.base_points)} from model drivers = {s.model_score}
                {s.overlay_total ? `; overlays ${s.overlay_total > 0 ? "+" : "−"}${Math.abs(s.overlay_total)} → ${s.credit_score}` : ""}.
              </p>
            </SectionCard>
            <SectionCard title="What would change it?" icon={Wand2} info="Toggle improvements to see the projected score and decision band. Estimates use each driver's SHAP gain.">
              <WhatIf s={s} />
            </SectionCard>
            <SectionCard className="xl:col-span-2" title="All model drivers" icon={TrendingUp}>
              <ContributionBars contributions={s.contributions} />
              <p className="mt-3 text-xs text-muted-foreground">Italic values were missing from the documents; the model routes them down learned default branches rather than imputing.</p>
            </SectionCard>
            <SectionCard title="Qualitative overlays" icon={Users} bodyClassName="p-0">
              <ul className="divide-y divide-border/70">
                {s.overlays.map((o, i) => (
                  <li key={i} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <ToneBadge tone={o.source === "analyst_note" ? "accent" : "warning"}>{o.source === "analyst_note" ? "Analyst note" : "Document flag"}</ToneBadge>
                      <span className={cn("numeric ml-auto text-sm font-semibold", o.points < 0 ? "text-destructive" : "text-success")}>{o.points > 0 ? "+" : ""}{o.points}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] font-medium">{o.label}</p>
                    <p className="text-xs text-muted-foreground">{o.rationale}</p>
                  </li>
                ))}
                {!s.overlays.length && <li className="px-5 py-6 text-center text-sm text-muted-foreground">No overlays — the score is the pure model output.</li>}
              </ul>
            </SectionCard>
          </div>
        )}

        {tab === "policy" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-5">
              {Object.entries(s.five_cs).map(([k, c], i) => (
                <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="panel p-4">
                  <div className="flex items-center justify-between"><p className="font-display font-semibold">{c.title}</p><ToneBadge tone={FIVE_C_TONE(c.score)}>{c.assessment}</ToneBadge></div>
                  <p className="numeric mt-3 text-3xl font-bold" style={{ color: toneHsl[FIVE_C_TONE(c.score)] }}>{c.score}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.score}%`, background: toneHsl[FIVE_C_TONE(c.score)] }} /></div>
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{c.evidence.slice(0, 3).map((e) => <li key={e} className="truncate" title={e}>• {e}</li>)}</ul>
                </motion.div>
              ))}
            </div>
            <SectionCard title={`Credit policy rule book · ${s.policy.passed} of ${s.policy.rules.length} pass`} icon={Scale} bodyClassName="p-0">
              <ul className="divide-y divide-border/70">
                {s.policy.rules.map((r) => (
                  <li key={r.id} className={cn("flex items-start gap-3 px-5 py-3", r.status === "fail" && r.kind === "knockout" && "bg-destructive/[0.05]")}>
                    {r.status === "pass" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : r.status === "fail" ? (r.kind === "knockout" ? <CircleSlash className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />) : <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-border" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.guidance}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="numeric text-sm font-semibold">{r.actual ?? "n/a"}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{r.threshold}</p>
                    </div>
                    {r.status === "fail" && <ToneBadge tone={r.kind === "knockout" ? "destructive" : "warning"} className="mt-0.5">{r.kind}</ToneBadge>}
                  </li>
                ))}
              </ul>
            </SectionCard>
            {s.conditions.length > 0 && (
              <SectionCard title="Proposed sanction conditions" icon={Gavel}>
                <ol className="grid gap-2 md:grid-cols-2">
                  {s.conditions.map((c, i) => <li key={c} className="flex gap-3 rounded-xl border border-border/70 p-3 text-[13px]"><span className="numeric flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>{c}</li>)}
                </ol>
              </SectionCard>
            )}
          </div>
        )}

        {tab === "structure" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard title={`Loan sizing — ${formatCr(s.loan_sizing.recommended_amount)}`} icon={Landmark} info="Every method computes an eligible amount; the most conservative binds, then a score-based haircut applies.">
              <ul className="space-y-3">
                {s.loan_sizing.methods.map((m) => {
                  const max = Math.max(...s.loan_sizing.methods.map((x) => x.limit), 1);
                  return (
                    <li key={m.method}>
                      <div className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="font-medium">{m.method}{m.binding && <ToneBadge tone="primary" className="ml-2">binding</ToneBadge>}</span>
                        <span className="numeric font-semibold">{formatCr(m.limit)}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-all duration-700", m.binding ? "bg-primary" : "bg-muted-foreground/40")} style={{ width: `${(m.limit / max) * 100}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{m.basis}</p>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
            <SectionCard title={`Risk-based pricing — ${s.pricing.suggested_rate.toFixed(2)}% p.a.`} icon={BadgeIndianRupee}>
              <div className="flex h-8 overflow-hidden rounded-lg">
                {positive.map((c) => (
                  <div key={c.component} title={`${c.component}: ${c.bps} bps`} className="flex items-center justify-center text-[10px] font-semibold text-white transition-all duration-700"
                    style={{ width: `${(c.bps / totalBps) * 100}%`, background: positiveColour(c.component) }}>{c.bps >= 60 ? `${c.bps}` : ""}</div>
                ))}
              </div>
              <ul className="mt-4 divide-y divide-border/70">
                {s.pricing.components.map((c) => (
                  <li key={c.component} className="flex items-start gap-3 py-2.5">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.bps > 0 ? positiveColour(c.component) : "hsl(var(--success))" }} />
                    <div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{c.component}</p><p className="text-xs text-muted-foreground">{c.rationale}</p></div>
                    <span className={cn("numeric shrink-0 text-sm", c.bps < 0 && "text-success")}>{c.bps > 0 ? "+" : ""}{c.bps} bps</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t border-border pt-3 text-sm font-semibold"><span>All-in rate</span><span className="numeric">{s.pricing.suggested_rate.toFixed(2)}%</span></div>
            </SectionCard>
          </div>
        )}

        {tab === "governance" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <OverridePanel caseId={caseId} score={s} />
            <SectionCard title="Score versions" icon={History}>
              {history && history.length > 1 ? (
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={history} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <XAxis dataKey="version" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `v${v}`} />
                      <YAxis domain={["dataMin - 20", "dataMax + 20"]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                      <Line dataKey="credit_score" name="Final" stroke={toneHsl[scoreTone(s.credit_score)]} strokeWidth={2.5} dot={{ r: 4 }} />
                      <Line dataKey="model_score" name="Model" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 3" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-muted-foreground">Version {s.version} · {relativeTime(s.created_at)}. Add notes or edit financials and re-score to build history.</p>}
              <ul className="mt-4 divide-y divide-border/70">
                {[...(history ?? [])].reverse().map((h) => (
                  <li key={h.version} className="flex items-center gap-3 py-2 text-[13px]">
                    <span className="numeric w-8 font-semibold">v{h.version}</span>
                    <span className="numeric">{h.credit_score}</span>
                    <DecisionBadge decision={h.decision} />
                    <span className="ml-auto text-xs text-muted-foreground">{relativeTime(h.created_at)}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        )}
      </motion.div>

      <DecisionDialog open={decideOpen} onOpenChange={setDecideOpen} caseId={caseId} suggested={s.decision} />
      <EscalateDialog open={escalateOpen} onOpenChange={setEscalateOpen} caseId={caseId} />
    </div>
  );
}
