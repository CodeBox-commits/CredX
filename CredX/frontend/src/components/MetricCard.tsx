import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  subtitle?: string;
  glowColor?: "primary" | "success" | "warning" | "destructive";
}

export const MetricCard = ({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  subtitle,
  glowColor = "primary",
}: MetricCardProps) => {
  const cardAccentClasses = {
    primary: "border-primary/25",
    success: "border-success/25",
    warning: "border-warning/35",
    destructive: "border-destructive/30",
  };

  const iconBgClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-accent/15 text-accent",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative h-full overflow-hidden rounded-[24px] border bg-white/[0.85] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)] backdrop-blur-sm",
        cardAccentClasses[glowColor]
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top,rgba(17,102,182,0.10),transparent_72%)]" />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold leading-none text-foreground numeric tabular-nums">{value}</p>
          {subtitle && <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", iconBgClasses[glowColor])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {change && (
        <p className={cn(
          "mt-4 text-xs font-medium numeric tabular-nums",
          changeType === "positive" && "text-success",
          changeType === "negative" && "text-destructive",
          changeType === "neutral" && "text-muted-foreground"
        )}>
          {change}
        </p>
      )}
    </motion.div>
  );
};
