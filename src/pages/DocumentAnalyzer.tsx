import { motion } from "framer-motion";
import { Upload, FileText, AlertTriangle, CheckCircle, Eye, Brain, Table } from "lucide-react";
import { useState } from "react";
import { AIInsightCard } from "@/components/AIInsightCard";
import { cn } from "@/lib/utils";

const supportedFormats = [
  "GSTR-2A", "GSTR-3B", "Bank Statements", "ITR", "Annual Reports",
  "Rating Reports", "MCA Filings", "Legal Documents", "Shareholding"
];

const extractedSignals = [
  { label: "Revenue Growth (YoY)", value: "+14.2%", status: "positive" },
  { label: "Debt-to-Equity Ratio", value: "1.87", status: "warning" },
  { label: "Current Ratio", value: "1.12", status: "neutral" },
  { label: "Interest Coverage", value: "2.3x", status: "warning" },
  { label: "DSCR", value: "1.45", status: "positive" },
  { label: "Operating Margin", value: "8.7%", status: "neutral" },
  { label: "Cash Conversion Cycle", value: "78 days", status: "warning" },
  { label: "Promoter Holding", value: "52.3%", status: "positive" },
];

const documentSections = [
  { page: "P.12", title: "Revenue Recognition Policy", risk: "medium", note: "Aggressive revenue recognition detected — booking revenue before delivery confirmation." },
  { page: "P.28", title: "Related Party Transactions", risk: "high", note: "₹45Cr in unsecured loans to promoter-linked entities with no stated repayment schedule." },
  { page: "P.34", title: "Contingent Liabilities", risk: "high", note: "Undisclosed ₹12Cr guarantee to subsidiary not reflected in main balance sheet." },
  { page: "P.41", title: "Auditor Qualifications", risk: "medium", note: "Emphasis of matter on going concern and inventory valuation methodology." },
  { page: "P.55", title: "Debt Maturity Profile", risk: "low", note: "Well-staggered repayments with no bullet maturities in next 18 months." },
];

const DocumentAnalyzer = () => {
  const [selectedDoc, setSelectedDoc] = useState<number | null>(null);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Financial Document Analyzer</h1>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          AI-POWERED DOCUMENT INTELLIGENCE ENGINE • OCR • TABLE EXTRACTION • RISK DETECTION
        </p>
      </div>

      {/* Upload Area */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="border-2 border-dashed border-primary/20 rounded-lg p-8 text-center bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
      >
        <Upload className="w-8 h-8 text-primary mx-auto mb-3" />
        <p className="text-sm font-medium">Upload Financial Documents</p>
        <p className="text-xs text-muted-foreground mt-1">Drag & drop or click to upload PDF, Excel, CSV</p>
        <div className="flex flex-wrap justify-center gap-1.5 mt-4">
          {supportedFormats.map((format) => (
            <span key={format} className="text-[9px] font-mono px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
              {format}
            </span>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Document Intelligence Viewer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-lg border border-border p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-4 h-4 text-primary" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              AI Document Intelligence Viewer
            </p>
          </div>

          {/* Simulated PDF with highlights */}
          <div className="bg-secondary/50 rounded-md p-4 space-y-2 font-mono text-xs">
            <p className="text-muted-foreground text-[10px] mb-3">ANNUAL_REPORT_2024.pdf — AI Analysis</p>
            {documentSections.map((section, i) => (
              <div
                key={i}
                onClick={() => setSelectedDoc(i)}
                className={cn(
                  "p-2 rounded border cursor-pointer transition-all",
                  section.risk === "high"
                    ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
                    : section.risk === "medium"
                    ? "border-warning/30 bg-warning/5 hover:bg-warning/10"
                    : "border-success/30 bg-success/5 hover:bg-success/10",
                  selectedDoc === i && "ring-1 ring-primary"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground">{section.page}</span>
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded",
                    section.risk === "high" ? "bg-destructive/20 text-destructive" :
                    section.risk === "medium" ? "bg-warning/20 text-warning" :
                    "bg-success/20 text-success"
                  )}>
                    {section.risk.toUpperCase()} RISK
                  </span>
                </div>
                <p className="font-semibold text-foreground text-[11px]">{section.title}</p>
                <p className="text-muted-foreground text-[10px] mt-1">{section.note}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Extracted Signals */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-lg border border-border p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Table className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Extracted Financial Signals
              </p>
            </div>
            <div className="space-y-2">
              {extractedSignals.map((signal) => (
                <div key={signal.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground">{signal.label}</span>
                  <span className={cn(
                    "text-xs font-mono font-semibold",
                    signal.status === "positive" ? "text-success" :
                    signal.status === "warning" ? "text-warning" :
                    "text-foreground"
                  )}>
                    {signal.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              AI Risk Insights
            </p>
            <AIInsightCard
              title="Hidden Liability Detected"
              insight="Contingent liabilities of ₹12Cr found in subsidiary not consolidated in main balance sheet. Adjusting effective debt ratio from 1.87 to 2.24."
              severity="critical"
              tags={["LIABILITY", "SUBSIDIARY"]}
            />
            <AIInsightCard
              title="Revenue Quality Concern"
              insight="Channel stuffing pattern detected — Q4 revenue spike of 40% followed by Q1 returns of 18%. Indicates possible window dressing."
              severity="warning"
              tags={["REVENUE", "PATTERN"]}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default DocumentAnalyzer;
