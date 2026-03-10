import { useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  BarChart2,
  Banknote,
  Receipt,
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

const extractedRows = [
  {
    document: "FY24 Annual Report",
    keyFinding: "Pending Litigation Rs. 50 Cr",
    financialImpact: "Potential provisioning increase of Rs. 12 Cr",
    status: "Extracted",
  },
  {
    document: "Bank Statement Q4",
    keyFinding: "Debt Servicing Delay observed on 2 instances",
    financialImpact: "Estimated liquidity stress of Rs. 8 Cr",
    status: "Extracted",
  },
  {
    document: "GST Returns FY24",
    keyFinding: "GSTR-2A vs GSTR-3B mismatch: Rs. 2.3 Cr",
    financialImpact: "Possible revenue adjustment of Rs. 2.3 Cr",
    status: "Extracted",
  },
  {
    document: "Auditor Notes",
    keyFinding: "Contingent Liability disclosure incomplete",
    financialImpact: "Uncertain exposure up to Rs. 15 Cr",
    status: "Extracted",
  },
];

const stats = [
  { label: "Extraction Accuracy", value: "98%" },
  { label: "AI Insights", value: "Real-time" },
  { label: "Fast Results", value: "< 30s" },
];

const CreditScoreCard = ({
  score,
  riskLevel,
}: {
  score: number;
  riskLevel: string;
}) => {
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (score / 900) * circumference;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-500">
            Your CredX Score
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-slate-900">{score}</span>
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
            <div className="text-3xl font-bold text-slate-900">{score}</div>
            <div className="text-xs font-semibold text-slate-500">
              Excellent
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
        + Credit history, payment trends, and financial ratios all factored into
        your score.
      </div>
    </div>
  );
};

const DocumentAnalyzer = () => {
  const uploadRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);

  const processingLabel = useMemo(() => {
    if (progress < 25) return "Running OCR on financial statements...";
    if (progress < 55) return "Extracting Contingent Liabilities...";
    if (progress < 85) return "Mapping litigation and covenant clauses...";
    if (progress < 100) return "Validating extracted entities and values...";
    return "Extraction completed successfully.";
  }, [progress]);

  const simulateProcessing = () => {
    if (processing) return;
    setProcessing(true);
    setProgress(10);

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 15;
        if (next >= 100) {
          clearInterval(timer);
          setProcessing(false);
          return 100;
        }
        return next;
      });
    }, 500);
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
            <CreditScoreCard score={736} riskLevel="Low" />
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
              onClick={simulateProcessing}
            >
              <UploadCloud className="mb-4 h-12 w-12 text-blue-900" />
              <p className="text-lg font-semibold text-blue-900">
                Drag and drop files here
              </p>
              <p className="mt-2 text-sm text-slate-700">
                or click to upload Annual Report and Bank Statement
              </p>
              <Button className="mt-5 rounded-full bg-blue-900 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                Start Extraction
              </Button>
            </div>

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
                {extractedRows.map((row) => (
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
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {row.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default DocumentAnalyzer;

