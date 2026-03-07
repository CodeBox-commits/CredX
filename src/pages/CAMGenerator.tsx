import { motion } from "framer-motion";
import { FileText, Download, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const camSections = [
  {
    title: "Executive Summary",
    status: "complete",
    preview: "Adani Power Limited has applied for a term loan facility of Rs 200 Cr for capacity expansion. Based on AI-driven analysis of financial statements, promoter background, sector conditions, and litigation history, the system recommends conditional approval of Rs 120 Cr at 12.5% interest rate with quarterly monitoring covenants."
  },
  {
    title: "Company Profile",
    status: "complete",
    preview: "Adani Power Limited is a major private thermal power producer with generation assets across multiple Indian states. Annual turnover of Rs 890 Cr (sample case data, FY24). Operations include long-term and merchant power supply contracts."
  },
  {
    title: "Financial Analysis",
    status: "complete",
    preview: "Revenue CAGR of 12% over 3 years. However, operating margins declined from 14.2% to 8.7%. Debt-to-equity at 1.87x (industry avg: 1.4x). DSCR at 1.45x is adequate but trending down. Working capital cycle has elongated from 58 to 78 days."
  },
  {
    title: "Promoter Background",
    status: "complete",
    preview: "Promoter group led by Rajesh Kumar (52, BE Civil, 24 years experience). Clean CIBIL (792). However, promoter pledge increased from 12% to 28%. Connected entity Gamma Trading Co flagged as potential shell company. One ongoing SEBI investigation."
  },
  {
    title: "Industry Outlook",
    status: "complete",
    preview: "Infrastructure sector growing at 8% YoY driven by government capex. However, NPA rates in the sector at 8.2% are concerning. Rising input costs (steel +22%, cement +15%) pressuring margins. Positive: Government pipeline of Rs 12 lakh Cr in infrastructure spending."
  },
  {
    title: "Risk Assessment",
    status: "complete",
    preview: "Overall Risk: MODERATE-HIGH. Key risks: (1) Declining capacity utilization at 40%, (2) Promoter pledge increase of 133%, (3) Shell company linkage, (4) Sector NPA stress. Mitigants: Strong collateral coverage at 1.8x, government contract pipeline, improving cash flows."
  },
  {
    title: "Loan Recommendation",
    status: "complete",
    preview: "CONDITIONAL APPROVAL recommended. Amount: Rs 120 Cr (vs requested Rs 200 Cr). Rate: 12.5% fixed. Tenor: 5 years with 6-month moratorium. Conditions: (1) Quarterly financial reporting, (2) DSCR maintenance >1.3x, (3) No additional promoter pledge, (4) Resolution of SEBI investigation within 12 months."
  },
];

const CAMGenerator = () => {
  return (
    <div className="page-shell space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">CAM Generator</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            AI-GENERATED CREDIT APPRAISAL MEMO | AUTOMATED REPORT
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-xs font-medium border border-border hover:bg-secondary/80 transition-colors">
            <Download className="w-3 h-3" />
            Export PDF
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-xs font-medium border border-border hover:bg-secondary/80 transition-colors">
            <FileText className="w-3 h-3" />
            Export Word
          </button>
        </div>
      </div>

      {/* CAM Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-card rounded-lg border border-primary/20 glow-primary p-6"
      >
        <div className="text-center mb-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Credit Appraisal Memorandum</p>
          <h2 className="text-lg font-bold mt-1">Adani Power Limited</h2>
          <p className="text-xs text-muted-foreground mt-1">CIN: U45209MH2008PTC123456 | Generated: December 15, 2024</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-border pt-4">
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">FACILITY</p>
            <p className="text-sm font-bold mt-0.5">Term Loan</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">REQUESTED</p>
            <p className="text-sm font-bold mt-0.5 numeric tabular-nums">Rs 200 Cr</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">RECOMMENDED</p>
            <p className="text-sm font-bold mt-0.5 text-primary numeric tabular-nums">Rs 120 Cr</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">DECISION</p>
            <p className="text-sm font-bold mt-0.5 text-warning">CONDITIONAL</p>
          </div>
        </div>
      </motion.div>

      {/* Sections */}
      <div className="space-y-3">
        {camSections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-lg border border-border p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-3.5 h-3.5 text-success" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Section {i + 1}
              </span>
              <span className="text-xs font-semibold">{section.title}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pl-5">
              {section.preview}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CAMGenerator;
