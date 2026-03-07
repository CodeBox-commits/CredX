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
    success: "bg-primary/10 text-primary",
    warning: "bg-accent/15 text-accent",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-card rounded-lg border p-4 h-full shadow-sm",
        cardAccentClasses[glowColor]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-1 numeric tabular-nums leading-none text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn("w-8 h-8 rounded-md flex items-center justify-center", iconBgClasses[glowColor])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {change && (
        <p className={cn(
          "text-xs mt-2 numeric tabular-nums font-medium",
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
