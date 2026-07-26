import HeroCarousel from "@/components/HeroCarousel";
import { MetricCard } from "@/components/MetricCard";
import { RiskGauge } from "@/components/RiskGauge";
import { AIInsightCard } from "@/components/AIInsightCard";
import { EventTimeline } from "@/components/EventTimeline";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  TrendingUp,
  AlertTriangle,
  FileSearch,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function statusTone(status: "active" | "watch" | "clear"): string {
  if (status === "active") return "text-destructive font-semibold";
  if (status === "watch") return "text-warning font-semibold";
  return "text-success font-semibold";
}

export default function Dashboard() {
  const { workspace } = useWorkspace();
  const sourceCount = workspace.sourceCoverage.filter((item) => item.available).length;
  const highSeveritySignals = workspace.topSignals.filter(
    (signal) => signal.severity === "high",
  ).length;
  const activeMonitoring = workspace.monitoringTriggers.filter(
    (trigger) => trigger.status === "active",
  ).length;
  const researchDepth = workspace.researchFindings.filter(
    (finding) => finding.severity !== "low",
  ).length;
  const gstSynthesis =
    workspace.structuredSynthesis.find((item) =>
      item.label.includes("GSTR-2A vs 3B"),
    )?.value ?? "Pending";
  const cashAlignment =
    workspace.structuredSynthesis.find((item) =>
      item.label.includes("bank-credit alignment"),
    )?.value ?? "Pending";
  const litigationFinding =
    workspace.researchFindings.find((item) => item.category === "litigation")?.title ??
    "Legal watch not refreshed";

  return (
    <div className="page-shell space-y-6">
      <HeroCarousel />

      <div className="surface-panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="section-eyebrow text-[10px]">Workspace Snapshot</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            Intelli-Credit Command Center
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
            A cleaner underwriting board for ingestion, research, qualitative
            overrides, and recommendation trace.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-success">
            CAM Pipeline Ready
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="surface-panel p-4">
          <p className="mb-3 text-sm font-semibold text-primary">
            Live Credit Score
          </p>
          <RiskGauge score={workspace.creditModel.score} label="Case Score" size="lg" />
          <div className="mt-4 rounded-[22px] border border-border bg-secondary/60 p-4">
            <p className="text-xs font-semibold text-foreground">
              Recommendation Posture
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {workspace.recommendation.rationale}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-2">
          <MetricCard
            title="Parsed Evidence"
            value={`${workspace.creditModel.parsedDocuments}/${workspace.creditModel.totalDocuments}`}
            change={`${sourceCount} of ${workspace.sourceCoverage.length} source lanes live`}
            changeType="neutral"
            icon={FileSearch}
            glowColor="primary"
          />
          <MetricCard
            title="Model Readiness"
            value={`${workspace.creditModel.readiness}%`}
            change={`${researchDepth} research lanes elevated`}
            changeType={workspace.creditModel.readiness >= 65 ? "positive" : "neutral"}
            icon={TrendingUp}
            glowColor="success"
          />
          <MetricCard
            title="Open Risk Alerts"
            value={String(activeMonitoring)}
            change={`${highSeveritySignals} high-severity signal(s) in evidence`}
            changeType={activeMonitoring > 0 ? "negative" : "neutral"}
            icon={AlertTriangle}
            glowColor="warning"
          />
          <MetricCard
            title="Recommended Exposure"
            value={`Rs ${workspace.recommendation.recommendedAmountCr} Cr`}
            change={`Indicative rate ${workspace.recommendation.rate}%`}
            changeType="positive"
            icon={DollarSign}
            glowColor="primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="surface-panel p-4">
          <h2 className="mb-3 text-sm font-semibold text-primary">
            Live Borrower Risk Register
          </h2>
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="text-primary">Borrower</TableHead>
                <TableHead className="text-primary">GST Proxy</TableHead>
                <TableHead className="text-primary">Cash Alignment</TableHead>
                <TableHead className="text-primary">Litigation Watch</TableHead>
                <TableHead className="text-primary text-right">Limit</TableHead>
                <TableHead className="text-primary">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="odd:bg-white even:bg-secondary/60">
                <TableCell className="font-medium text-foreground">
                  {workspace.companyName}
                </TableCell>
                <TableCell className="text-muted-foreground">{gstSynthesis}</TableCell>
                <TableCell className="text-muted-foreground">{cashAlignment}</TableCell>
                <TableCell className="text-muted-foreground">{litigationFinding}</TableCell>
                <TableCell className="text-right font-medium numeric tabular-nums">
                  Rs {workspace.recommendation.recommendedAmountCr} Cr
                </TableCell>
                <TableCell className="font-semibold text-accent">
                  {workspace.recommendation.decision}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="surface-panel p-4">
          <h2 className="mb-3 text-sm font-semibold text-primary">
            Early Warning Monitoring Queue
          </h2>
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="text-primary">Trigger</TableHead>
                <TableHead className="text-primary">Threshold</TableHead>
                <TableHead className="text-primary">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.monitoringTriggers.map((trigger) => (
                <TableRow
                  key={`${trigger.title}-${trigger.threshold}`}
                  className="odd:bg-white even:bg-secondary/60"
                >
                  <TableCell className="font-medium text-foreground">
                    {trigger.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {trigger.threshold}
                  </TableCell>
                  <TableCell className={statusTone(trigger.status)}>
                    {trigger.status.toUpperCase()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="surface-panel p-4">
          <h2 className="mb-3 text-sm font-semibold text-primary">
            Source Coverage Map
          </h2>
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="text-primary">Source</TableHead>
                <TableHead className="text-primary">Type</TableHead>
                <TableHead className="text-primary">Coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.sourceCoverage.map((item) => (
                <TableRow key={item.label} className="odd:bg-white even:bg-secondary/60">
                  <TableCell className="font-medium text-foreground">
                    {item.label}
                  </TableCell>
                  <TableCell className="uppercase text-muted-foreground">
                    {item.sourceType}
                  </TableCell>
                  <TableCell
                    className={
                      item.available
                        ? "font-semibold text-success"
                        : "font-semibold text-warning"
                    }
                  >
                    {item.available ? "Available" : "Missing"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="surface-panel p-4">
          <h2 className="mb-4 text-sm font-semibold text-primary">
            Credit Event Timeline
          </h2>
          <EventTimeline events={workspace.timelineEvents} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-primary">
            AI Credit Intelligence
          </h2>
          {workspace.aiInsights.map((insight) => (
            <AIInsightCard
              key={insight.title}
              title={insight.title}
              insight={insight.insight}
              severity={insight.severity}
              tags={insight.tags}
            />
          ))}
        </div>

        <div className="surface-panel p-4">
          <h2 className="mb-3 text-sm font-semibold text-primary">
            Recommendation Trace
          </h2>
          <div className="space-y-3">
            {workspace.decisionTrace.map((item) => (
              <div key={item.title} className="rounded-[22px] border border-border bg-secondary/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <span
                    className={
                      item.impact === "positive"
                        ? "text-xs font-semibold text-success"
                        : "text-xs font-semibold text-destructive"
                    }
                  >
                    {item.impact.toUpperCase()} | {item.weight}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
