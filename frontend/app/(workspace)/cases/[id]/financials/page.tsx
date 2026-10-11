"use client";

import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Landmark, LineChart, Loader2, Pencil, ReceiptIndianRupee, Sheet as SheetIcon, Table2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LeverageTrend, MonthlyFlows, RevenueTrend } from "@/charts/financial-charts";
import { useCaseContext } from "@/components/case/case-context";
import { BlockSkeleton, Delta, EmptyState, SectionCard, Sparkline, Stat, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage, useFinancials } from "@/hooks/queries";
import { formatCr, pct, times } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";

const GROUPS: { title: string; rows: [string, string][] }[] = [
  { title: "Profit & loss", rows: [["revenue", "Revenue from operations"], ["ebitda", "EBITDA"], ["depreciation", "Depreciation"], ["interest_expense", "Finance costs"], ["pat", "Profit after tax"]] },
  { title: "Balance sheet", rows: [["net_worth", "Net worth"], ["long_term_debt", "Long-term borrowings"], ["short_term_debt", "Short-term borrowings"], ["current_portion_ltd", "Current maturities of LTD"], ["total_debt", "Total debt"], ["total_assets", "Total assets"]] },
  { title: "Working capital", rows: [["current_assets", "Current assets"], ["current_liabilities", "Current liabilities"], ["receivables", "Trade receivables"], ["inventory", "Inventories"], ["payables", "Trade payables"], ["cash", "Cash & equivalents"]] },
  { title: "Cash flow", rows: [["operating_cash_flow", "Operating cash flow"]] },
];

const RATIOS: { key: string; label: string; fmt: (v: number | null) => string; bench: string; good: (v: number) => boolean; why: string }[] = [
  { key: "ebitda_margin", label: "EBITDA margin", fmt: pct, bench: "> 12%", good: (v) => v > 0.12, why: "Operating profitability" },
  { key: "revenue_growth", label: "Revenue growth", fmt: pct, bench: "> 8%", good: (v) => v > 0.08, why: "Business momentum" },
  { key: "dscr", label: "DSCR", fmt: times, bench: "≥ 1.25x", good: (v) => v >= 1.25, why: "Ability to service debt from accruals" },
  { key: "interest_coverage", label: "Interest coverage", fmt: times, bench: "≥ 2.5x", good: (v) => v >= 2.5, why: "EBITDA cover on finance cost" },
  { key: "debt_to_ebitda", label: "Debt / EBITDA", fmt: times, bench: "≤ 3.5x", good: (v) => v <= 3.5, why: "Years of EBITDA to repay debt" },
  { key: "debt_equity", label: "Debt / Equity", fmt: times, bench: "≤ 2.0x", good: (v) => v <= 2, why: "Promoter skin in the game" },
  { key: "current_ratio", label: "Current ratio", fmt: times, bench: "≥ 1.33x", good: (v) => v >= 1.33, why: "Short-term liquidity (Tandon norm)" },
  { key: "receivable_days", label: "Receivable days", fmt: (v) => (v === null ? "—" : `${Math.round(v)}`), bench: "≤ 90", good: (v) => v <= 90, why: "Collection efficiency" },
  { key: "inventory_days", label: "Inventory days", fmt: (v) => (v === null ? "—" : `${Math.round(v)}`), bench: "≤ 90", good: (v) => v <= 90, why: "Stock holding period" },
];

type View = "spread" | "ratios" | "banking";
const pick = (o: Record<string, any>, ...keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null);

export default function FinancialsPage() {
  const { caseId, overview } = useCaseContext();
  const { data, isLoading } = useFinancials(caseId);
  const can = useAuth((s) => s.can);
  const qc = useQueryClient();
  const [view, setView] = useState<View>("spread");
  const [editing, setEditing] = useState<{ fy: string; key: string; label: string; value: string } | null>(null);
  const [reason, setReason] = useState("Per audited financials");
  const [saving, setSaving] = useState(false);

  if (isLoading) return <BlockSkeleton />;
  if (!data?.statements.length) {
    return <EmptyState icon={SheetIcon} title="No financial statements extracted yet" description="Upload an annual report or audited financials in Documents, then run analysis." />;
  }

  const statements = [...data.statements].sort((a, b) => a.fiscal_year.localeCompare(b.fiscal_year));
  const latest = statements[statements.length - 1];
  const prev = statements[statements.length - 2];
  const yoy = (k: string) => {
    const a = latest.values[k], b = prev?.values[k];
    return a != null && b ? ((a - b) / Math.abs(b)) * 100 : null;
  };
  const series = (k: string) => statements.map((s) => s.values[k] ?? 0);

  const save = async () => {
    if (!editing) return;
    const num = editing.value.trim() === "" ? null : Number(editing.value) * 1e7;
    if (num !== null && Number.isNaN(num)) return toast.error("Enter a number in ₹ crore");
    if (!reason.trim()) return toast.error("A reason is required for the audit trail");
    setSaving(true);
    try {
      await api.financials.update(caseId, editing.fy, { [editing.key]: num }, reason);
      toast.success("Financials updated", { description: "Re-score the case to reflect the change." });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["case", caseId] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const banks = overview?.facts.bank ?? [];
  const gst = overview?.facts.gst ?? [];

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { k: "revenue", label: "Revenue" }, { k: "ebitda", label: "EBITDA" }, { k: "pat", label: "PAT" }, { k: "net_worth", label: "Net worth" },
          { k: "total_debt", label: "Total debt", invert: true },
        ].map((m, i) => (
          <motion.div key={m.k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="panel p-4">
            <p className="text-[13px] text-muted-foreground">{m.label} · {latest.fiscal_year}</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <p className="numeric text-xl font-semibold">{formatCr(latest.values[m.k])}</p>
                <Delta value={yoy(m.k)} invert={m.invert} />
              </div>
              <Sparkline values={series(m.k)} tone={m.invert ? ((yoy(m.k) ?? 0) > 0 ? "destructive" : "success") : (yoy(m.k) ?? 0) >= 0 ? "success" : "destructive"} className="w-20" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Revenue & profitability" icon={LineChart}>{data.ratios.trend.length ? <RevenueTrend trend={data.ratios.trend} /> : null}</SectionCard>
        <SectionCard title="Coverage & leverage" icon={LineChart}>{data.ratios.trend.length ? <LeverageTrend trend={data.ratios.trend} /> : null}</SectionCard>
      </div>

      <div className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-sm" role="tablist">
        {([["spread", "Financial spread", Table2], ["ratios", "Ratio scorecard", LineChart], ["banking", "Banking & GST", Landmark]] as const).map(([v, label, Icon]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={cn("relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition", view === v ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {view === v && <motion.span layoutId="fin-view" className="absolute inset-0 rounded-lg bg-primary" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
            <Icon className="relative h-4 w-4" /><span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {view === "spread" && (
        <SectionCard title="Extracted statements (₹ crore)" icon={Table2} bodyClassName="p-0" info="Hover a value for its source document, page and snippet. Analysts can correct values; every edit is audited.">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border/70">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Line item</th>
                  {statements.map((s) => (
                    <th key={s.fiscal_year} className="px-5 py-3 text-right font-mono text-xs font-semibold">
                      {s.fiscal_year}{s.source === "manual" && <ToneBadge tone="accent" className="ml-1.5">edited</ToneBadge>}
                    </th>
                  ))}
                </tr>
              </thead>
              {GROUPS.map((g) => (
                <tbody key={g.title} className="divide-y divide-border/50">
                  <tr className="bg-muted/40"><td colSpan={statements.length + 1} className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</td></tr>
                  {g.rows.map(([key, label]) => (
                    <tr key={key} className={cn("group transition hover:bg-muted/30", ["ebitda", "pat", "total_debt", "net_worth"].includes(key) && "font-semibold")}>
                      <td className="px-5 py-2 text-muted-foreground">{label}</td>
                      {statements.map((s) => {
                        const v = s.values[key];
                        const prov = s.provenance[key];
                        return (
                          <td key={s.fiscal_year} className="numeric px-5 py-2 text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={cn("cursor-help rounded px-1 transition hover:bg-primary/10", prov?.method === "manual" && "text-accent", prov?.method === "derived" && "italic")}>
                                    {v === null || v === undefined ? "—" : (v / 1e7).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </TooltipTrigger>
                                {prov && (
                                  <TooltipContent className="max-w-sm text-xs">
                                    <p className="font-semibold">{prov.method === "manual" ? `Manual edit by ${prov.by}` : `${prov.filename}${prov.page ? ` · page ${prov.page}` : ""}`}</p>
                                    {prov.snippet && <p className="mt-1 rounded bg-muted px-1.5 py-1 font-mono text-[11px]">{prov.snippet}</p>}
                                    <p className="mt-1 text-muted-foreground">Confidence {Math.round(prov.confidence * 100)}%{prov.method ? ` · ${prov.method}` : ""}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                              {can("analyst") && (
                                <button className="rounded p-0.5 opacity-0 transition hover:bg-muted group-hover:opacity-100"
                                  onClick={() => setEditing({ fy: s.fiscal_year, key, label, value: v ? (v / 1e7).toFixed(2) : "" })} aria-label={`Edit ${label} ${s.fiscal_year}`}>
                                  <Pencil className="h-3 w-3 text-muted-foreground" />
                                </button>
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </SectionCard>
      )}

      {view === "ratios" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {RATIOS.map((r, i) => {
            const vals = data.ratios.trend.map((t) => t[r.key] as number | null);
            const last = vals[vals.length - 1];
            const ok = last != null && r.good(last);
            return (
              <motion.div key={r.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.why}</p>
                  </div>
                  {last != null && <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", ok ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive")}>{ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}</span>}
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className={cn("numeric text-2xl font-semibold", last == null ? "" : ok ? "text-success" : "text-destructive")}>{r.fmt(last)}</p>
                  <Sparkline values={vals.map((v) => v ?? 0)} tone={ok ? "success" : "destructive"} />
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5 text-xs">
                  <span className="numeric text-muted-foreground">{data.ratios.trend.map((t, j) => <span key={t.fiscal_year}>{j > 0 && " → "}{r.fmt(t[r.key] as number | null)}</span>)}</span>
                  <span className="font-mono text-muted-foreground">{r.bench}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {view === "banking" && (
        <div className="grid gap-6 xl:grid-cols-2">
          {banks.map((b, i) => {
            const monthly = b.monthly as { month: string; credits: number; debits: number }[] | undefined;
            return (
              <SectionCard key={i} title={`${pick(b, "bank_name", "bank") ?? "Bank"} · ${pick(b, "account_masked", "account") ?? ""}`} icon={Landmark} className={monthly?.length ? "xl:col-span-2" : ""}>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Stat label="Monthly credits" value={formatCr(pick(b, "monthly_credit") ?? (pick(b, "total_credits") ?? 0) / 12)} />
                  <Stat label="Credit volatility" value={pick(b, "credit_volatility", "volatility") != null ? pct(pick(b, "credit_volatility", "volatility"), 0) : "—"} />
                  <Stat label="Cheque / ECS returns" value={pick(b, "bounce_count", "bounces") ?? 0} tone={(pick(b, "bounce_count", "bounces") ?? 0) > 0 ? "destructive" : "success"} />
                  {pick(b, "average_balance") != null && <Stat label="Average balance" value={formatCr(pick(b, "average_balance"))} />}
                  {pick(b, "overdraw_days") != null && <Stat label="Overdrawn days" value={pick(b, "overdraw_days")} />}
                </div>
                {monthly?.length ? <div className="mt-5"><MonthlyFlows monthly={monthly} /></div> : null}
              </SectionCard>
            );
          })}
          {gst.map((g, i) => {
            const rows = [["GSTR-1 (outward, reported to buyers)", g.gstr1], ["GSTR-3B (self-declared, tax paid)", g.gstr3b], ["GSTR-2A (as reported by counterparties)", g.gstr2a]] as [string, number | undefined][];
            const max = Math.max(...rows.map(([, v]) => v ?? 0), 1);
            const gap = g.gstr3b && g.gstr2a ? (g.gstr3b - g.gstr2a) / g.gstr3b : null;
            return (
              <SectionCard key={`gst-${i}`} title="GST turnover reconciliation" icon={ReceiptIndianRupee}
                actions={gap != null && <ToneBadge tone={gap > 0.08 ? "destructive" : gap > 0.03 ? "warning" : "success"}>2A vs 3B gap {(gap * 100).toFixed(1)}%</ToneBadge>}>
                <ul className="space-y-3">
                  {rows.map(([label, v]) => (
                    <li key={label}>
                      <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">{label}</span><span className="numeric font-semibold">{formatCr(v)}</span></div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70 transition-all duration-700" style={{ width: `${((v ?? 0) / max) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border/70 pt-4">
                  <Stat label="ITC claimed" value={formatCr(g.itc)} />
                  <Stat label="GST paid in cash" value={formatCr(g.tax)} />
                </div>
              </SectionCard>
            );
          })}
          {!banks.length && !gst.length && <div className="xl:col-span-2"><EmptyState icon={Landmark} title="No banking or GST data yet" description="Upload bank statements and GST returns to see conduct and reconciliation." /></div>}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editing?.label}</DialogTitle>
            <DialogDescription>{editing?.fy} · values in ₹ crore. Manual edits are marked in the spread and recorded in the audit trail.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="fin-value">Value (₹ Cr)</Label><Input id="fin-value" autoFocus inputMode="decimal" value={editing?.value ?? ""} onChange={(e) => editing && setEditing({ ...editing, value: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save()} /></div>
            <div className="space-y-1.5"><Label htmlFor="fin-reason">Reason</Label><Input id="fin-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="animate-spin" />} Save change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
