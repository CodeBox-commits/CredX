import { motion } from "framer-motion";
import { CheckCircle, Download, FileText, Printer } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";

function buildCamDocument(workspace: ReturnType<typeof useWorkspace>["workspace"]): string {
  const header = [
    "CREDIT APPRAISAL MEMORANDUM",
    workspace.companyName,
    `CIN: ${workspace.cin}`,
    `Facility: ${workspace.facilityType}`,
    `Requested Amount: Rs ${workspace.recommendation.requestedAmountCr} Cr`,
    `Recommended Amount: Rs ${workspace.recommendation.recommendedAmountCr} Cr`,
    `Decision: ${workspace.recommendation.decision}`,
    `Indicative Rate: ${workspace.recommendation.rate}%`,
    `Tenor: ${workspace.recommendation.tenor}`,
    "",
  ].join("\n");

  const sections = workspace.camSections
    .map((section, index) => `${index + 1}. ${section.title}\n${section.preview}`)
    .join("\n\n");

  const covenants = workspace.recommendation.covenants
    .map((covenant) => `- ${covenant}`)
    .join("\n");

  return `${header}${sections}\n\nCOVENANTS\n${covenants}\n`;
}

function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const CAMGenerator = () => {
  const { workspace } = useWorkspace();

  const handleExportWord = () => {
    triggerDownload(
      `${workspace.companyName.replace(/\s+/g, "_")}_CAM.doc`,
      buildCamDocument(workspace),
      "application/msword",
    );
  };

  const handleExportText = () => {
    triggerDownload(
      `${workspace.companyName.replace(/\s+/g, "_")}_CAM.txt`,
      buildCamDocument(workspace),
      "text/plain;charset=utf-8",
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold">CAM Generator</h1>
          <p className="mt-0.5 text-xs font-mono text-muted-foreground">
            AI-GENERATED CREDIT APPRAISAL MEMO | RECOMMENDATION ENGINE OUTPUT
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <Printer className="h-3 w-3" />
            Print / Save PDF
          </button>
          <button
            onClick={handleExportWord}
            className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <FileText className="h-3 w-3" />
            Export Word
          </button>
          <button
            onClick={handleExportText}
            className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <Download className="h-3 w-3" />
            Export Text
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-lg border border-primary/20 bg-card p-6"
      >
        <div className="mb-4 text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary">
            Credit Appraisal Memorandum
          </p>
          <h2 className="mt-1 text-lg font-bold">{workspace.companyName}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            CIN: {workspace.cin} | Generated from the live Intelli-Credit workspace
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 lg:grid-cols-4">
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">FACILITY</p>
            <p className="mt-0.5 text-sm font-bold">{workspace.facilityType}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">REQUESTED</p>
            <p className="mt-0.5 text-sm font-bold numeric tabular-nums">
              Rs {workspace.recommendation.requestedAmountCr} Cr
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">RECOMMENDED</p>
            <p className="mt-0.5 text-sm font-bold text-primary numeric tabular-nums">
              Rs {workspace.recommendation.recommendedAmountCr} Cr
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">DECISION</p>
            <p className="mt-0.5 text-sm font-bold text-warning">
              {workspace.recommendation.decision}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 lg:grid-cols-4">
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">MODEL SCORE</p>
            <p className="mt-0.5 text-sm font-bold numeric tabular-nums">
              {workspace.creditModel.score}/900
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">MODEL GRADE</p>
            <p className="mt-0.5 text-sm font-bold text-primary">
              {workspace.creditModel.grade}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">READINESS</p>
            <p className="mt-0.5 text-sm font-bold numeric tabular-nums">
              {workspace.creditModel.readiness}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">PARSED DOCS</p>
            <p className="mt-0.5 text-sm font-bold numeric tabular-nums">
              {workspace.creditModel.parsedDocuments}/{workspace.creditModel.totalDocuments}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-lg border border-border bg-card p-4"
      >
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Credit Model Drivers
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {workspace.creditModel.factors.slice(0, 3).map((factor) => (
            <div key={factor.label} className="rounded-md border border-border bg-secondary/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold">{factor.label}</span>
                <span className="text-xs font-mono text-primary">{factor.score}/100</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {factor.detail}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="space-y-3">
        {workspace.camSections.map((section, index) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle className="h-3.5 w-3.5 text-success" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Section {index + 1}
              </span>
              <span className="text-xs font-semibold">{section.title}</span>
            </div>
            <p className="pl-5 text-xs leading-relaxed text-muted-foreground">
              {section.preview}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-lg border border-border bg-card p-4"
      >
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Key Covenants
        </p>
        <div className="space-y-2">
          {workspace.recommendation.covenants.map((covenant) => (
            <div key={covenant} className="flex items-start gap-3 text-xs text-muted-foreground">
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>{covenant}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default CAMGenerator;
