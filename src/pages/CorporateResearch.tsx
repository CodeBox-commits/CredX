import { motion } from "framer-motion";
import { Globe, TrendingDown, AlertTriangle, Users, Scale, Newspaper } from "lucide-react";
import { AIInsightCard } from "@/components/AIInsightCard";
import { EventTimeline } from "@/components/EventTimeline";
import { cn } from "@/lib/utils";

const newsItems = [
  { source: "Economic Times", date: "2024-12-14", title: "Company X faces regulatory scrutiny over land deals", sentiment: "negative" as const, score: -0.72 },
  { source: "Business Standard", date: "2024-12-10", title: "Sector outlook remains cautious amid rising input costs", sentiment: "negative" as const, score: -0.45 },
  { source: "Mint", date: "2024-12-05", title: "Company X bags Rs 200 Cr government contract", sentiment: "positive" as const, score: 0.68 },
  { source: "Reuters", date: "2024-11-28", title: "Industry body warns of NPA increase in infrastructure sector", sentiment: "negative" as const, score: -0.58 },
  { source: "LiveMint", date: "2024-11-20", title: "Promoter group restructures holding through new entity", sentiment: "neutral" as const, score: -0.12 },
];

const networkNodes = [
  { name: "Rajesh Kumar (MD)", type: "promoter", connections: 5 },
  { name: "Alpha Holdings Pvt Ltd", type: "company", connections: 3 },
  { name: "Beta Infra Ltd", type: "company", connections: 2 },
  { name: "Sunita Kumar (Director)", type: "promoter", connections: 4 },
  { name: "Gamma Trading Co", type: "shell_suspect", connections: 1 },
  { name: "Delta Constructions", type: "company", connections: 2 },
  { name: "Epsilon Finance Ltd", type: "company", connections: 3 },
  { name: "Priya Sharma (Director)", type: "promoter", connections: 2 },
];

const timelineEvents = [
  { date: "2024-12", title: "Regulatory Investigation Initiated", description: "SEBI opened investigation into related-party land transactions", type: "regulatory" as const },
  { date: "2024-11", title: "New Shell Company Identified", description: "Gamma Trading Co linked to promoter via common directors", type: "legal" as const },
  { date: "2024-10", title: "Credit Rating Watch", description: "ICRA placed rating on watch with negative implications", type: "financial" as const },
  { date: "2024-09", title: "Positive Contract Win", description: "Government infrastructure contract worth Rs 200 Cr awarded", type: "news" as const },
  { date: "2024-08", title: "Promoter Holding Restructure", description: "Holding company structure changed, new entity introduced", type: "financial" as const },
];

const CorporateResearch = () => {
  return (
    <div className="page-shell space-y-6">
      <div>
        <h1 className="text-xl font-bold">Corporate Research Intelligence</h1>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          AUTONOMOUS AI RESEARCH AGENT | NEWS | LITIGATION | PROMOTER NETWORK | MCA FILINGS
        </p>
      </div>

      {/* Search Bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search company: e.g., 'Reliance Infrastructure Ltd' or CIN number..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              defaultValue="Acme Infrastructure Pvt Ltd"
            />
          </div>
          <button className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium">
            Analyze
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* News Intelligence */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-lg border border-border p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Newspaper className="w-4 h-4 text-primary" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              AI News Intelligence - Sentiment Analysis
            </p>
          </div>
          <div className="space-y-2">
            {newsItems.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "p-2.5 rounded border text-xs",
                  item.sentiment === "negative" ? "border-destructive/20 bg-destructive/5" :
                  item.sentiment === "positive" ? "border-success/20 bg-success/5" :
                  "border-border"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground">{item.source} | {item.date}</span>
                  <div className="flex items-center gap-1.5">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      item.sentiment === "negative" ? "bg-destructive" :
                      item.sentiment === "positive" ? "bg-success" : "bg-muted-foreground"
                    )} />
                    <span className={cn(
                      "text-[10px] font-mono w-12 text-right numeric tabular-nums",
                      item.sentiment === "negative" ? "text-destructive" :
                      item.sentiment === "positive" ? "text-success" : "text-muted-foreground"
                    )}>
                      {item.score > 0 ? "+" : ""}{item.score.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="font-medium">{item.title}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Promoter Network Graph */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-lg border border-border p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Promoter Graph Intelligence
            </p>
          </div>
          {/* Visual Network */}
          <div className="relative bg-secondary/30 rounded-md p-6 min-h-[300px]">
            {/* Central node */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center z-10">
              <span className="text-[8px] font-mono text-primary text-center leading-tight">ACME<br/>INFRA</span>
            </div>
            {/* Surrounding nodes */}
            {networkNodes.map((node, i) => {
              const angle = (i / networkNodes.length) * 2 * Math.PI - Math.PI / 2;
              const radius = 120;
              const x = 50 + (Math.cos(angle) * radius) / 3.5;
              const y = 50 + (Math.sin(angle) * radius) / 3;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className={cn(
                    "absolute w-16 h-16 rounded-full border flex items-center justify-center",
                    node.type === "promoter" ? "border-primary/40 bg-primary/5" :
                    node.type === "shell_suspect" ? "border-destructive/40 bg-destructive/5" :
                    "border-border bg-card"
                  )}
                  style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
                >
                  <span className={cn(
                    "text-[7px] font-mono text-center leading-tight px-1",
                    node.type === "shell_suspect" ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {node.name.split(' ').slice(0, 2).join('\n')}
                  </span>
                </motion.div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full border border-primary/40 bg-primary/10" />
              <span className="text-[9px] text-muted-foreground">Promoter</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full border border-border bg-card" />
              <span className="text-[9px] text-muted-foreground">Company</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full border border-destructive/40 bg-destructive/10" />
              <span className="text-[9px] text-muted-foreground">Shell Suspect</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* AI Insights + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Research Intelligence Insights
          </p>
          <AIInsightCard
            title="Shell Company Risk Detected"
            insight="Gamma Trading Co shares registered address and common director with promoter entity. No significant operations found. Potential fund diversion risk."
            severity="critical"
            tags={["SHELL", "PROMOTER", "MCA"]}
          />
          <AIInsightCard
            title="Regulatory Action Imminent"
            insight="SEBI investigation + credit rating watch suggests high probability of enforcement action within 90 days."
            severity="warning"
            tags={["SEBI", "REGULATORY"]}
          />
          <AIInsightCard
            title="Sector Headwinds"
            insight="Infrastructure sector NPA ratio at 8.2%, highest in 3 years. RBI tightening provisioning norms expected."
            severity="warning"
            tags={["SECTOR", "NPA"]}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-lg border border-border p-4"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Corporate Event Timeline
          </p>
          <EventTimeline events={timelineEvents} />
        </motion.div>
      </div>
    </div>
  );
};

export default CorporateResearch;
