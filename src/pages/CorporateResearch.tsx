import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Globe,
  Newspaper,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIInsightCard } from "@/components/AIInsightCard";
import { EventTimeline } from "@/components/EventTimeline";
import { MetricCard } from "@/components/MetricCard";
import { useWorkspace } from "@/hooks/useWorkspace";

const CorporateResearch = () => {
  const { workspace, setCompanyName } = useWorkspace();
  const [companyInput, setCompanyInput] = useState(workspace.companyName);

  const headlineRisk = useMemo(
    () => workspace.topSignals[0]?.label ?? "No major signal detected",
    [workspace.topSignals],
  );

  const negativeNewsCount = workspace.researchNews.filter(
    (item) => item.sentiment === "negative",
  ).length;

  const handleAnalyze = () => {
    const nextName = companyInput.trim();
    if (!nextName) return;
    setCompanyName(nextName);
  };

  return (
    <div className="page-shell space-y-6">
      <div>
        <h1 className="text-xl font-bold">Corporate Research Intelligence</h1>
        <p className="mt-0.5 text-xs font-mono text-muted-foreground">
          AUTONOMOUS RESEARCH AGENT | PROMOTER NETWORK | NEWS | LITIGATION | PRIMARY INSIGHTS
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-lg border border-border bg-card p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-3">
            <Globe className="h-5 w-5 text-primary" />
            <input
              type="text"
              value={companyInput}
              onChange={(event) => setCompanyInput(event.target.value)}
              placeholder="Search company or CIN..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={handleAnalyze}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            Analyze
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MetricCard
          title="Tracked Company"
          value={workspace.companyName}
          subtitle={`${workspace.sector} | ${workspace.cin}`}
          icon={Globe}
          glowColor="primary"
        />
        <MetricCard
          title="Negative News Signals"
          value={String(negativeNewsCount)}
          subtitle="Promoter and sector watchlist items"
          icon={Newspaper}
          glowColor="warning"
        />
        <MetricCard
          title="Lead Risk Cue"
          value={headlineRisk}
          subtitle={`Current posture: ${workspace.riskLevel.toUpperCase()}`}
          icon={ShieldAlert}
          glowColor={workspace.riskLevel === "high" ? "destructive" : "warning"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="mb-4 flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              AI News Intelligence
            </p>
          </div>
          <div className="space-y-2">
            {workspace.researchNews.map((item, index) => (
              <motion.div
                key={`${item.source}-${item.date}-${index}`}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "rounded border p-2.5 text-xs",
                  item.sentiment === "negative"
                    ? "border-destructive/20 bg-destructive/5"
                    : item.sentiment === "positive"
                      ? "border-success/20 bg-success/5"
                      : "border-border",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {item.source} | {item.date}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono numeric tabular-nums",
                      item.sentiment === "negative"
                        ? "text-destructive"
                        : item.sentiment === "positive"
                          ? "text-success"
                          : "text-muted-foreground",
                    )}
                  >
                    {item.score > 0 ? "+" : ""}
                    {item.score.toFixed(2)}
                  </span>
                </div>
                <p className="font-medium">{item.title}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Promoter Graph Intelligence
            </p>
          </div>

          <div className="relative min-h-[300px] rounded-md bg-secondary/30 p-6">
            <div className="absolute left-1/2 top-1/2 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary bg-primary/10">
              <span className="px-1 text-center text-[8px] font-mono leading-tight text-primary">
                {workspace.companyName.split(" ").slice(0, 2).join("\n")}
              </span>
            </div>

            {workspace.networkNodes.map((node, index) => {
              const angle =
                (index / workspace.networkNodes.length) * 2 * Math.PI -
                Math.PI / 2;
              const radius = 120;
              const x = 50 + (Math.cos(angle) * radius) / 3.5;
              const y = 50 + (Math.sin(angle) * radius) / 3;

              return (
                <motion.div
                  key={`${node.name}-${index}`}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + index * 0.07 }}
                  className={cn(
                    "absolute flex h-16 w-16 items-center justify-center rounded-full border",
                    node.type === "promoter"
                      ? "border-primary/40 bg-primary/5"
                      : node.type === "shell_suspect"
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border bg-card",
                  )}
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <span
                    className={cn(
                      "px-1 text-center text-[7px] font-mono leading-tight",
                      node.type === "shell_suspect"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {node.name.split(" ").slice(0, 2).join("\n")}
                  </span>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-3 flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full border border-primary/40 bg-primary/10" />
              <span className="text-[9px] text-muted-foreground">Promoter</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full border border-border bg-card" />
              <span className="text-[9px] text-muted-foreground">Company</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full border border-destructive/40 bg-destructive/10" />
              <span className="text-[9px] text-muted-foreground">
                Shell Suspect
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Research Intelligence Insights
          </p>
          {workspace.aiInsights.map((insight) => (
            <AIInsightCard
              key={insight.title}
              title={insight.title}
              insight={insight.insight}
              severity={insight.severity}
              tags={insight.tags}
            />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="mb-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Corporate Event Timeline
          </p>
          <EventTimeline events={workspace.timelineEvents} />
        </motion.div>
      </div>
    </div>
  );
};

export default CorporateResearch;
