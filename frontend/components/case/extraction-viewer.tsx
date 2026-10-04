"use client";

import { Download, RefreshCw, ScanText } from "lucide-react";
import { toast } from "sonner";

import { ConfidenceBar, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, useDocument } from "@/hooks/queries";
import { formatCr, titleCase } from "@/lib/format";
import { severityTone, statusTone } from "@/lib/tones";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";

import { useCaseContext } from "./case-context";
import { DOC_TYPES } from "./upload-zone";

const FIELD_LABELS: Record<string, string> = {
  revenue: "Revenue", ebitda: "EBITDA", pat: "PAT", pbt: "PBT", total_debt: "Total debt", long_term_debt: "Long-term borrowings",
  short_term_debt: "Short-term borrowings", current_portion_ltd: "Current maturities of LTD", interest_expense: "Finance costs",
  depreciation: "Depreciation", net_worth: "Net worth", current_assets: "Current assets", current_liabilities: "Current liabilities",
  total_assets: "Total assets", receivables: "Receivables", inventory: "Inventory", payables: "Payables", cash: "Cash",
  operating_cash_flow: "Operating cash flow", contingent_liabilities: "Contingent liabilities", related_party_transactions: "Related-party txns",
};

function KV({ data }: { data: Record<string, any> }) {
  return (
    <dl className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {Object.entries(data).filter(([, v]) => v !== null && v !== undefined && typeof v !== "object").map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{titleCase(k)}</dt>
          <dd className="numeric break-words">{typeof v === "number" && v > 1e5 ? formatCr(v) : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ExtractionViewer({ documentId, onClose }: { documentId: string | null; onClose: () => void }) {
  const { data: doc, isLoading } = useDocument(documentId);
  const { watchJob } = useCaseContext();
  const can = useAuth((s) => s.can);
  const ex = doc?.extracted;

  const reprocess = async (type?: string) => {
    if (!doc) return;
    try {
      const job = await api.documents.reprocess(doc.id, type);
      watchJob(job.id);
      toast.message("Re-processing started");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Sheet open={!!documentId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><ScanText className="h-5 w-5 text-primary" />{doc?.filename ?? "Document"}</SheetTitle>
          <SheetDescription>Structured extraction with per-field confidence and source snippets.</SheetDescription>
        </SheetHeader>
        {isLoading || !doc ? <Skeleton className="mt-6 h-96" /> : !ex?.doc_type ? (
          <p className="mt-6 text-sm text-muted-foreground">{doc.error ?? "Extraction is still running…"}</p>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <ToneBadge tone="primary">{titleCase(ex.doc_type)}</ToneBadge>
              <ToneBadge tone={statusTone(ex.headline.financial_health === "STRONG" ? "pass" : ex.headline.financial_health === "MODERATE" ? "STABLE" : "fail")}>Health: {ex.headline.financial_health}</ToneBadge>
              {ex.ocr_used && <ToneBadge tone="accent">OCR used</ToneBadge>}
              <span className="text-xs text-muted-foreground">{ex.page_count} pages · {ex.fiscal_years.join(", ") || "no FY detected"}</span>
              <ConfidenceBar value={ex.confidence.overall} className="ml-auto" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => api.documents.download(doc.id, doc.filename)}><Download className="mr-1.5 h-3.5 w-3.5" />Original</Button>
              {can("analyst") && (
                <>
                  <Button size="sm" variant="outline" onClick={() => reprocess()}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Re-process</Button>
                  <Select onValueChange={(v) => reprocess(v)}>
                    <SelectTrigger className="h-8 w-56" aria-label="Reclassify as"><SelectValue placeholder="Reclassify as…" /></SelectTrigger>
                    <SelectContent>{DOC_TYPES.filter((d) => d.value !== "auto").map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </>
              )}
            </div>
            <Tabs defaultValue="summary">
              <TabsList className="flex-wrap">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="financials">Financials</TabsTrigger>
                <TabsTrigger value="tables">Tables ({ex.tables.length})</TabsTrigger>
                <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                <TabsTrigger value="text">Raw text</TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="space-y-5">
                <div className="rounded-xl border border-border p-4">
                  <p className="eyebrow mb-2">Structured output</p>
                  <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-xs">{JSON.stringify(ex.headline, null, 2)}</pre>
                </div>
                <div>
                  <p className="eyebrow mb-2">Why classified as {titleCase(ex.doc_type)} ({Math.round(ex.classification.confidence * 100)}%)</p>
                  <div className="flex flex-wrap gap-1.5">{ex.classification.signals.map((s) => <span key={s} className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px]">{s}</span>)}</div>
                </div>
                {(["gst", "bank", "legal", "sanction", "shareholding", "mca"] as const).map((k) => ex[k] && (
                  <div key={k} className="rounded-xl border border-border p-4">
                    <p className="eyebrow mb-3">{k === "mca" ? "MCA filing" : titleCase(k)} extraction</p>
                    <KV data={ex[k] as Record<string, any>} />
                    {k === "gst" && ex.gst?.returns.length ? (
                      <ul className="mt-3 space-y-1 text-sm">{ex.gst.returns.map((r) => <li key={r.return_type} className="flex justify-between"><span>{r.return_type}</span><span className="numeric">{formatCr(r.turnover)}</span></li>)}</ul>
                    ) : null}
                  </div>
                ))}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="eyebrow mb-2">Identifiers</p>
                    <div className="space-y-1 font-mono text-xs">
                      {[...ex.identifiers.gstins.map((g) => `GSTIN ${g}`), ...ex.identifiers.cins.map((c) => `CIN ${c}`), ...ex.directors.map((d) => `${d.name}${d.din ? ` · DIN ${d.din}` : ""}`)].map((x) => <p key={x}>{x}</p>)}
                      {!ex.identifiers.gstins.length && !ex.identifiers.cins.length && !ex.directors.length && <p className="font-sans text-muted-foreground">None found</p>}
                    </div>
                  </div>
                  <div>
                    <p className="eyebrow mb-2">Risk indicators</p>
                    <ul className="space-y-1.5 text-sm">
                      {ex.red_flags.map((f) => <li key={f.label} className="flex items-start gap-2"><ToneBadge tone={severityTone(f.severity)}>{f.severity}</ToneBadge><span>{f.label}</span></li>)}
                      {ex.positive_signals.map((p) => <li key={p} className="flex items-start gap-2"><ToneBadge tone="success">OK</ToneBadge><span>{p}</span></li>)}
                      {!ex.red_flags.length && !ex.positive_signals.length && <li className="text-muted-foreground">None</li>}
                    </ul>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="financials">
                {Object.keys(ex.financials).length === 0 ? <p className="text-sm text-muted-foreground">No financial line items in this document.</p> : (
                  <div className="space-y-4">
                    {Object.entries(ex.financials).sort(([a], [b]) => b.localeCompare(a)).map(([fy, fields]) => (
                      <div key={fy} className="overflow-hidden rounded-xl border border-border">
                        <p className="border-b border-border bg-muted/40 px-3 py-2 font-mono text-xs font-semibold">{fy}</p>
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-border">
                            {Object.entries(fields).map(([k, f]) => (
                              <tr key={k}>
                                <td className="w-44 px-3 py-1.5 text-muted-foreground">{FIELD_LABELS[k] ?? titleCase(k)}</td>
                                <td className="numeric w-28 px-3 py-1.5 text-right">{formatCr(f.value)}</td>
                                <td className="w-28 px-3 py-1.5"><ConfidenceBar value={f.confidence} /></td>
                                <td className="max-w-[260px] truncate px-3 py-1.5 font-mono text-[11px] text-muted-foreground" title={f.snippet}>{f.method}{f.page ? ` p.${f.page}` : ""} · {f.snippet}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="tables" className="space-y-4">
                {ex.tables.map((t, i) => (
                  <div key={i} className="overflow-x-auto rounded-xl border border-border scrollbar-thin">
                    <p className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">Page {t.page} · {t.method} · accuracy {Math.round(t.accuracy * 100)}%</p>
                    <table className="w-full text-xs">
                      <thead><tr>{t.header.map((h, j) => <th key={j} className="px-2 py-1.5 text-left font-semibold">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-border">{t.rows.slice(0, 30).map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className="numeric px-2 py-1">{c}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                ))}
                {!ex.tables.length && <p className="text-sm text-muted-foreground">No tables detected.</p>}
              </TabsContent>
              <TabsContent value="pipeline" className="space-y-4">
                <ol className="space-y-1.5">
                  {ex.stages.map((s) => (
                    <li key={s.name} className="flex items-center gap-3 text-sm">
                      <ToneBadge tone={s.status === "ok" ? "success" : "destructive"}>{s.status}</ToneBadge>
                      <span className="font-mono text-xs">{s.name}</span>
                      <span className="numeric ml-auto text-xs text-muted-foreground">{s.ms} ms</span>
                    </li>
                  ))}
                </ol>
                <div>
                  <p className="eyebrow mb-2">Pages</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ex.pages.map((p) => <span key={p.number} title={`${p.chars} chars, ${Math.round(p.confidence * 100)}% confidence`} className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${p.method === "ocr" ? "border-accent/40 text-accent" : "border-border"}`}>p{p.number}·{p.method}</span>)}
                  </div>
                </div>
                {ex.warnings.length > 0 && <ul className="list-disc pl-5 text-sm text-warning">{ex.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
              </TabsContent>
              <TabsContent value="text">
                <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-xs">{doc.text_preview}</pre>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
