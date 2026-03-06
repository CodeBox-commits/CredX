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
    info: "border-primary/20 bg-primary/5",
    warning: "border-warning/20 bg-warning/5",
    critical: "border-destructive/20 bg-destructive/5",
    positive: "border-success/20 bg-success/5",
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
      className={cn("rounded-lg border p-3", severityStyles[severity])}
    >
      <div className="flex items-start gap-2">
        <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", dotColor[severity])} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Brain className="w-3 h-3 text-primary shrink-0" />
            <p className="text-xs font-semibold truncate">{title}</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{insight}</p>
          {tags && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((tag) => (
                <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
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
