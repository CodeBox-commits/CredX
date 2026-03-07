import { motion } from "framer-motion";
import { RiskGauge } from "@/components/RiskGauge";
import { AIInsightCard } from "@/components/AIInsightCard";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const fiveCsData = [
  { metric: "Character", score: 72, detail: "Clean promoter background, minor regulatory history" },
  { metric: "Capacity", score: 58, detail: "DSCR 1.45x, declining capacity utilization at 62%" },
  { metric: "Capital", score: 75, detail: "Net worth Rs 340 Cr, reasonable leverage at 1.87x D/E" },
  { metric: "Collateral", score: 85, detail: "Primary: Plant & machinery Rs 520 Cr, Collateral coverage 1.8x" },
  { metric: "Conditions", score: 48, detail: "Infrastructure sector under stress, rising input costs" },
];

const featureImportance = [
  { feature: "DSCR Ratio", importance: 92, impact: "negative" },
  { feature: "Promoter Pledge %", importance: 85, impact: "negative" },
  { feature: "Revenue Growth", importance: 78, impact: "positive" },
  { feature: "Litigation Count", importance: 72, impact: "negative" },
  { feature: "Sector NPA Rate", importance: 68, impact: "negative" },
  { feature: "Collateral Coverage", importance: 65, impact: "positive" },
  { feature: "Cash Flow Trend", importance: 58, impact: "positive" },
  { feature: "GST Compliance", importance: 52, impact: "negative" },
];

const radarData = fiveCsData.map((d) => ({ metric: d.metric, score: d.score }));

const CreditRisk = () => {
  const [loanAmount, setLoanAmount] = useState([150]);
  const [collateralCoverage, setCollateralCoverage] = useState([180]);
  const [interestRate, setInterestRate] = useState([12]);

  const baseDefault = 0.08;
  const adjustedDefault = Math.max(0.01, Math.min(0.99,
    baseDefault + (loanAmount[0] - 150) * 0.001 - (collateralCoverage[0] - 100) * 0.0005 - (interestRate[0] - 10) * 0.002
  ));
  const riskScore = Math.round(100 - adjustedDefault * 100 * 5);
  const expectedReturn = ((interestRate[0] / 100) * (1 - adjustedDefault) * loanAmount[0]).toFixed(1);

  return (
    <div className="page-shell space-y-6">
      <div>
        <h1 className="text-xl font-bold">Credit Risk Analytics</h1>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          EXPLAINABLE AI CREDIT RECOMMENDATION | FIVE Cs | RISK SIMULATION
        </p>
      </div>

      {/* AI Recommendation Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-lg border border-warning/30 glow-warning p-4"
      >
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <RiskGauge score={67} label="Overall" size="md" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-warning/20 text-warning border border-warning/30">
                CONDITIONAL APPROVAL
              </span>
            </div>
            <p className="text-sm font-medium mb-1">AI Recommendation: Approve with Conditions</p>
            <p className="text-xs text-muted-foreground">
              Recommended Amount: <span className="text-primary font-mono numeric tabular-nums">Rs 120 Cr</span> (Requested: Rs 200 Cr) |
              Risk-Adjusted Rate: <span className="text-primary font-mono numeric tabular-nums">12.5%</span> |
              Tenor: <span className="text-primary font-mono">5 Years</span>
            </p>
            <div className="mt-2 p-2 rounded bg-secondary/50 border border-border">
              <p className="text-[10px] font-mono text-muted-foreground">AI REASONING</p>
              <p className="text-xs text-foreground mt-1">
                "Loan limit reduced due to high litigation exposure and declining capacity utilization despite strong GST flows. Collateral coverage adequate for reduced amount. Recommend quarterly monitoring covenants."
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Five Cs Assessment */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-lg border border-border p-4"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Five Cs of Credit
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(222, 30%, 16%)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "hsl(215, 20%, 55%)" }} />
              <Radar dataKey="score" stroke="hsl(187, 85%, 53%)" fill="hsl(187, 85%, 53%)" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {fiveCsData.map((c) => (
              <div key={c.metric} className="flex items-center gap-2">
                <div className="w-12 text-[10px] font-mono text-muted-foreground">{c.metric}</div>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${c.score}%` }}
                    transition={{ duration: 1 }}
                    className={cn(
                      "h-full rounded-full",
                      c.score >= 70 ? "bg-success" : c.score >= 50 ? "bg-warning" : "bg-destructive"
                    )}
                  />
                </div>
                <span className="text-[10px] font-mono w-6 text-right">{c.score}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Explainable AI Panel */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-lg border border-border p-4"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Explainable AI - Feature Importance
          </p>
          <div className="space-y-2">
            {featureImportance.map((f, i) => (
              <motion.div
                key={f.feature}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2"
              >
                <div className="w-28 text-[10px] text-muted-foreground truncate">{f.feature}</div>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      f.impact === "negative" ? "bg-destructive/70" : "bg-success/70"
                    )}
                    style={{ width: `${f.importance}%` }}
                  />
                </div>
                <span className={cn(
                  "text-[10px] font-mono w-10 text-right numeric tabular-nums",
                  f.impact === "negative" ? "text-destructive" : "text-success"
                )}>
                  {f.importance}%
                </span>
              </motion.div>
            ))}
          </div>
          <div className="flex gap-3 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-destructive/70" />
              <span className="text-[9px] text-muted-foreground">Risk Contributor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-success/70" />
              <span className="text-[9px] text-muted-foreground">Positive Factor</span>
            </div>
          </div>
        </motion.div>

        {/* Credit Risk Simulator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-lg border border-primary/20 glow-primary p-4"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Credit Risk Simulator
          </p>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-xs text-muted-foreground">Loan Amount</span>
                <span className="text-xs font-mono text-primary numeric tabular-nums">Rs {loanAmount[0]} Cr</span>
              </div>
              <Slider value={loanAmount} onValueChange={setLoanAmount} min={50} max={300} step={10} className="[&_[role=slider]]:bg-primary" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-xs text-muted-foreground">Collateral Coverage</span>
                <span className="text-xs font-mono text-primary numeric tabular-nums">{collateralCoverage[0]}%</span>
              </div>
              <Slider value={collateralCoverage} onValueChange={setCollateralCoverage} min={80} max={300} step={10} className="[&_[role=slider]]:bg-primary" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-xs text-muted-foreground">Interest Rate</span>
                <span className="text-xs font-mono text-primary numeric tabular-nums">{interestRate[0]}%</span>
              </div>
              <Slider value={interestRate} onValueChange={setInterestRate} min={8} max={18} step={0.5} className="[&_[role=slider]]:bg-primary" />
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Prob. of Default</span>
                <span className={cn(
                  "text-sm font-mono font-bold numeric tabular-nums",
                  adjustedDefault < 0.05 ? "text-success" : adjustedDefault < 0.1 ? "text-warning" : "text-destructive"
                )}>
                  {(adjustedDefault * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Risk Score</span>
                <span className={cn(
                  "text-sm font-mono font-bold numeric tabular-nums",
                  riskScore >= 70 ? "text-success" : riskScore >= 50 ? "text-warning" : "text-destructive"
                )}>
                  {Math.max(0, Math.min(100, riskScore))}/100
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Expected Return</span>
                <span className="text-sm font-mono font-bold text-primary numeric tabular-nums">Rs {expectedReturn} Cr</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Due Diligence Input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
          className="bg-card rounded-lg border border-border p-4"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Due Diligence Integration - Qualitative Observations
          </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <textarea
              className="w-full h-24 bg-secondary/50 rounded-md border border-border p-3 text-xs resize-none outline-none focus:border-primary/50 placeholder:text-muted-foreground"
              placeholder="Add site visit observations... e.g., 'Factory operating at 40% capacity. Inventory appears aged. Workers on reduced shifts.'"
              defaultValue="Factory operating at 40% capacity. Significant inventory pile-up observed. Management cited seasonal demand fluctuation but sector data does not support this claim."
            />
            <button className="mt-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium">
              Submit & Adjust Risk Score
            </button>
          </div>
          <div>
            <AIInsightCard
              title="Due Diligence Impact"
              insight="Site visit observation indicates capacity underutilization inconsistent with management projections. AI has adjusted capacity score from 62 to 48 and overall credit score reduced by 8 points."
              severity="warning"
              tags={["SITE VISIT", "CAPACITY", "ADJUSTMENT"]}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreditRisk;
