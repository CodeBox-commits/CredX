import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  BarChart2,
  Banknote,
  Receipt,
  BrainCircuit,
  FileCheck2,
  SearchCheck,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  uploadMultipleFiles,
  type AnalysisHighlight,
  type AnalysisSignal,
  type UploadedFileMeta,
} from "@/lib/uploadApi";
import { useWorkspace } from "@/hooks/useWorkspace";
import { AIInsightCard } from "@/components/AIInsightCard";

type ResultRow = {
  document: string;
  keyFinding: string;
  financialImpact: string;
  status: "Parsed" | "Uploaded" | "Parse Failed";
};

type FlattenedSignal = AnalysisSignal & {
  document: string;
};

type FlattenedHighlight = AnalysisHighlight & {
  document: string;
};

const stats = [
  { label: "Extraction Accuracy", value: "98%" },
  { label: "AI Insights", value: "Real-time" },
  { label: "Fast Results", value: "< 30s" },
];

const severityRank: Record<AnalysisSignal["severity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function toRiskLabel(riskLevel?: string | null): string {
  if (!riskLevel) return "Awaiting upload";
  return riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1);
}

function getScoreLabel(score: number | null): string {
  if (score === null) return "Awaiting analysis";
  if (score >= 750) return "Excellent";
  if (score >= 680) return "Stable";
  if (score >= 620) return "Watch";
  return "Stressed";
}

function getSignalTone(severity: AnalysisSignal["severity"]): string {
  if (severity === "high") return "bg-red-50 text-red-700";
  if (severity === "medium") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function getPillarTone(status: "waiting" | "partial" | "ready"): string {
  if (status === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

const CreditScoreCard = ({
  score,
  riskLevel,
  summary,
}: {
  score: number | null;
  riskLevel: string;
  summary: string;
}) => {
  const circumference = 2 * Math.PI * 60;
  const normalizedScore = score ?? 0;
  const offset = circumference - (normalizedScore / 900) * circumference;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-500">
            Document Risk Score
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-slate-900">
              {score ?? "--"}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Risk: {riskLevel}
            </span>
          </div>
        </div>
      </div>

      <div className="relative mt-6 flex items-center justify-center">
        <svg width={160} height={160} viewBox="0 0 160 160">
          <circle
            cx="80"
            cy="80"
            r="60"
            stroke="#E5E7EB"
            strokeWidth="16"
            fill="none"
          />
          <circle
            cx="80"
            cy="80"
            r="60"
            stroke="url(#scoreGradient)"
            strokeWidth="16"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 80 80)"
          />
          <defs>
            <linearGradient
              id="scoreGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="33%" stopColor="#F59E0B" />
              <stop offset="66%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl font-bold text-slate-900">
              {score ?? "--"}
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {getScoreLabel(score)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
        {summary}
      </div>
    </div>
  );
};

const DocumentAnalyzer = () => {
  const uploadRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileMeta[]>([]);
  const { workspace, setDocuments } = useWorkspace();

  useEffect(() => {
    setUploadedFiles(workspace.documents);
  }, [workspace.documents]);

  const processingLabel = useMemo(() => {
    if (progress === 0) return "Upload files to begin ingestion and extraction.";
    if (progress < 25) return "Reading uploaded documents and preparing text extraction...";
    if (progress < 55) return "Parsing PDF pages and identifying financial cues...";
    if (progress < 85) return "Scoring risk signals and drafting highlights...";
    if (progress < 100) return "Finalizing analysis output for review...";
    return "Analysis completed successfully.";
  }, [progress]);

  const parsedFiles = useMemo(
    () =>
      uploadedFiles.filter(
        (file) => file.parse_summary?.status === "parsed",
      ),
    [uploadedFiles],
  );

  const overview = useMemo(() => {
    if (parsedFiles.length === 0) {
      return {
        score: null as number | null,
        riskLevel: "Awaiting upload",
        summary:
          "Upload a PDF to generate a score, review priority, and extracted risk signals.",
      };
    }

    const summaries = parsedFiles
      .map((file) => file.parse_summary)
      .filter((summary): summary is NonNullable<UploadedFileMeta["parse_summary"]> =>
        summary !== null,
      );
    const scores = summaries
      .map((summary) => summary.score)
      .filter((score): score is number => typeof score === "number");

    const worstScore = scores.length > 0 ? Math.min(...scores) : null;
    const riskLevel = summaries.some((summary) => summary.risk_level === "high")
      ? "High"
      : summaries.some((summary) => summary.risk_level === "medium")
        ? "Medium"
        : "Low";

    return {
      score: worstScore,
      riskLevel,
      summary:
        summaries.find((summary) => summary.summary)?.summary ??
        `Analyzed ${parsedFiles.length} document(s).`,
    };
  }, [parsedFiles]);

  const topSignals = useMemo(() => {
    const flattened = parsedFiles.flatMap((file) =>
      (file.parse_summary?.signals ?? []).map((signal) => ({
        ...signal,
        document: file.original_filename,
      })),
    );

    return flattened
      .sort((left, right) => {
        const severityDelta =
          severityRank[left.severity] - severityRank[right.severity];
        if (severityDelta !== 0) return severityDelta;
        return left.document.localeCompare(right.document);
      })
      .slice(0, 4);
  }, [parsedFiles]);

  const topHighlights = useMemo(() => {
    return parsedFiles
      .flatMap((file) =>
        (file.parse_summary?.highlights ?? []).map((highlight) => ({
          ...highlight,
          document: file.original_filename,
        })),
      )
      .slice(0, 4);
  }, [parsedFiles]);

  const rows = useMemo<ResultRow[]>(() => {
    return uploadedFiles.map((file) => {
      const summary = file.parse_summary;
      const status: ResultRow["status"] =
        summary?.status === "parsed"
          ? "Parsed"
          : summary?.status === "failed"
            ? "Parse Failed"
            : "Uploaded";

      const keyFinding =
        summary?.status === "parsed"
          ? summary.summary ??
            summary.signals?.[0]?.label ??
            `Parsed ${summary.detected_document_type ?? "document"}`
          : summary?.status === "failed"
            ? `Parse failed: ${summary.reason ?? "Unknown error"}`
            : `Stored as ${file.stored_filename}`;

      const financialImpact =
        summary?.status === "parsed"
          ? [
              summary.detected_document_type,
              typeof summary.score === "number" ? `Score ${summary.score}` : null,
              summary.risk_level ? `${toRiskLabel(summary.risk_level)} risk` : null,
              summary.page_count ? `${summary.page_count} page(s)` : null,
            ]
              .filter(Boolean)
              .join(" | ")
          : `${(file.size_bytes / 1024).toFixed(1)} KB`;

      return {
        document: file.original_filename,
        keyFinding,
        financialImpact:
          financialImpact || `${summary?.character_count ?? 0} chars extracted`,
        status,
      };
    });
  }, [uploadedFiles]);

  const hasPipelineOutput = workspace.creditModel.parsedDocuments > 0;

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelection = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0 || processing) return;

    setUploadMessage(null);
    setProcessing(true);
    setProgress(10);

    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + 10;
      });
    }, 400);

    try {
      const response = await uploadMultipleFiles({ files });
      const parsedCount = response.files.filter(
        (file) => file.parse_summary?.status === "parsed",
      ).length;
      const failedCount = response.files.filter(
        (file) => file.parse_summary?.status === "failed",
      ).length;

      clearInterval(timer);
      setProcessing(false);
      setProgress(100);
      setUploadedFiles(response.files);
      setDocuments(response.files);
      setUploadMessage(
        response.processing_mode === "local"
          ? parsedCount > 0
            ? `Backend unreachable, so CredX switched to local browser analysis. Parsed ${parsedCount} file(s) and refreshed research, credit risk, and CAM outputs together.`
            : `Backend unreachable, and local analysis could not fully parse ${failedCount} file(s). Review the results table for details.`
          : parsedCount > 0
            ? `Uploaded ${response.count} file(s). Parsed ${parsedCount} PDF(s) and refreshed all three pillars across the workspace.`
            : failedCount > 0
              ? `Uploaded ${response.count} file(s), but analysis failed for ${failedCount} file(s). Review the results table for details.`
              : `Uploaded ${response.count} file(s) successfully.`,
      );
    } catch (error) {
      clearInterval(timer);
      setProcessing(false);
      setProgress(0);
      const message =
        error instanceof Error ? error.message : "Unknown upload error";
      setUploadMessage(`Upload failed: ${message}`);
    } finally {
      event.target.value = "";
    }
  };

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-gradient-to-br from-[#eef3ff] to-white p-8 shadow-sm">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                AI Powered Credit Intelligence
              </h1>
              <p className="max-w-xl text-base text-slate-600">
                Analyze financial documents, evaluate corporate credit risk, and
                generate CAM reports instantly using AI.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="rounded-full bg-blue-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                  onClick={scrollToUpload}
                >
                  Start Credit Analysis
                </Button>
                <Button className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Learn More
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap gap-4">
                {stats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {item.value}
                    </div>
                    <div className="text-xs text-slate-500">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <CreditScoreCard
              score={overview.score}
              riskLevel={overview.riskLevel}
              summary={overview.summary}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-blue-900">
            Financial Document Analyzer
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload annual reports and bank statements for AI-driven extraction
            of credit risk indicators.
          </p>
        </div>

        <Card className="border border-[#d9e2ff] bg-[#f8faff] shadow-sm">
          <CardHeader>
            <CardTitle className="text-blue-900">
              Upload Source Documents
            </CardTitle>
            <CardDescription className="text-blue-900">
              Supported documents include the ones below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-6 py-6">
            <div
              ref={uploadRef}
              className="group flex h-[270px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-[#d9e2ff] bg-white p-8 text-center transition hover:border-[#4f6ef7] hover:shadow-[0_8px_25px_rgba(79,110,247,0.15)]"
              onClick={openFilePicker}
            >
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                multiple
                onChange={handleFileSelection}
              />
              <UploadCloud className="mb-4 h-12 w-12 text-blue-900" />
              <p className="text-lg font-semibold text-blue-900">
                Click to upload source files
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Upload PDFs, bank statements, GST files, and related documents
              </p>
              <Button
                type="button"
                className="mt-5 rounded-full bg-blue-900 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Start Extraction
              </Button>
            </div>
            {uploadMessage ? (
              <p
                className={`text-sm ${
                  uploadMessage.startsWith("Upload failed")
                    ? "text-red-600"
                    : "text-emerald-700"
                }`}
              >
                {uploadMessage}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <BarChart2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Annual Reports
                  </div>
                  <div className="text-xs text-slate-500">
                    Detailed financial statements and disclosures.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Banknote className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Bank Statements
                  </div>
                  <div className="text-xs text-slate-500">
                    Cash flow, credit usage, and payment history.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    GST Returns
                  </div>
                  <div className="text-xs text-slate-500">
                    GST filings, tax liabilities, and compliance data.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Auditor Notes
                  </div>
                  <div className="text-xs text-slate-500">
                    Insights from auditors about risk and disclosures.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-blue-900">Processing Status</CardTitle>
            <CardDescription className="text-blue-900">
              {processingLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} className="h-3 bg-slate-100" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">
                {processing ? "Processing in progress" : "Ready"}
              </span>
              <span className="font-semibold text-blue-900">{progress}%</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-blue-900">
                Three-Pillar Pipeline Status
              </CardTitle>
              <CardDescription className="text-blue-900">
                A single ingestion run now updates parsing, research, and recommendation outputs together
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {workspace.creditModel.pillars.map((pillar) => (
                <div
                  key={pillar.name}
                  className={`rounded-2xl border p-4 ${getPillarTone(pillar.status)}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{pillar.name}</div>
                    <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                      {pillar.status}
                    </span>
                  </div>
                  <div className="mt-3 text-xs leading-5">{pillar.detail}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-blue-900">Model Readiness</CardTitle>
              <CardDescription className="text-blue-900">
                Shared credit model feeding both the risk page and CAM generator
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    Score
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {workspace.creditModel.score}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    Grade
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {workspace.creditModel.grade}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    Readiness
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {workspace.creditModel.readiness}%
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {workspace.creditModel.factors.slice(0, 3).map((factor) => (
                  <div
                    key={factor.label}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">
                        {factor.label}
                      </div>
                      <div className="text-sm font-semibold text-blue-900">
                        {factor.score}/100
                      </div>
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-600">
                      {factor.detail}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-blue-900">Top Risk Signals</CardTitle>
              <CardDescription className="text-blue-900">
                Highest-priority cues extracted from the uploaded documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topSignals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No parsed signals yet. Upload a PDF to populate risk cues and
                  document scoring.
                </div>
              ) : (
                topSignals.map((signal: FlattenedSignal) => (
                  <div
                    key={`${signal.document}-${signal.label}-${signal.page_number ?? "na"}`}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {signal.label}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {signal.detail}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${getSignalTone(
                          signal.severity,
                        )}`}
                      >
                        {toRiskLabel(signal.severity)}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      {signal.document}
                      {signal.page_number ? ` | Page ${signal.page_number}` : ""}
                    </div>
                    {signal.excerpt ? (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                        {signal.excerpt}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-blue-900">Review Highlights</CardTitle>
              <CardDescription className="text-blue-900">
                Key metadata and summary points captured during analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topHighlights.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Highlights will appear here once a document has been parsed.
                </div>
              ) : (
                topHighlights.map((highlight: FlattenedHighlight) => (
                  <div
                    key={`${highlight.document}-${highlight.title}-${highlight.page_number ?? "na"}`}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {highlight.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {highlight.detail}
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      {highlight.document}
                      {highlight.page_number
                        ? ` | Page ${highlight.page_number}`
                        : ""}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <SearchCheck className="h-5 w-5" />
                Pillar 2: Research Agent Output
              </CardTitle>
              <CardDescription className="text-blue-900">
                Secondary research and primary note integration refreshed from
                the latest ingested documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasPipelineOutput ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Upload a document to generate synchronized research insights
                  for the borrower profile.
                </div>
              ) : (
                <>
                  {workspace.aiInsights.map((insight) => (
                    <AIInsightCard
                      key={insight.title}
                      title={insight.title}
                      insight={insight.insight}
                      severity={insight.severity}
                      tags={insight.tags}
                    />
                  ))}
                  <div className="grid gap-3 md:grid-cols-2">
                    {workspace.researchNews.slice(0, 2).map((item) => (
                      <div
                        key={`${item.source}-${item.date}-${item.title}`}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {item.source} | {item.date}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">
                          {item.title}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          Sentiment score: {item.score > 0 ? "+" : ""}
                          {item.score.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to="/research"
                      className="inline-flex items-center gap-2 rounded-full bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Open Research Agent
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                      Tracked company: {workspace.companyName}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <BrainCircuit className="h-5 w-5" />
                Pillar 3: Credit Risk Model
              </CardTitle>
              <CardDescription className="text-blue-900">
                Lending recommendation is recalculated from the ingested signals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasPipelineOutput ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Once documents are ingested, CredX will generate sanction
                  recommendations, pricing cues, and the CAM draft here.
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Recommendation
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-900">
                          {workspace.recommendation.decision}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          {workspace.recommendation.rationale}
                        </div>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-700">
                        <div>
                          Recommended amount:{" "}
                          <span className="font-semibold text-blue-900">
                            Rs {workspace.recommendation.recommendedAmountCr} Cr
                          </span>
                        </div>
                        <div>
                          Indicative rate:{" "}
                          <span className="font-semibold text-blue-900">
                            {workspace.recommendation.rate}%
                          </span>
                        </div>
                        <div>
                          Overall score:{" "}
                          <span className="font-semibold text-blue-900">
                            {workspace.overallScore}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {workspace.scenarios.map((scenario) => (
                      <div
                        key={scenario.label}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {scenario.label}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          Amount: Rs {scenario.amountCr} Cr
                        </div>
                        <div className="text-sm text-slate-600">
                          PD: {scenario.pd}%
                        </div>
                        <div className="text-sm text-slate-600">
                          Risk Score: {scenario.riskScore}/100
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      to="/credit-risk"
                      className="inline-flex items-center gap-2 rounded-full bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Open Credit Risk Model
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/cam-generator"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Open CAM Generator
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <FileCheck2 className="h-5 w-5" />
              Instant CAM Preview
            </CardTitle>
            <CardDescription className="text-blue-900">
              Generated immediately from the same ingestion run, without needing
              a separate manual step
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasPipelineOutput ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Upload a document to generate the CAM summary sections
                automatically.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {workspace.camSections.slice(0, 3).map((section) => (
                    <div
                      key={section.title}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="text-sm font-semibold text-slate-900">
                        {section.title}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        {section.preview}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  The uploaded documents now feed all three pillars together:
                  ingestion extracted the evidence, research synthesized the
                  borrower context, and the recommendation engine refreshed the
                  CAM draft immediately.
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-blue-900">Extracted Results</CardTitle>
            <CardDescription className="text-blue-900">
              Structured output ready for Credit Manager review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-50 hover:bg-blue-50">
                  <TableHead className="w-[24%] py-3 text-blue-900">
                    Document Name
                  </TableHead>
                  <TableHead className="w-[34%] py-3 text-blue-900">
                    Key Finding
                  </TableHead>
                  <TableHead className="w-[28%] py-3 text-blue-900">
                    Financial Impact
                  </TableHead>
                  <TableHead className="w-[14%] py-3 text-blue-900">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      No documents processed yet. Upload files to view extracted
                      results.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={`${row.document}-${row.keyFinding}`}
                      className="odd:bg-white even:bg-slate-50/60"
                    >
                      <TableCell className="py-4 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-900" />
                          {row.document}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-slate-700">
                        {row.keyFinding}
                      </TableCell>
                      <TableCell className="py-4 text-slate-700">
                        {row.financialImpact}
                      </TableCell>
                      <TableCell className="py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                            row.status === "Parsed"
                              ? "bg-emerald-50 text-emerald-700"
                              : row.status === "Parse Failed"
                                ? "bg-red-50 text-red-700"
                                : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {row.status === "Parse Failed" ? (
                            <AlertCircle className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          {row.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default DocumentAnalyzer;
