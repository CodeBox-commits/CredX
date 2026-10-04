"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, MinusCircle, RefreshCw, Sparkles, TrendingUp, XCircle } from "lucide-react";
import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { ContributionBars, ShapWaterfall } from "@/charts/shap-waterfall";
import { useCaseContext } from "@/components/case/case-context";
import { BlockSkeleton, DecisionBadge, EmptyState, SectionCard, StatusBadge, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, qk, useCaseAction, useOverrides, useScore, useScoreHistory } from "@/hooks/queries";
import { decisionLabel, formatCr, pct, relativeTime, titleCase } from "@/lib/format";
import { toneHsl } from "@/lib/tones";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";

const FIVE_C_TONE = (s: number): "success" | "primary" | "warning" | "destructive" => (s >= 75 ? "success" : s >= 55 ? "primary" : s >= 40 ? "warning" : "destructive");

function OverridePanel({ caseId }: { caseId: string }) {
  const { data: overrides } = useOverrides(caseId);
  const qc = useQueryClient();
  const { can, user } = useAuth();
  const [field, setField] = useState("decision");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const create = useMutation({
    mutationFn: () => api.overrides.create(caseId, { field, new_value: field === "recommended_amount" ? String(Number(value) * 1e7) : value, reason }),
    onSuccess: () => { toast.success("Override requested — awaiting credit manager review"); setValue(""); setReason(""); qc.invalidateQueries({ queryKey: qk.overrides(caseId) }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api.overrides.review(id, approve),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case", caseId] }); qc.invalidateQueries({ queryKey: ["cases"] }); toast.success("Override reviewed"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <SectionCard eyebrow="Maker–checker" title="Manual overrides" info="Analysts propose; a different credit manager approves. Every step is audited.">
      {can("analyst") && (
        <div className="mb-4 space-y-2 rounded-xl border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={field} onValueChange={(v) => { setField(v); setValue(""); }}>
              <SelectTrigger aria-label="Field to override"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="decision">Decision</SelectItem>
                <SelectItem value="recommended_amount">Amount (₹ Cr)</SelectItem>
                <SelectItem value="suggested_rate">Rate (%)</SelectItem>
              </SelectContent>
            </Select>
            {field === "decision" ? (
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger aria-label="New decision"><SelectValue placeholder="New decision" /></SelectTrigger>
                <SelectContent>{["APPROVE", "APPROVE_WITH_CONDITIONS", "REFER", "DECLINE"].map((d) => <SelectItem key={d} value={d}>{decisionLabel(d)}</SelectItem>)}</SelectContent>
              </Select>
            ) : <Input placeholder="New value" value={value} onChange={(e) => setValue(e.target.value)} aria-label="New value" />}
          </div>
          <Textarea rows={2} placeholder="Justification (min 10 characters)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Justification" />
          <Button size="sm" disabled={!value || reason.length < 10 || create.isPending} onClick={() => create.mutate()}>Request override</Button>
        </div>
      )}
      <ul className="space-y-2">
        {overrides?.map((o) => (
          <li key={o.id} className="rounded-lg border border-border p-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{titleCase(o.field)}</span>
              <span className="font-mono text-xs text-muted-foreground">{o.original_value} → {o.field === "recommended_amount" ? formatCr(Number(o.new_value)) : o.new_value}</span>
              <span className="ml-auto"><StatusBadge status={o.status === "pending" ? "queued" : o.status === "approved" ? "succeeded" : "failed"} /></span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{o.reason} — {o.requested_by?.full_name}, {relativeTime(o.created_at)}</p>
            {o.reviewed_by && <p className="text-xs text-muted-foreground">Reviewed by {o.reviewed_by.full_name}{o.review_comment ? `: ${o.review_comment}` : ""}</p>}
            {o.status === "pending" && can("credit_manager") && o.requested_by?.id !== user?.id && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => review.mutate({ id: o.id, approve: true })}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => review.mutate({ id: o.id, approve: false })}>Reject</Button>
              </div>
            )}
          </li>
        ))}
        {!overrides?.length && <p className="text-sm text-muted-foreground">No overrides on this case.</p>}
      </ul>
    </SectionCard>
  );
}

export default function DecisionPage() {
  const { caseId, watchJob } = useCaseContext();
  const { data: s, isLoading } = useScore(caseId);
  const { data: history } = useScoreHistory(caseId);
  const can = useAuth((st) => st.can);
  const rescore = useCaseAction(caseId, "rescore", (j) => watchJob(j.id));
  if (isLoading) return <BlockSkeleton className="h-96" />;
  if (!s) return <EmptyState icon={Sparkles} title="Not scored yet" description="Run analysis to generate an explainable credit decision." />;

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <SectionCard eyebrow={`Model ${s.model_version} · AUC ${s.model_metrics.auc ?? "—"}`} title="Score explanation (exact SHAP points)" className="xl:col-span-2"
        info="Each bar is a feature's TreeSHAP contribution converted to score points (PDO scaling), so the bars reconcile exactly to the score. Orange bars are qualitative overlays."
        actions={can("analyst") && <Button variant="outline" size="sm" onClick={() => rescore.mutate()} disabled={rescore.isPending}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Re-score</Button>}>
        <ShapWaterfall base={s.base_points} contributions={s.contributions} overlays={s.overlays} finalScore={s.credit_score} />
        <p className="mt-2 text-xs text-muted-foreground">
          Base {s.base_points} + features {s.model_score - s.base_points > 0 ? "+" : ""}{s.model_score - s.base_points} = model {s.model_score}
          {s.overlay_total ? `; overlays ${s.overlay_total > 0 ? "+" : ""}${s.overlay_total} → final ${s.credit_score}` : ""}
          {s.model_score + s.overlay_total !== s.credit_score && ` (bounded to the 300–900 scale from ${s.model_score + s.overlay_total})`} · PD {pct(s.probability_of_default, 2)}
        </p>
      </SectionCard>

      <SectionCard eyebrow="Recommendation" title="Decision & terms">
        <div className="flex items-center gap-2"><DecisionBadge decision={s.decision} /><span className="text-xs text-muted-foreground">Grade {s.rating} · approval likelihood {pct(s.approval_probability, 0)}</span></div>
        <ul className="mt-3 space-y-1 text-sm">{s.decision_reasons.map((r) => <li key={r}>• {r}</li>)}</ul>
        {s.conditions.length > 0 && (<>
          <p className="eyebrow mb-1.5 mt-4">Sanction conditions</p>
          <ul className="space-y-1 text-sm text-muted-foreground">{s.conditions.map((c) => <li key={c}>• {c}</li>)}</ul>
        </>)}
        {s.what_if.length > 0 && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary"><TrendingUp className="h-3.5 w-3.5" />Path to a better score (what-if)</p>
            <ul className="space-y-1 text-sm">{s.what_if.map((w) => <li key={w.feature} className="flex justify-between gap-2"><span>{w.label}: {w.current} → {w.target}</span><span className="numeric text-success">+{w.score_gain}</span></li>)}</ul>
          </div>
        )}
      </SectionCard>

      <SectionCard eyebrow="All features" title="Feature contributions">
        <ContributionBars contributions={s.contributions} />
        <p className="mt-3 text-xs text-muted-foreground">Italic values were missing from the documents; the model routes them down learned default branches rather than imputing.</p>
      </SectionCard>

      <SectionCard eyebrow="Overlays" title="Qualitative adjustments" bodyClassName="p-0">
        <ul className="divide-y divide-border">
          {s.overlays.map((o, i) => (
            <li key={i} className="px-5 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <ToneBadge tone={o.source === "analyst_note" ? "accent" : "warning"}>{o.source === "analyst_note" ? "Analyst note" : "Document flag"}</ToneBadge>
                <span className={`numeric ml-auto font-semibold ${o.points < 0 ? "text-destructive" : "text-success"}`}>{o.points > 0 ? "+" : ""}{o.points}</span>
              </div>
              <p className="mt-1 font-medium">{o.label}</p>
              <p className="text-xs text-muted-foreground">{o.rationale}</p>
            </li>
          ))}
          {!s.overlays.length && <li className="px-5 py-6 text-center text-sm text-muted-foreground">No overlays — the score is the pure model output.</li>}
        </ul>
      </SectionCard>

      <SectionCard eyebrow="Credit policy" title="Rule book" bodyClassName="p-0">
        <ul className="divide-y divide-border">
          {s.policy.rules.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-5 py-2 text-sm">
              {r.status === "pass" ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : r.status === "fail" ? (r.kind === "knockout" ? <CircleSlash className="mt-0.5 h-4 w-4 text-destructive" /> : <XCircle className="mt-0.5 h-4 w-4 text-warning" />) : <MinusCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="truncate"><span className="font-mono text-xs text-muted-foreground">{r.id}</span> {r.name}</p>
                <p className="text-xs text-muted-foreground">req {r.threshold} · actual {r.actual ?? "n/a"}</p>
              </div>
              {r.status === "fail" && <ToneBadge tone={r.kind === "knockout" ? "destructive" : "warning"}>{r.kind}</ToneBadge>}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard eyebrow="Five Cs of credit" title="Structured assessment" className="xl:col-span-3">
        <div className="grid gap-3 md:grid-cols-5">
          {Object.entries(s.five_cs).map(([k, c]) => (
            <div key={k} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between"><p className="font-display font-semibold capitalize">{k}</p><ToneBadge tone={FIVE_C_TONE(c.score)}>{c.assessment}</ToneBadge></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${c.score}%`, background: toneHsl[FIVE_C_TONE(c.score)] }} /></div>
              <p className="numeric mt-1 text-xs text-muted-foreground">{c.score}/100 · model {c.model_points > 0 ? "+" : ""}{c.model_points}{c.overlay_points ? `, overlay ${c.overlay_points > 0 ? "+" : ""}${c.overlay_points}` : ""}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{c.evidence.slice(0, 4).map((e) => <li key={e}>• {e}</li>)}</ul>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Loan sizing" title={`Recommended ${formatCr(s.loan_sizing.recommended_amount)}`} bodyClassName="p-0">
        <ul className="divide-y divide-border">
          {s.loan_sizing.methods.map((m) => (
            <li key={m.method} className={`px-5 py-2.5 text-sm ${m.binding ? "bg-primary/5" : ""}`}>
              <div className="flex justify-between gap-2"><span className="font-medium">{m.method}{m.binding && <ToneBadge tone="primary" className="ml-2">binding</ToneBadge>}</span><span className="numeric">{formatCr(m.limit)}</span></div>
              <p className="text-xs text-muted-foreground">{m.basis}</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard eyebrow="Risk-based pricing" title={`${s.pricing.suggested_rate}% p.a.`} bodyClassName="p-0">
        <ul className="divide-y divide-border">
          {s.pricing.components.map((c) => (
            <li key={c.component} className="flex items-start justify-between gap-3 px-5 py-2.5 text-sm">
              <div><p className="font-medium">{c.component}</p><p className="text-xs text-muted-foreground">{c.rationale}</p></div>
              <span className={`numeric shrink-0 ${c.bps < 0 ? "text-success" : ""}`}>{c.bps > 0 ? "+" : ""}{c.bps} bps</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="space-y-5">
        <SectionCard eyebrow="History" title="Score versions">
          {history && history.length > 1 ? (
            <div className="h-40">
              <ResponsiveContainer>
                <LineChart data={history}>
                  <XAxis dataKey="version" tick={{ fontSize: 10 }} />
                  <YAxis domain={["dataMin - 20", "dataMax + 20"]} tick={{ fontSize: 10 }} width={34} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Line dataKey="credit_score" name="Final" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                  <Line dataKey="model_score" name="Model" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-muted-foreground">Version {s.version} · {relativeTime(s.created_at)}. Add notes or edit financials and re-score to build history.</p>}
        </SectionCard>
        <OverridePanel caseId={caseId} />
      </div>
    </div>
  );
}
