"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, Files } from "lucide-react";
import { useState } from "react";

import { useCaseContext } from "@/components/case/case-context";
import { ExtractionViewer } from "@/components/case/extraction-viewer";
import { UploadZone } from "@/components/case/upload-zone";
import { ConfidenceBar, EmptyState, SectionCard, StatusBadge, ToneBadge } from "@/components/common/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/hooks/queries";
import { bytes, relativeTime, titleCase } from "@/lib/format";
import { useAuth } from "@/store/auth";

export default function DocumentsPage() {
  const { caseId, watchJob } = useCaseContext();
  const { data: docs, isLoading } = useDocuments(caseId);
  const [selected, setSelected] = useState<string | null>(null);
  const can = useAuth((s) => s.can);
  const processing = docs?.filter((d) => d.status === "uploaded" || d.status === "processing").length ?? 0;

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      {can("analyst") && (
        <SectionCard eyebrow="Ingestion" title="Upload evidence" className="xl:col-span-2">
          <UploadZone caseId={caseId} onUploaded={(ids) => ids.forEach(watchJob)} />
          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            <p className="mb-1.5 font-semibold text-foreground">Pipeline</p>
            <p className="font-mono">PDF → text layer / OCR → tables (pdfplumber, Camelot) → classification → entity & financial extraction → normalisation (₹, lakh/crore, FY) → confidence scoring → structured JSON</p>
          </div>
        </SectionCard>
      )}
      <SectionCard eyebrow="Upload history" title="Documents" className={can("analyst") ? "xl:col-span-3" : "xl:col-span-5"} bodyClassName="p-0"
        actions={processing > 0 && <ToneBadge tone="primary" dot className="[&>span]:animate-pulse-dot">{processing} processing</ToneBadge>}>
        {isLoading ? <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div> : !docs?.length ? (
          <div className="p-5"><EmptyState icon={Files} title="No documents yet" description="Drop the borrower's document pack to start extraction." /></div>
        ) : (
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {docs.map((d) => (
                <motion.li key={d.id} layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>
                  <button className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-muted/40 disabled:cursor-default" onClick={() => setSelected(d.id)}
                    disabled={d.status !== "processed" && d.status !== "failed"} aria-label={`Open extraction for ${d.filename}`}>
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {bytes(d.size_bytes)} · {d.page_count ?? "—"} pages · {relativeTime(d.created_at)}{d.ocr_used && " · OCR"}{d.error && ` · ${d.error}`}
                      </p>
                    </div>
                    {d.doc_type && <ToneBadge tone="primary" className="hidden sm:inline-flex">{titleCase(d.doc_type)}</ToneBadge>}
                    {d.status === "processed" ? <ConfidenceBar value={d.extraction_confidence} /> : <StatusBadge status={d.status} />}
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </SectionCard>
      <ExtractionViewer documentId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
