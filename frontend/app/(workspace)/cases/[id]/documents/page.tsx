"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleDashed, FileSearch, Files, ListChecks, Loader2, ScanText } from "lucide-react";
import { useState } from "react";

import { useCaseContext } from "@/components/case/case-context";
import { ExtractionViewer } from "@/components/case/extraction-viewer";
import { UploadZone } from "@/components/case/upload-zone";
import { ConfidenceBar, EmptyState, SectionCard, StatusBadge, ToneBadge } from "@/components/common/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/hooks/queries";
import { DOC_TYPE_META, docMeta } from "@/lib/doc-types";
import { bytes, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import type { DocumentRecord } from "@/types/api";

function Checklist({ docs }: { docs: DocumentRecord[] }) {
  const items = DOC_TYPE_META.filter((d) => d.need !== "optional" || docs.some((x) => x.doc_type === d.value));
  const required = items.filter((d) => d.need === "required");
  const haveRequired = required.filter((d) => docs.some((x) => x.doc_type === d.value)).length;
  return (
    <SectionCard title="Underwriting checklist" icon={ListChecks}
      actions={<span className="numeric text-xs text-muted-foreground"><b className="text-foreground">{haveRequired}</b>/{required.length} required</span>}>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all duration-700" style={{ width: `${(haveRequired / required.length) * 100}%` }} />
      </div>
      <ul className="space-y-1.5">
        {items.map((d) => {
          const got = docs.filter((x) => x.doc_type === d.value);
          const processing = got.some((x) => x.status === "processing" || x.status === "uploaded");
          const conf = got.length ? Math.max(...got.map((x) => x.extraction_confidence ?? 0)) : null;
          return (
            <li key={d.value} className={cn("flex items-center gap-3 rounded-xl px-2.5 py-2", got.length ? "bg-transparent" : "bg-muted/40")}>
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                got.length && !processing ? "bg-success text-success-foreground" : processing ? "bg-primary/12 text-primary" : "border-2 border-dashed border-border text-muted-foreground")}>
                {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : got.length ? <Check className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5 opacity-0" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  {d.label}
                  {d.need === "required" && !got.length && <ToneBadge tone="warning">Required</ToneBadge>}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{got.length ? `${got.length} file${got.length > 1 ? "s" : ""}${processing ? " · extracting…" : ""}` : d.hint}</span>
              </span>
              {conf !== null && !processing && <ConfidenceBar value={conf} />}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

export default function DocumentsPage() {
  const { caseId, watchJob } = useCaseContext();
  const { data: docs, isLoading } = useDocuments(caseId);
  const [selected, setSelected] = useState<string | null>(null);
  const can = useAuth((s) => s.can);
  const processing = docs?.filter((d) => d.status === "uploaded" || d.status === "processing").length ?? 0;
  const pages = docs?.reduce((s, d) => s + (d.page_count ?? 0), 0) ?? 0;
  const ocr = docs?.filter((d) => d.ocr_used).length ?? 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {can("analyst") && (
          <SectionCard title="Add documents" icon={FileSearch} info="PDF → text layer / OCR → tables (pdfplumber, Camelot) → classification → entity & financial extraction → normalisation (₹, lakh/crore, FY) → confidence scoring.">
            <UploadZone caseId={caseId} compact={!!docs?.length} onUploaded={(ids) => ids.forEach(watchJob)} />
          </SectionCard>
        )}

        <SectionCard title="Document pack" icon={Files} bodyClassName="p-0"
          actions={
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {processing > 0 && <ToneBadge tone="primary" dot pulse>{processing} extracting</ToneBadge>}
              {!!docs?.length && <span className="numeric">{docs.length} files · {pages} pages{ocr ? ` · ${ocr} OCR'd` : ""}</span>}
            </div>
          }>
          {isLoading ? (
            <div className="grid gap-3 p-5 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : !docs?.length ? (
            <div className="p-5"><EmptyState icon={Files} title="No documents yet" description="Drop the borrower's document pack above to start AI extraction." /></div>
          ) : (
            <ul className="grid gap-3 p-5 sm:grid-cols-2">
              <AnimatePresence initial={false}>
                {docs.map((d, i) => {
                  const meta = docMeta(d.doc_type);
                  const ready = d.status === "processed" || d.status === "failed";
                  return (
                    <motion.li key={d.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                      <button className={cn("group w-full rounded-xl border border-border bg-surface p-3.5 text-left transition", ready && "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md", !ready && "cursor-default")}
                        onClick={() => ready && setSelected(d.id)} aria-label={`Open extraction for ${d.filename}`}>
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: meta.colour.replace(")", " / 0.12)"), color: meta.colour }}>
                            <meta.icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{d.filename}</span>
                            <span className="block text-xs text-muted-foreground">{meta.label} · {d.page_count ?? "—"} pages · {bytes(d.size_bytes)}</span>
                          </span>
                          {d.ocr_used && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"><ScanText className="h-3 w-3" />OCR</span>}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          {d.status === "processed" ? <ConfidenceBar value={d.extraction_confidence} /> : <StatusBadge status={d.status} />}
                          <span className="text-[11px] text-muted-foreground">{ready ? <span className="text-primary opacity-0 transition group-hover:opacity-100">View extraction →</span> : relativeTime(d.created_at)}</span>
                        </div>
                        {d.status === "processing" && <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted"><div className="shimmer h-full w-full rounded-full bg-primary/30" /></div>}
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="space-y-6">
        <Checklist docs={docs ?? []} />
      </div>
      <ExtractionViewer documentId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
