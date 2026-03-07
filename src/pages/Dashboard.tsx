import { MetricCard } from "@/components/MetricCard";
import { RiskGauge } from "@/components/RiskGauge";
import { AIInsightCard } from "@/components/AIInsightCard";
import { EventTimeline } from "@/components/EventTimeline";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Activity,
  FileSearch,
  Users,
  DollarSign,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";

const revenueData = [
  { month: "Jan", revenue: 420, expenses: 310 },
  { month: "Feb", revenue: 480, expenses: 340 },
  { month: "Mar", revenue: 510, expenses: 320 },
  { month: "Apr", revenue: 470, expenses: 350 },
  { month: "May", revenue: 530, expenses: 330 },
  { month: "Jun", revenue: 590, expenses: 370 },
  { month: "Jul", revenue: 610, expenses: 380 },
  { month: "Aug", revenue: 580, expenses: 360 },
];

const sectorData = [
  { sector: "Manufacturing", risk: 35 },
  { sector: "IT Services", risk: 22 },
  { sector: "Real Estate", risk: 68 },
  { sector: "Pharma", risk: 28 },
  { sector: "Infra", risk: 55 },
  { sector: "FMCG", risk: 18 },
];

const radarData = [
  { metric: "Character", score: 82 },
  { metric: "Capacity", score: 68 },
  { metric: "Capital", score: 75 },
  { metric: "Collateral", score: 90 },
  { metric: "Conditions", score: 55 },
];

const timelineEvents = [
  { date: "2024-12-15", title: "GST Filing Anomaly Detected", description: "Input tax credit mismatch of Rs 2.3 Cr between GSTR-2A and GSTR-3B", type: "financial" as const },
  { date: "2024-11-28", title: "NCLT Case Filed", description: "Operational creditor filed case for Rs 45 L recovery", type: "legal" as const },
  { date: "2024-11-10", title: "Credit Rating Downgrade", description: "CRISIL downgraded from A+ to A due to declining margins", type: "regulatory" as const },
  { date: "2024-10-22", title: "Sector Outlook Changed", description: "RBI flagged real estate sector for increased NPA monitoring", type: "news" as const },
  { date: "2024-09-15", title: "Promoter Pledge Increase", description: "Promoter shareholding pledge increased from 12% to 28%", type: "financial" as const },
];

const Dashboard = () => {
  return (
    <div className="page-shell space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">AI Intelligence Dashboard</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            AUTONOMOUS CREDIT INTELLIGENCE SYSTEM | REAL-TIME MONITORING
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
          <span className="text-[10px] font-mono text-muted-foreground">LIVE</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Cases"
          value="247"
          change="+12 this week"
          changeType="neutral"
          icon={FileSearch}
          glowColor="primary"
        />
        <MetricCard
          title="Approval Rate"
          value="73.2%"
          change="+2.1% vs last month"
          changeType="positive"
          icon={TrendingUp}
          glowColor="success"
        />
        <MetricCard
          title="Risk Alerts"
          value="18"
          change="3 critical"
          changeType="negative"
          icon={AlertTriangle}
          glowColor="warning"
        />
        <MetricCard
          title="Portfolio Value"
          value="Rs 4,820 Cr"
          change="+Rs 340 Cr this quarter"
          changeType="positive"
          icon={DollarSign}
          glowColor="primary"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-card rounded-lg border border-border p-4"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Portfolio Revenue & Expenses Trend (Rs Cr)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(187, 85%, 53%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(187, 85%, 53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(222, 44%, 8%)",
                  border: "1px solid hsl(222, 30%, 16%)",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(187, 85%, 53%)" fill="url(#colorRevenue)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" stroke="hsl(0, 72%, 51%)" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Five Cs Radar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-lg border border-border p-4"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Five Cs Assessment - Sample Borrower
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(222, 30%, 16%)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "hsl(215, 20%, 55%)" }} />
              <Radar dataKey="score" stroke="hsl(187, 85%, 53%)" fill="hsl(187, 85%, 53%)" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Lower Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risk Gauges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-lg border border-border p-4"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
            AI Risk Scores
          </p>
          <div className="grid grid-cols-2 gap-4">
            <RiskGauge score={72} label="Credit" size="sm" />
            <RiskGauge score={45} label="Litigation" size="sm" />
            <RiskGauge score={81} label="Financial" size="sm" />
            <RiskGauge score={58} label="Sector" size="sm" />
          </div>
        </motion.div>

        {/* Sector Risk */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-lg border border-border p-4"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Sector Risk Distribution
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sectorData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(215, 20%, 55%)" }} />
              <YAxis dataKey="sector" type="category" tick={{ fontSize: 9, fill: "hsl(215, 20%, 55%)" }} width={80} />
              <Bar dataKey="risk" fill="hsl(187, 85%, 53%)" radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* AI Insights */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-lg border border-border p-4 space-y-2"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            AI Intelligence Alerts
          </p>
          <AIInsightCard
            title="High Promoter Pledge Risk"
            insight="Promoter pledge increased 133% in 3 months. Historical pattern linked to 42% higher default probability."
            severity="critical"
            tags={["PROMOTER", "PLEDGE"]}
          />
          <AIInsightCard
            title="GST Compliance Anomaly"
            insight="Input tax credit mismatch suggests potential revenue inflation or circular trading."
            severity="warning"
            tags={["GST", "COMPLIANCE"]}
          />
          <AIInsightCard
            title="Strong Cash Flows"
            insight="Operating cash flow to debt ratio improved 18% YoY. Positive signal for debt servicing."
            severity="positive"
            tags={["CASHFLOW"]}
          />
        </motion.div>
      </div>

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-card rounded-lg border border-border p-4"
      >
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
          Corporate Event Timeline
        </p>
        <EventTimeline events={timelineEvents} />
      </motion.div>
    </div>
  );
};

export default Dashboard;
