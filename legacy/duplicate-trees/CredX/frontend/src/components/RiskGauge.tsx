import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell } from "recharts";

interface RiskGaugeProps {
  score: number;
  label: string;
  minScore?: number;
  maxScore?: number;
  size?: "sm" | "md" | "lg";
}

export const RiskGauge = ({
  score,
  label,
  minScore = 300,
  maxScore = 900,
  size = "md",
}: RiskGaugeProps) => {
  const normalizedScore =
    score <= 100
      ? Math.round(minScore + (score / 100) * (maxScore - minScore))
      : score;
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

  const gradeText = (() => {
    if (clampedScore >= 780) return "A";
    if (clampedScore >= 720) return "B";
    if (clampedScore >= 660) return "C";
    if (clampedScore >= 600) return "D";
    return "E";
  })();

  const sizeMap = {
    sm: {
      width: 212,
      height: 128,
      outerRadius: 84,
      innerRadius: 68,
      scoreClass: "text-3xl",
      shellPadding: "p-4",
    },
    md: {
      width: 262,
      height: 158,
      outerRadius: 102,
      innerRadius: 82,
      scoreClass: "text-4xl",
      shellPadding: "p-5",
    },
    lg: {
      width: 322,
      height: 194,
      outerRadius: 124,
      innerRadius: 100,
      scoreClass: "text-5xl",
      shellPadding: "p-6",
    },
  };
  const config = sizeMap[size];

  const gaugeData = [
    { name: "score", value: percentage },
    { name: "remaining", value: 100 - percentage },
  ];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,248,253,0.92))] shadow-[0_22px_60px_rgba(15,23,42,0.08)]",
        config.shellPadding,
      )}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-b-[28px] bg-[radial-gradient(circle_at_top,rgba(17,102,182,0.18),transparent_68%)]" />
      <div className="relative flex flex-col items-center">
        <div className="flex w-full items-start justify-between gap-3">
          <div>
            <p className="section-eyebrow text-[10px]">Risk Signal</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{label}</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Grade {gradeText}
          </div>
        </div>

        <div className="relative mt-2">
          <PieChart width={config.width} height={config.height}>
            <Pie
              data={[
                { name: "high", value: 33.33 },
                { name: "medium", value: 33.33 },
                { name: "low", value: 33.34 },
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
              <Cell fill="rgba(230, 77, 77, 0.15)" />
              <Cell fill="rgba(245, 158, 11, 0.16)" />
              <Cell fill="rgba(16, 185, 129, 0.18)" />
            </Pie>
            <Pie
              data={gaugeData}
              dataKey="value"
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={config.innerRadius - 9}
              outerRadius={config.outerRadius - 7}
              strokeWidth={0}
            >
              <Cell fill={gaugeColor} />
              <Cell fill="rgba(227, 232, 240, 0.75)" />
            </Pie>
          </PieChart>

          <div className="absolute inset-x-0 top-[40%] text-center">
            <p
              className={cn(
                "numeric font-semibold leading-none text-slate-950",
                config.scoreClass,
              )}
            >
              {clampedScore}
            </p>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.26em] text-slate-500">
              {tierText}
            </p>
          </div>
        </div>

        <div className="mt-1 grid w-full grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Floor</p>
            <p className="mt-1 text-sm font-semibold text-slate-700 numeric">{minScore}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-950 px-3 py-2 text-white">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Band</p>
            <p className="mt-1 text-sm font-semibold">{tierText}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Ceiling</p>
            <p className="mt-1 text-sm font-semibold text-slate-700 numeric">{maxScore}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
