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
      className={cn("rounded-[22px] border p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]", severityStyles[severity])}
    >
      <div className="flex items-start gap-2">
        <div className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", dotColor[severity])} />
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-1.5">
            <Brain className={cn("h-3.5 w-3.5 shrink-0", severity === "warning" ? "text-accent" : "text-primary")} />
            <p className="text-sm font-semibold truncate text-foreground">{title}</p>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">{insight}</p>
          {tags && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full border border-border bg-secondary px-2 py-1 text-[10px] text-secondary-foreground">
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
