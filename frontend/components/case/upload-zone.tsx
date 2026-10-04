"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CloudUpload, FileText, Loader2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { errorMessage, qk } from "@/hooks/queries";
import { bytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";

export const DOC_TYPES: { value: string; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "annual_report", label: "Annual report" },
  { value: "financial_statement", label: "Financial statements" },
  { value: "gst_return", label: "GST returns" },
  { value: "bank_statement", label: "Bank statement" },
  { value: "legal_notice", label: "Legal notice" },
  { value: "sanction_letter", label: "Sanction letter" },
  { value: "shareholding_pattern", label: "Shareholding pattern" },
  { value: "mca_filing", label: "MCA filing" },
  { value: "rating_report", label: "Rating report" },
];

const MAX_MB = 25;

export function UploadZone({ caseId, onUploaded }: { caseId: string; onUploaded?: (jobIds: string[]) => void }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [docType, setDocType] = useState("auto");

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setFiles((prev) => [...prev, ...accepted.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
    rejected.forEach((r) => toast.error(`${r.file.name}: ${r.errors[0]?.message}`));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_MB * 1024 * 1024,
    accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg", ".tif", ".tiff"], "text/plain": [".txt"], "text/csv": [".csv"] },
  });

  const upload = async () => {
    if (!files.length) return;
    setProgress(0);
    try {
      const res = await api.documents.upload(caseId, files, { autoAnalyze, declaredType: docType === "auto" ? undefined : docType }, setProgress);
      toast.success(`${res.documents.length} document(s) queued for ingestion`, {
        description: autoAnalyze ? "Full analysis will start automatically once extraction finishes." : undefined,
      });
      res.rejected.forEach((r) => toast.warning(`${r.filename} skipped`, { description: r.reason }));
      setFiles([]);
      qc.invalidateQueries({ queryKey: qk.documents(caseId) });
      qc.invalidateQueries({ queryKey: qk.overview(caseId) });
      onUploaded?.(res.jobs.map((j) => j.id));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
          isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/60 hover:bg-primary/5",
        )}
        aria-label="Upload documents"
      >
        <input {...getInputProps()} />
        <motion.div animate={{ y: isDragActive ? -4 : 0 }} className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CloudUpload className="h-6 w-6" />
        </motion.div>
        <p className="font-display text-base font-semibold">{isDragActive ? "Drop to add" : "Drag & drop the borrower's document pack"}</p>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          Annual reports, GST returns (GSTR-1/3B/2A), bank statements, legal notices, sanction letters, shareholding & MCA filings.
          Scanned PDFs and images are OCR'd automatically. Up to {MAX_MB} MB each.
        </p>
      </div>

      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
            <ul className="divide-y divide-border rounded-xl border border-border">
              {files.map((f) => (
                <li key={f.name + f.size} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="numeric text-xs text-muted-foreground">{bytes(f.size)}</span>
                  <button className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((x) => x !== f))}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Type hint</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="h-8 w-48" aria-label="Document type hint"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={autoAnalyze} onCheckedChange={setAutoAnalyze} aria-label="Auto-analyze" /> Run full analysis when ingestion completes
              </label>
              <Button className="ml-auto" onClick={upload} disabled={progress !== null}>
                {progress !== null && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Upload {files.length} file{files.length > 1 ? "s" : ""}
              </Button>
            </div>
            {progress !== null && <Progress value={progress} aria-label="Upload progress" />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
