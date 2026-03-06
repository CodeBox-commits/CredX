import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  type: "financial" | "legal" | "regulatory" | "news";
}

const typeStyles = {
  financial: "bg-primary/20 text-primary border-primary/30",
  legal: "bg-destructive/20 text-destructive border-destructive/30",
  regulatory: "bg-warning/20 text-warning border-warning/30",
  news: "bg-success/20 text-success border-success/30",
};

const typeDot = {
  financial: "bg-primary",
  legal: "bg-destructive",
  regulatory: "bg-warning",
  news: "bg-success",
};

export const EventTimeline = ({ events }: { events: TimelineEvent[] }) => {
  return (
    <div className="space-y-3">
      {events.map((event, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex gap-3"
        >
          <div className="flex flex-col items-center">
            <div className={cn("w-2 h-2 rounded-full mt-1.5", typeDot[event.type])} />
            {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>
          <div className="flex-1 pb-3">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono text-muted-foreground">{event.date}</span>
              <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded border", typeStyles[event.type])}>
                {event.type.toUpperCase()}
              </span>
            </div>
            <p className="text-xs font-medium">{event.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
