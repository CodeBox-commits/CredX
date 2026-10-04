import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Slider } from "@/components/ui/slider";
import { RiskGauge } from "@/components/RiskGauge";
import { AIInsightCard } from "@/components/AIInsightCard";
import { WorkspaceSyncBanner } from "@/components/WorkspaceSyncBanner";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

const FIVE_C_LABELS = {
  character: "Character",
  capacity: "Capacity",
  capital: "Capital",
  collateral: "Collateral",
  conditions: "Conditions",
} as const;

function mapFiveCs(
  fiveCs: Record<string, number>,
) {
  return Object.entries(fiveCs).map(([key, value]) => ({
    metric: FIVE_C_LABELS[key as keyof typeof FIVE_C_LABELS] ?? key,
    score: Math.round(value),
  }));
}

function mapFeatureImportance(
  factors: Array<{ label: string; contribution: number; impact: "positive" | "negative" }>,
) {
  return factors.map((factor) => ({
    feature: factor.label,
    importance: Math.max(16, Math.min(96, Math.round(Math.abs(factor.contribution)))),
    impact: factor.impact,
  }));
}

function mapDecisionTrace(
  factors: Array<{
    label: string;
    impact: "positive" | "negative";
    contribution: number;
    detail: string;
  }>,
) {
  return factors.map((factor) => ({
    title: factor.label,
    impact: factor.impact,
    weight: Math.round(Math.abs(factor.contribution)),
    detail: factor.detail,
  }));
}

const CreditRisk = () => {
  const {
    workspace,
    analysis,
    setDueDiligenceNote,
    setRequestedAmountCr,
    syncPlatformAnalysis,
  } = useWorkspace();
  const liveDecision = analysis.bundle?.decision;
  const recommendation = liveDecision
    ? {
        decision: liveDecision.decision,
        requestedAmountCr: workspace.requestedAmountCr,
        recommendedAmountCr: liveDecision.recommended_loan_amount,
        rate: liveDecision.suggested_interest_rate,
        tenor:
          liveDecision.decision === "APPROVE"
            ? "36 months"
            : liveDecision.decision === "CONDITIONAL APPROVAL"
              ? "24 months"
              : "Declined",
        rationale: liveDecision.pricing_rationale,
        covenants: workspace.recommendation.covenants,
      }
    : workspace.recommendation;
  const liveFiveCs = liveDecision
    ? mapFiveCs(liveDecision.five_cs)
    : workspace.fiveCs;
  const liveFeatureImportance = liveDecision
    ? mapFeatureImportance(liveDecision.factors)
    : workspace.featureImportance;
  const liveDecisionTrace = liveDecision
    ? mapDecisionTrace(liveDecision.factors)
    : workspace.decisionTrace;
  const [loanAmount, setLoanAmount] = useState([workspace.requestedAmountCr]);
  const [collateralCoverage, setCollateralCoverage] = useState([180]);
  const [interestRate, setInterestRate] = useState([recommendation.rate]);
  const [noteDraft, setNoteDraft] = useState(workspace.dueDiligenceNote);

  useEffect(() => {
    setLoanAmount([workspace.requestedAmountCr]);
    setInterestRate([recommendation.rate]);
    setNoteDraft(workspace.dueDiligenceNote);
  }, [
    workspace.requestedAmountCr,
    recommendation.rate,
    workspace.dueDiligenceNote,
  ]);

  const radarData = liveFiveCs.map((item) => ({
    metric: item.metric,
    score: item.score,
  }));

  const modelScore = liveDecision?.credit_score ?? workspace.overallScore;
  const approvalProbability =
    liveDecision?.approval_probability ?? clamp((modelScore - 300) / 600, 0.08, 0.97);
  const riskScore = Math.round(((modelScore - 300) / 600) * 100);
  const baseDefault = clamp((900 - modelScore) / 1200, 0.02, 0.24);
  const adjustedDefault = clamp(
    baseDefault +
      (loanAmount[0] - recommendation.recommendedAmountCr) * 0.0015 -
      (collateralCoverage[0] - 150) * 0.0008 -
      (interestRate[0] - recommendation.rate) * 0.002,
    0.01,
    0.45,
  );
  const scenarioRiskScore = clamp(
    Math.round(100 - adjustedDefault * 190),
    18,
    96,
  );
  const expectedReturn = (
    (interestRate[0] / 100) *
    (1 - adjustedDefault) *
    loanAmount[0]
  ).toFixed(1);

  const handleApplyNote = () => {
    setRequestedAmountCr(loanAmount[0]);
    setDueDiligenceNote(noteDraft);
    void syncPlatformAnalysis({
      requestedAmountCr: loanAmount[0],
      dueDiligenceNote: noteDraft,
    });
  };

  return (
    <div className="page-shell space-y-6">
      <div>
        <h1 className="text-xl font-bold">Credit Risk Analytics</h1>
        <p className="mt-0.5 text-xs font-mono text-muted-foreground">
          EXPLAINABLE AI CREDIT RECOMMENDATION | FIVE Cs | PRIMARY INSIGHT INTEGRATION
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Shared model score {modelScore}/900, grade {workspace.creditModel.grade}, readiness {workspace.creditModel.readiness}% from the latest ingestion run.
        </p>
        <div className="mt-3">
          <WorkspaceSyncBanner
            status={analysis.status}
            message={analysis.message}
            updated_at={analysis.updated_at}
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-warning/30 bg-card p-4"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex justify-center">
            <RiskGauge score={riskScore} label="Overall" size="md" />
          </div>
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-mono",
                  recommendation.decision === "APPROVE"
                    ? "border border-success/30 bg-success/20 text-success"
                    : recommendation.decision === "CONDITIONAL APPROVAL"
                      ? "border border-warning/30 bg-warning/20 text-warning"
                      : "border border-destructive/30 bg-destructive/20 text-destructive",
                )}
              >
                {recommendation.decision}
              </span>
            </div>
            <p className="mb-1 text-sm font-medium">
              Recommendation for {workspace.companyName}
            </p>
            <p className="text-xs text-muted-foreground">
              Requested:{" "}
              <span className="font-mono text-primary numeric tabular-nums">
                Rs {recommendation.requestedAmountCr} Cr
              </span>{" "}
              | Recommended:{" "}
              <span className="font-mono text-primary numeric tabular-nums">
                Rs {recommendation.recommendedAmountCr} Cr
              </span>{" "}
              | Rate:{" "}
              <span className="font-mono text-primary numeric tabular-nums">
                {recommendation.rate}%
              </span>{" "}
              | Tenor:{" "}
              <span className="font-mono text-primary">
                {recommendation.tenor}
              </span>
            </p>
            <div className="mt-3 rounded bg-secondary/50 p-3">
              <p className="text-[10px] font-mono text-muted-foreground">
                AI REASONING
              </p>
              <p className="mt-1 text-xs text-foreground">
                {recommendation.rationale}
              </p>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
              <div>
                Approval probability:{" "}
                <span className="font-mono text-primary">
                  {(approvalProbability * 100).toFixed(0)}%
                </span>
              </div>
              <div>
                Top risk factors:{" "}
                <span className="text-foreground">
                  {liveDecision?.top_risk_factors.join(", ") || "Local model synthesis"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Five Cs of Credit
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(222, 30%, 16%)" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fontSize: 9, fill: "hsl(215, 20%, 55%)" }}
              />
              <Radar
                dataKey="score"
                stroke="hsl(187, 85%, 53%)"
                fill="hsl(187, 85%, 53%)"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-2">
            {liveFiveCs.map((metric) => (
              <div key={metric.metric} className="flex items-center gap-2">
                <div className="w-16 text-[10px] font-mono text-muted-foreground">
                  {metric.metric}
                </div>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.score}%` }}
                    transition={{ duration: 1 }}
                    className={cn(
                      "h-full rounded-full",
                      metric.score >= 70
                        ? "bg-success"
                        : metric.score >= 50
                          ? "bg-warning"
                          : "bg-destructive",
                    )}
                  />
                </div>
                <span className="w-6 text-right text-[10px] font-mono">
                  {metric.score}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Explainable AI - Feature Importance
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={liveFeatureImportance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="feature"
                width={100}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip />
              <Bar dataKey="importance" fill="hsl(var(--primary))" radius={6} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-destructive/70" />
              <span className="text-[9px] text-muted-foreground">
                Risk Contributor
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-success/70" />
              <span className="text-[9px] text-muted-foreground">
                Positive Factor
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-lg border border-primary/20 bg-card p-4"
        >
          <p className="mb-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Credit Risk Simulator
          </p>
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Loan Amount
                </span>
                <span className="font-mono text-xs text-primary numeric tabular-nums">
                  Rs {loanAmount[0]} Cr
                </span>
              </div>
              <Slider
                value={loanAmount}
                onValueChange={setLoanAmount}
                min={40}
                max={300}
                step={10}
                className="[&_[role=slider]]:bg-primary"
              />
            </div>
            <div>
              <div className="mb-2 flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Collateral Coverage
                </span>
                <span className="font-mono text-xs text-primary numeric tabular-nums">
                  {collateralCoverage[0]}%
                </span>
              </div>
              <Slider
                value={collateralCoverage}
                onValueChange={setCollateralCoverage}
                min={90}
                max={260}
                step={10}
                className="[&_[role=slider]]:bg-primary"
              />
            </div>
            <div>
              <div className="mb-2 flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Interest Rate
                </span>
                <span className="font-mono text-xs text-primary numeric tabular-nums">
                  {interestRate[0]}%
                </span>
              </div>
              <Slider
                value={interestRate}
                onValueChange={setInterestRate}
                min={8}
                max={18}
                step={0.5}
                className="[&_[role=slider]]:bg-primary"
              />
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Prob. of Default
                </span>
                <span
                  className={cn(
                    "text-sm font-bold font-mono numeric tabular-nums",
                        adjustedDefault < 0.05
                          ? "text-success"
                          : adjustedDefault < 0.1
                        ? "text-warning"
                        : "text-destructive",
                  )}
                >
                  {(adjustedDefault * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Risk Score
                </span>
                <span
                  className={cn(
                    "text-sm font-bold font-mono numeric tabular-nums",
                    scenarioRiskScore >= 70
                      ? "text-success"
                      : scenarioRiskScore >= 50
                        ? "text-warning"
                        : "text-destructive",
                  )}
                >
                  {scenarioRiskScore}/100
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Expected Return
                </span>
                <span className="text-sm font-bold font-mono text-primary numeric tabular-nums">
                  Rs {expectedReturn} Cr
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-lg border border-border bg-card p-4"
      >
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Due Diligence Integration - Qualitative Observations
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              className="h-28 w-full resize-none rounded-md border border-border bg-secondary/50 p-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/50"
              placeholder="Add site visit observations, management notes, or other primary credit officer insights..."
            />
            <button
              onClick={handleApplyNote}
              className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Submit & Adjust Risk Score
            </button>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Primary Insight Impact
              </p>
              <div className="space-y-3">
                {workspace.primaryAdjustments.map((adjustment) => (
                  <div key={adjustment.label} className="rounded-md border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        {adjustment.label}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-mono",
                          adjustment.delta > 0
                            ? "text-success"
                            : adjustment.delta < 0
                              ? "text-destructive"
                              : "text-muted-foreground",
                        )}
                      >
                        {adjustment.delta > 0 ? "+" : ""}
                        {adjustment.delta}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {adjustment.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {workspace.aiInsights.slice(0, 2).map((insight) => (
              <AIInsightCard
                key={insight.title}
                title={insight.title}
                insight={insight.insight}
                severity={insight.severity}
                tags={insight.tags}
              />
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Decision Trace
          </p>
          <div className="space-y-3">
            {liveDecisionTrace.map((item) => (
              <div key={item.title} className="rounded-md border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {item.title}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-mono",
                      item.impact === "positive" ? "text-success" : "text-destructive",
                    )}
                  >
                    {item.impact.toUpperCase()} | {item.weight}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Structured Synthesis Snapshot
          </p>
          <div className="space-y-3">
            {workspace.structuredSynthesis.map((item) => (
              <div key={item.label} className="rounded-md border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-mono uppercase",
                      item.status === "healthy"
                        ? "text-success"
                        : item.status === "pending"
                          ? "text-muted-foreground"
                          : item.status === "watch"
                            ? "text-warning"
                            : "text-destructive",
                    )}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-primary">{item.value}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.explanation}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default CreditRisk;
