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
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

const CreditRisk = () => {
  const { workspace, setDueDiligenceNote, setRequestedAmountCr } = useWorkspace();
  const [loanAmount, setLoanAmount] = useState([workspace.requestedAmountCr]);
  const [collateralCoverage, setCollateralCoverage] = useState([180]);
  const [interestRate, setInterestRate] = useState([workspace.recommendation.rate]);
  const [noteDraft, setNoteDraft] = useState(workspace.dueDiligenceNote);

  useEffect(() => {
    setLoanAmount([workspace.requestedAmountCr]);
    setInterestRate([workspace.recommendation.rate]);
    setNoteDraft(workspace.dueDiligenceNote);
  }, [
    workspace.requestedAmountCr,
    workspace.recommendation.rate,
    workspace.dueDiligenceNote,
  ]);

  const radarData = workspace.fiveCs.map((item) => ({
    metric: item.metric,
    score: item.score,
  }));

  const riskScore = Math.round(((workspace.overallScore - 300) / 600) * 100);
  const baseDefault = clamp((900 - workspace.overallScore) / 1200, 0.02, 0.24);
  const adjustedDefault = clamp(
    baseDefault +
      (loanAmount[0] - workspace.recommendation.recommendedAmountCr) * 0.0015 -
      (collateralCoverage[0] - 150) * 0.0008 -
      (interestRate[0] - workspace.recommendation.rate) * 0.002,
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
  };

  return (
    <div className="page-shell space-y-6">
      <div>
        <h1 className="text-xl font-bold">Credit Risk Analytics</h1>
        <p className="mt-0.5 text-xs font-mono text-muted-foreground">
          EXPLAINABLE AI CREDIT RECOMMENDATION | FIVE Cs | PRIMARY INSIGHT INTEGRATION
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Shared model score {workspace.creditModel.score}/900, grade {workspace.creditModel.grade}, readiness {workspace.creditModel.readiness}% from the latest ingestion run.
        </p>
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
                  workspace.recommendation.decision === "APPROVE"
                    ? "border border-success/30 bg-success/20 text-success"
                    : workspace.recommendation.decision === "CONDITIONAL APPROVAL"
                      ? "border border-warning/30 bg-warning/20 text-warning"
                      : "border border-destructive/30 bg-destructive/20 text-destructive",
                )}
              >
                {workspace.recommendation.decision}
              </span>
            </div>
            <p className="mb-1 text-sm font-medium">
              Recommendation for {workspace.companyName}
            </p>
            <p className="text-xs text-muted-foreground">
              Requested:{" "}
              <span className="font-mono text-primary numeric tabular-nums">
                Rs {workspace.recommendation.requestedAmountCr} Cr
              </span>{" "}
              | Recommended:{" "}
              <span className="font-mono text-primary numeric tabular-nums">
                Rs {workspace.recommendation.recommendedAmountCr} Cr
              </span>{" "}
              | Rate:{" "}
              <span className="font-mono text-primary numeric tabular-nums">
                {workspace.recommendation.rate}%
              </span>{" "}
              | Tenor:{" "}
              <span className="font-mono text-primary">
                {workspace.recommendation.tenor}
              </span>
            </p>
            <div className="mt-3 rounded bg-secondary/50 p-3">
              <p className="text-[10px] font-mono text-muted-foreground">
                AI REASONING
              </p>
              <p className="mt-1 text-xs text-foreground">
                {workspace.recommendation.rationale}
              </p>
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
            {workspace.fiveCs.map((metric) => (
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
            <BarChart data={workspace.featureImportance} layout="vertical">
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
          <div className="space-y-2">
            {workspace.aiInsights.map((insight) => (
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
    </div>
  );
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default CreditRisk;
