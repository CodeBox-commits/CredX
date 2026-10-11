"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CloudUpload, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { GrowBar } from "@/components/common/motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { errorMessage, qk } from "@/hooks/queries";
import { DOC_TYPE_META, docMeta, guessDocType } from "@/lib/doc-types";
import { bytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";

export const DOC_TYPES: { value: string; label: string }[] = [{ value: "auto", label: "Auto-detect" }, ...DOC_TYPE_META.map((d) => ({ value: d.value, label: d.label }))];

const MAX_MB = 25;

export function UploadZone({ caseId, onUploaded, compact = false }: { caseId: string; onUploaded?: (jobIds: string[]) => void; compact?: boolean }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [docType, setDocType] = useState("auto");

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setFiles((prev) => [...prev, ...accepted.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
    rejected.forEach((r) => toast.error(`${r.file.name}: ${r.errors[0]?.message}`));
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: files.length > 0,
    maxSize: MAX_MB * 1024 * 1024,
    accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg", ".tif", ".tiff"], "text/plain": [".txt"], "text/csv": [".csv"] },
  });

  const upload = async () => {
    if (!files.length) return;
    setProgress(0);
    try {
      const res = await api.documents.upload(caseId, files, { autoAnalyze, declaredType: docType === "auto" ? undefined : docType }, setProgress);
      toast.success(`${res.documents.length} document(s) queued for extraction`, {
        description: autoAnalyze ? "Full analysis starts automatically once extraction finishes." : undefined,
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
    <div {...getRootProps()} className="space-y-4 outline-none" aria-label="Upload documents">
      <input {...getInputProps()} />
      <button type="button" onClick={open}
        className={cn(
          "group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed text-center transition",
          compact ? "px-5 py-7" : "px-6 py-12",
          isDragActive ? "scale-[1.01] border-primary bg-primary/[0.07]" : "border-border bg-surface-2/60 hover:border-primary/50 hover:bg-primary/[0.03]",
        )}>
        {isDragActive && <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-br from-primary/10 to-accent/10" />}
        <motion.span animate={{ y: isDragActive ? -6 : 0, scale: isDragActive ? 1.08 : 1 }}
          className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/25">
          <CloudUpload className="h-6 w-6" />
        </motion.span>
        <span className="relative font-display text-base font-semibold">{isDragActive ? "Drop to add to the pack" : "Drop the borrower's document pack here"}</span>
        <span className="relative mt-1 text-sm text-muted-foreground">or <span className="font-medium text-primary underline-offset-4 group-hover:underline">browse files</span> · PDF, images, TXT, CSV up to {MAX_MB} MB</span>
        {!compact && <span className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3 text-primary" /> Scanned pages are OCR&apos;d and documents auto-classified</span>}
      </button>

      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <ul className="divide-y divide-border/70 rounded-xl border border-border bg-surface">
              {files.map((f) => {
                const meta = docMeta(guessDocType(f.name));
                return (
                  <motion.li key={f.name + f.size} layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: meta.colour.replace(")", " / 0.12)"), color: meta.colour }}><meta.icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.name}</span>
                      <span className="block text-xs text-muted-foreground">{bytes(f.size)} · {meta.value === "unknown" ? "type detected after upload" : `looks like ${meta.label.toLowerCase()}`}</span>
                    </span>
                    <button type="button" className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((x) => x !== f))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-9 w-48" aria-label="Document type hint"><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Switch checked={autoAnalyze} onCheckedChange={setAutoAnalyze} aria-label="Run full analysis after extraction" /> Auto-run full analysis
              </label>
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="ghost" onClick={open}>Add more</Button>
                <Button type="button" onClick={upload} disabled={progress !== null}>
                  {progress !== null ? <Loader2 className="animate-spin" /> : <CloudUpload />} Upload {files.length} file{files.length > 1 ? "s" : ""}
                </Button>
              </div>
            </div>
            {progress !== null && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                <GrowBar pct={progress} duration={200} className="rounded-full bg-gradient-to-r from-primary to-accent" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
