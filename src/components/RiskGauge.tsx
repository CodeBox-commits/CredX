import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell } from "recharts";

interface RiskGaugeProps {
  score: number;
  label: string;
  minScore?: number;
  maxScore?: number;
  size?: "sm" | "md" | "lg";
}

export const RiskGauge = ({ score, label, minScore = 300, maxScore = 900, size = "md" }: RiskGaugeProps) => {
  // Backward compatible normalization for legacy 0-100 score callers.
  const normalizedScore = score <= 100 ? Math.round(minScore + (score / 100) * (maxScore - minScore)) : score;
  const clampedScore = Math.max(minScore, Math.min(maxScore, normalizedScore));
  const percentage = ((clampedScore - minScore) / (maxScore - minScore)) * 100;

  const gaugeColor = (() => {
    if (clampedScore >= 750) return "hsl(var(--success))";
    if (clampedScore >= 650) return "hsl(var(--warning))";
    return "hsl(var(--destructive))";
  })();

  const tierText = (() => {
    if (clampedScore >= 750) return "Low Risk";
    if (clampedScore >= 650) return "Medium Risk";
    return "High Risk";
  })();

  const sizeMap = {
    sm: { width: 210, height: 125, outerRadius: 84, innerRadius: 66, scoreClass: "text-2xl" },
    md: { width: 260, height: 155, outerRadius: 102, innerRadius: 80, scoreClass: "text-3xl" },
    lg: { width: 320, height: 190, outerRadius: 124, innerRadius: 98, scoreClass: "text-4xl" },
  };
  const config = sizeMap[size];

  const gaugeData = [
    { name: "score", value: percentage },
    { name: "remaining", value: 100 - percentage },
  ];

  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="relative">
        <PieChart width={config.width} height={config.height}>
          <Pie
            data={[
              { name: "low", value: 33.34 },
              { name: "medium", value: 33.33 },
              { name: "high", value: 33.33 },
            ]}
            dataKey="value"
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={config.innerRadius}
            outerRadius={config.outerRadius}
            strokeWidth={0}
          >
            <Cell fill="hsl(var(--destructive))" />
            <Cell fill="hsl(var(--warning))" />
            <Cell fill="hsl(var(--success))" />
          </Pie>
          <Pie
            data={gaugeData}
            dataKey="value"
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={config.innerRadius - 10}
            outerRadius={config.outerRadius - 8}
            strokeWidth={0}
          >
            <Cell fill={gaugeColor} />
            <Cell fill="hsl(var(--muted))" />
          </Pie>
        </PieChart>
        <div className="absolute inset-x-0 top-[42%] text-center">
          <p className={cn("font-bold text-foreground numeric tabular-nums leading-none", config.scoreClass)}>{clampedScore}</p>
          <p className="mt-1 text-[11px] font-semibold text-primary">{tierText}</p>
        </div>
      </div>
      <div className="mt-1 flex w-full items-center justify-between text-[10px] font-medium text-muted-foreground">
        <span className="numeric tabular-nums">{minScore}</span>
        <span className="uppercase tracking-wide text-foreground">{label}</span>
        <span className="numeric tabular-nums">{maxScore}</span>
      </div>
    </div>
  );
};
