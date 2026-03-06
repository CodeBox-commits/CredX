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
  const glowClasses = {
    primary: "glow-primary border-primary/20",
    success: "glow-success border-success/20",
    warning: "glow-warning border-warning/20",
    destructive: "glow-destructive border-destructive/20",
  };

  const iconBgClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-card rounded-lg border p-4",
        glowClasses[glowColor]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1 font-mono">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn("w-8 h-8 rounded-md flex items-center justify-center", iconBgClasses[glowColor])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {change && (
        <p className={cn(
          "text-xs font-mono mt-2",
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
