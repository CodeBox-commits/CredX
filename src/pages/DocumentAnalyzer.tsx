import { useMemo, useState } from "react";
import { UploadCloud, FileText, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const DocumentAnalyzer = () => {
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

  return (
    <div className="space-y-6 bg-white">
      <div>
        <h1 className="text-2xl font-bold text-blue-900">Financial Document Analyzer</h1>
        <p className="mt-1 text-sm text-blue-900">
          Upload annual reports and bank statements for AI-driven extraction of credit risk indicators
        </p>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-blue-900">Upload Source Documents</CardTitle>
          <CardDescription className="text-blue-900">
            Supported: Annual Reports, Bank Statements, GST Returns, Auditor Notes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex h-[280px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors hover:bg-blue-50/60"
            onClick={simulateProcessing}
          >
            <UploadCloud className="mb-4 h-12 w-12 text-blue-900" />
            <p className="text-lg font-semibold text-blue-900">Drag and drop files here</p>
            <p className="mt-2 text-sm text-slate-700">or click to upload Annual Report and Bank Statement</p>
            <Button className="mt-5 bg-blue-900 text-white hover:bg-blue-800">Start Extraction</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-blue-900">Processing Status</CardTitle>
          <CardDescription className="text-blue-900">{processingLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progress} className="h-3 bg-slate-100" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700">{processing ? "Processing in progress" : "Ready"}</span>
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
                <TableHead className="w-[24%] py-3 text-blue-900">Document Name</TableHead>
                <TableHead className="w-[34%] py-3 text-blue-900">Key Finding</TableHead>
                <TableHead className="w-[28%] py-3 text-blue-900">Financial Impact</TableHead>
                <TableHead className="w-[14%] py-3 text-blue-900">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extractedRows.map((row) => (
                <TableRow key={`${row.document}-${row.keyFinding}`} className="odd:bg-white even:bg-slate-50/60">
                  <TableCell className="py-4 font-medium text-slate-800">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-900" />
                      {row.document}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-slate-700">{row.keyFinding}</TableCell>
                  <TableCell className="py-4 text-slate-700">{row.financialImpact}</TableCell>
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
    </div>
  );
};

export default DocumentAnalyzer;
