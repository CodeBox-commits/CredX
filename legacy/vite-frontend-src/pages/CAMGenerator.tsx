import { motion } from "framer-motion";
import { CheckCircle, Download, FileText, Printer } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { WorkspaceSyncBanner } from "@/components/WorkspaceSyncBanner";
import type { PlatformAnalysisBundle } from "@/lib/platformTypes";

function buildCamDocument(
  workspace: ReturnType<typeof useWorkspace>["workspace"],
  platformBundle: PlatformAnalysisBundle | null,
): string {
  const liveDecision = platformBundle?.decision;
  const liveCam = platformBundle?.cam;
  const liveResearch = platformBundle?.research;
  const camSections = liveCam
    ? liveCam.sections.map((section) => ({
        title: section.title,
        preview: section.content,
      }))
    : workspace.camSections;
  const requestedAmount = workspace.requestedAmountCr;
  const recommendedAmount =
    liveDecision?.recommended_loan_amount ?? workspace.recommendation.recommendedAmountCr;
  const decision = liveDecision?.decision ?? workspace.recommendation.decision;
  const rate =
    liveDecision?.suggested_interest_rate ?? workspace.recommendation.rate;
  const tenor =
    liveDecision?.decision === "APPROVE"
      ? "36 months"
      : liveDecision?.decision === "CONDITIONAL APPROVAL"
        ? "24 months"
        : workspace.recommendation.tenor;
  const header = [
    "CREDIT APPRAISAL MEMORANDUM",
    workspace.companyName,
    `CIN: ${workspace.cin}`,
    `Facility: ${workspace.facilityType}`,
    `Requested Amount: Rs ${requestedAmount} Cr`,
    `Recommended Amount: Rs ${recommendedAmount} Cr`,
    `Decision: ${decision}`,
    `Indicative Rate: ${rate}%`,
    `Tenor: ${tenor}`,
    "",
  ].join("\n");

  const sections = camSections
    .map((section, index) => `${index + 1}. ${section.title}\n${section.preview}`)
    .join("\n\n");

  const covenants = workspace.recommendation.covenants
    .map((covenant) => `- ${covenant}`)
    .join("\n");

  const sourceCoverage = workspace.sourceCoverage
    .map(
      (item) =>
        `- ${item.label} [${item.sourceType}] - ${item.available ? "Available" : "Missing"}: ${item.detail}`,
    )
    .join("\n");

  const structuredSynthesis = workspace.structuredSynthesis
    .map(
      (item) =>
        `- ${item.label}: ${item.value} (${item.status}) - ${item.explanation}`,
    )
    .join("\n");

  const researchFindings = liveResearch
    ? liveResearch.findings
        .map(
          (item) =>
            `- ${item.category.toUpperCase()}: ${item.title} - ${item.detail}`,
        )
        .join("\n")
    : workspace.researchFindings
        .map(
          (item) =>
            `- ${item.category.toUpperCase()}: ${item.title} - ${item.detail}`,
        )
        .join("\n");

  const primaryAdjustments = workspace.primaryAdjustments
    .map(
      (item) =>
        `- ${item.label}: ${item.delta > 0 ? "+" : ""}${item.delta} | ${item.reason}`,
    )
    .join("\n");

  const decisionTrace = liveDecision
    ? liveDecision.factors
        .map(
          (item) =>
            `- ${item.label}: ${item.impact.toUpperCase()} (${Math.round(Math.abs(item.contribution))}) - ${item.detail}`,
        )
        .join("\n")
    : workspace.decisionTrace
        .map(
          (item) =>
            `- ${item.title}: ${item.impact.toUpperCase()} (${item.weight}) - ${item.detail}`,
        )
        .join("\n");

  const monitoringTriggers = workspace.monitoringTriggers
    .map(
      (item) =>
        `- ${item.title}: ${item.status.toUpperCase()} | ${item.threshold}`,
    )
    .join("\n");

  return `${header}${sections}

SOURCE COVERAGE
${sourceCoverage}

STRUCTURED SYNTHESIS
${structuredSynthesis}

SECONDARY RESEARCH
${researchFindings}

PRIMARY INSIGHT ADJUSTMENTS
${primaryAdjustments}

DECISION TRACE
${decisionTrace}

MONITORING TRIGGERS
${monitoringTriggers}

COVENANTS
${covenants}
`;
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
  const { workspace, analysis } = useWorkspace();
  const liveDecision = analysis.bundle?.decision;
  const liveCam = analysis.bundle?.cam;
  const liveResearch = analysis.bundle?.research;
  const camSections = liveCam
    ? liveCam.sections.map((section) => ({
        title: section.title,
        preview: section.content,
      }))
    : workspace.camSections;
  const modelFactors = liveDecision?.factors ?? workspace.creditModel.factors;
  const decision = liveDecision?.decision ?? workspace.recommendation.decision;
  const requestedAmount = workspace.requestedAmountCr;
  const recommendedAmount =
    liveDecision?.recommended_loan_amount ?? workspace.recommendation.recommendedAmountCr;
  const suggestedRate =
    liveDecision?.suggested_interest_rate ?? workspace.recommendation.rate;

  const handleExportWord = () => {
    triggerDownload(
      `${workspace.companyName.replace(/\s+/g, "_")}_CAM.doc`,
      buildCamDocument(workspace, analysis.bundle),
      "application/msword",
    );
  };

  const handleExportText = () => {
    triggerDownload(
      `${workspace.companyName.replace(/\s+/g, "_")}_CAM.txt`,
      buildCamDocument(workspace, analysis.bundle),
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
          <div className="mt-3">
            <WorkspaceSyncBanner
              status={analysis.status}
              message={analysis.message}
              updated_at={analysis.updated_at}
            />
          </div>
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
              Rs {requestedAmount} Cr
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">RECOMMENDED</p>
            <p className="mt-0.5 text-sm font-bold text-primary numeric tabular-nums">
              Rs {recommendedAmount} Cr
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">DECISION</p>
            <p className="mt-0.5 text-sm font-bold text-warning">
              {decision}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 lg:grid-cols-4">
          <div className="text-center">
            <p className="text-[10px] font-mono text-muted-foreground">MODEL SCORE</p>
            <p className="mt-0.5 text-sm font-bold numeric tabular-nums">
              {liveDecision?.credit_score ?? workspace.creditModel.score}/900
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
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          {(liveCam?.export_formats ?? ["pdf", "docx"]).map((format) => (
            <span
              key={format}
              className="rounded-full border border-border bg-secondary px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground"
            >
              {format}
            </span>
          ))}
          <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
            Rate {suggestedRate}%
          </span>
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
          {modelFactors.slice(0, 3).map((factor) => (
            <div key={factor.label} className="rounded-md border border-border bg-secondary/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold">{factor.label}</span>
                <span className="text-xs font-mono text-primary">
                  {"score" in factor ? `${factor.score}/100` : Math.round(Math.abs(factor.contribution))}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {factor.detail}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Structured Synthesis
          </p>
          <div className="space-y-3">
            {workspace.structuredSynthesis.map((item) => (
              <div key={item.label} className="rounded-md border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span
                    className={
                      item.status === "healthy"
                        ? "text-xs font-semibold text-success"
                        : item.status === "watch"
                          ? "text-xs font-semibold text-warning"
                          : item.status === "risk"
                            ? "text-xs font-semibold text-destructive"
                            : "text-xs font-semibold text-muted-foreground"
                    }
                  >
                    {item.status.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-primary">{item.value}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.explanation}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Decision Trace
          </p>
          <div className="space-y-3">
            {workspace.decisionTrace.map((item) => (
              <div key={item.title} className="rounded-md border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{item.title}</span>
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
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="space-y-3">
        {camSections.map((section, index) => (
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
        transition={{ delay: 0.28 }}
        className="rounded-lg border border-border bg-card p-4"
      >
        {liveResearch ? (
          <div className="mb-4 rounded-md border border-primary/10 bg-primary/5 p-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
              Live Research Summary
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {liveResearch.summary}
            </p>
          </div>
        ) : null}
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Source Coverage
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {workspace.sourceCoverage.map((item) => (
            <div key={item.label} className="rounded-md border border-border bg-secondary/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{item.label}</span>
                <span
                  className={
                    item.available
                      ? "text-xs font-semibold text-success"
                      : "text-xs font-semibold text-warning"
                  }
                >
                  {item.available ? "AVAILABLE" : "MISSING"}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {item.sourceType}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

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
