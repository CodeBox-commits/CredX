import { MetricCard } from "@/components/MetricCard";
import { RiskGauge } from "@/components/RiskGauge";
import { AIInsightCard } from "@/components/AIInsightCard";
import { EventTimeline } from "@/components/EventTimeline";
import HeroCarousel from "@/components/HeroCarousel";
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

const timelineEvents = [
  {
    date: "2024-12-15",
    title: "GST Cross-Verification Mismatch",
    description: "Input tax credit difference of Rs 2.3 Cr detected between GSTR-2A and GSTR-3B.",
    type: "financial" as const,
  },
  {
    date: "2024-11-28",
    title: "Litigation Escalation",
    description: "Operational creditor filed NCLT case for Rs 45 L recovery.",
    type: "legal" as const,
  },
  {
    date: "2024-11-10",
    title: "External Rating Action",
    description: "Borrower rating revised from A+ to A due to margin compression.",
    type: "regulatory" as const,
  },
];

const borrowerRows = [
  {
    borrower: "Adani Power Limited",
    gst: "Mismatch: Rs 2.3 Cr",
    litigation: "High",
    recommendation: "Rs 120 Cr",
    score: 684,
    action: "Conditional Approval",
  },
  {
    borrower: "Northline Engineering Ltd",
    gst: "Matched",
    litigation: "Low",
    recommendation: "Rs 210 Cr",
    score: 782,
    action: "Approve",
  },
  {
    borrower: "UrbanAxis Developers LLP",
    gst: "Mismatch: Rs 0.8 Cr",
    litigation: "Medium",
    recommendation: "Rs 75 Cr",
    score: 711,
    action: "Approve with Covenants",
  },
  {
    borrower: "PrimeForge Manufacturing",
    gst: "Under Review",
    litigation: "High",
    recommendation: "Rs 60 Cr",
    score: 628,
    action: "Hold",
  },
];

const monitoringRows = [
  {
    date: "2024-12-16",
    trigger: "DSCR dropped below 1.30x",
    impact: "Credit limit stress",
    status: "Critical",
  },
  {
    date: "2024-12-14",
    trigger: "Promoter pledge increased by 4%",
    impact: "Collateral comfort reduced",
    status: "Warning",
  },
  {
    date: "2024-12-11",
    trigger: "Statutory dues paid on schedule",
    impact: "Compliance confidence improved",
    status: "Normal",
  },
];

const Dashboard = () => {
  return (
    <div className="page-shell space-y-6">
      <HeroCarousel />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Corporate Credit Appraisal Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Credit limit recommendation, GST cross-verification, and litigation risk surveillance
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-1.5">
          <ShieldCheck className="h-4 w-4 text-success" />
          <span className="text-xs font-semibold text-success">Portfolio Monitoring Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-primary">Portfolio Credit Score</p>
          <RiskGauge score={742} label="Portfolio Score" size="lg" />
          <div className="mt-4 rounded-md border border-border bg-secondary/60 p-3">
            <p className="text-xs font-semibold text-foreground">Credit View</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Current portfolio sits in the medium-to-low risk zone. Maintain quarterly monitoring for litigation-linked accounts.
            </p>
          </div>
        </div>

        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Borrowers Under Review"
            value="247"
            change="+12 this week"
            changeType="neutral"
            icon={FileSearch}
            glowColor="primary"
          />
          <MetricCard
            title="Approval Ratio"
            value="73.2%"
            change="+2.1% vs last month"
            changeType="positive"
            icon={TrendingUp}
            glowColor="success"
          />
          <MetricCard
            title="Litigation Risk Alerts"
            value="18"
            change="3 critical cases"
            changeType="negative"
            icon={AlertTriangle}
            glowColor="warning"
          />
          <MetricCard
            title="Recommended Credit Exposure"
            value="Rs 4,820 Cr"
            change="+Rs 340 Cr this quarter"
            changeType="positive"
            icon={DollarSign}
            glowColor="primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-primary">Borrower Risk Register</h2>
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="text-primary">Borrower</TableHead>
                <TableHead className="text-primary">GST Cross-Verification</TableHead>
                <TableHead className="text-primary">Litigation Risk</TableHead>
                <TableHead className="text-primary text-right">Credit Limit Recommendation</TableHead>
                <TableHead className="text-primary text-right">Score</TableHead>
                <TableHead className="text-primary">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {borrowerRows.map((row) => (
                <TableRow key={row.borrower} className="odd:bg-white even:bg-secondary/60">
                  <TableCell className="font-medium text-foreground">{row.borrower}</TableCell>
                  <TableCell className="text-muted-foreground">{row.gst}</TableCell>
                  <TableCell>
                    <span
                      className={
                        row.litigation === "High"
                          ? "text-destructive font-semibold"
                          : row.litigation === "Medium"
                            ? "text-warning font-semibold"
                            : "text-success font-semibold"
                      }
                    >
                      {row.litigation}
                    </span>
                  </TableCell>
                  <TableCell className="text-right numeric tabular-nums font-medium">{row.recommendation}</TableCell>
                  <TableCell className="text-right numeric tabular-nums font-semibold text-accent">{row.score}</TableCell>
                  <TableCell className="text-muted-foreground">{row.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-primary">Early Warning Monitoring Queue</h2>
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="text-primary">Date</TableHead>
                <TableHead className="text-primary">Monitoring Trigger</TableHead>
                <TableHead className="text-primary">Credit Impact</TableHead>
                <TableHead className="text-primary">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monitoringRows.map((row) => (
                <TableRow key={`${row.date}-${row.trigger}`} className="odd:bg-white even:bg-secondary/60">
                  <TableCell className="numeric tabular-nums font-medium">{row.date}</TableCell>
                  <TableCell className="text-foreground">{row.trigger}</TableCell>
                  <TableCell className="text-muted-foreground">{row.impact}</TableCell>
                  <TableCell>
                    <span
                      className={
                        row.status === "Critical"
                          ? "text-destructive font-semibold"
                          : row.status === "Warning"
                            ? "text-warning font-semibold"
                            : "text-success font-semibold"
                      }
                    >
                      {row.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-primary">AI Credit Intelligence</h2>
          <AIInsightCard
            title="Litigation Risk Spike"
            insight="Two borrower accounts entered legal recovery workflow in the last 30 days. Re-run credit limit recommendation before sanction."
            severity="critical"
            tags={["LITIGATION", "RISK"]}
          />
          <AIInsightCard
            title="GST Compliance Drift"
            insight="Repeated GSTR-2A and GSTR-3B mismatch for one borrower indicates possible revenue quality concern."
            severity="warning"
            tags={["GST", "COMPLIANCE"]}
          />
          <AIInsightCard
            title="Collateral Coverage Improvement"
            insight="Recent collateral top-up improved collateral coverage from 1.5x to 1.8x for one high-ticket proposal."
            severity="positive"
            tags={["COLLATERAL", "COVERAGE"]}
          />
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-primary">Credit Event Timeline</h2>
          <EventTimeline events={timelineEvents} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
