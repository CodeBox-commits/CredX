import { cn } from "@/lib/utils";
import { Brain } from "lucide-react";
import { motion } from "framer-motion";

interface AIInsightCardProps {
  title: string;
  insight: string;
  severity?: "info" | "warning" | "critical" | "positive";
  tags?: string[];
}

export const AIInsightCard = ({ title, insight, severity = "info", tags }: AIInsightCardProps) => {
  const severityStyles = {
    info: "border-primary/20 bg-card",
    warning: "border-warning/30 bg-card",
    critical: "border-destructive/30 bg-card",
    positive: "border-success/30 bg-card",
  };

  const dotColor = {
    info: "bg-primary",
    warning: "bg-warning",
    critical: "bg-destructive",
    positive: "bg-success",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn("rounded-lg border p-3 shadow-sm", severityStyles[severity])}
    >
      <div className="flex items-start gap-2">
        <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", dotColor[severity])} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Brain className={cn("w-3.5 h-3.5 shrink-0", severity === "warning" ? "text-accent" : "text-primary")} />
            <p className="text-sm font-semibold truncate text-foreground">{title}</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{insight}</p>
          {tags && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground border border-border">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
