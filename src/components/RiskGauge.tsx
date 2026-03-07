import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface RiskGaugeProps {
  score: number;
  label: string;
  maxScore?: number;
  size?: "sm" | "md" | "lg";
}

export const RiskGauge = ({ score, label, maxScore = 100, size = "md" }: RiskGaugeProps) => {
  const percentage = (score / maxScore) * 100;
  const radius = size === "sm" ? 35 : size === "md" ? 50 : 65;
  const strokeWidth = size === "sm" ? 4 : 6;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const filledLength = arcLength * (percentage / 100);
  const svgSize = (radius + strokeWidth) * 2;

  const getColor = () => {
    if (percentage >= 75) return "text-success";
    if (percentage >= 50) return "text-primary";
    if (percentage >= 25) return "text-warning";
    return "text-destructive";
  };

  const getStrokeColor = () => {
    if (percentage >= 75) return "hsl(var(--success))";
    if (percentage >= 50) return "hsl(var(--primary))";
    if (percentage >= 25) return "hsl(var(--warning))";
    return "hsl(var(--destructive))";
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={svgSize} height={svgSize} className="transform -rotate-[135deg]">
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
        />
        <motion.circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filledLength} ${circumference}`}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${filledLength} ${circumference}` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="text-center -mt-6">
        <p className={cn("text-xl font-bold font-mono numeric tabular-nums", getColor())}>{score}</p>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
    </div>
  );
};
