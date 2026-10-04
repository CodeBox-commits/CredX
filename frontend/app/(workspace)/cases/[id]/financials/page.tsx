"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Sheet as SheetIcon, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LeverageTrend, MonthlyFlows, RevenueTrend } from "@/charts/financial-charts";
import { useCaseContext } from "@/components/case/case-context";
import { BlockSkeleton, EmptyState, SectionCard, Stat, ToneBadge } from "@/components/common/primitives";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage, useFinancials } from "@/hooks/queries";
import { formatCr, pct, times } from "@/lib/format";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";

const ROWS: [string, string][] = [
  ["revenue", "Revenue from operations"], ["ebitda", "EBITDA"], ["depreciation", "Depreciation"], ["interest_expense", "Finance costs"],
  ["pat", "Profit after tax"], ["net_worth", "Net worth"], ["long_term_debt", "Long-term borrowings"], ["short_term_debt", "Short-term borrowings"],
  ["current_portion_ltd", "Current maturities of LTD"], ["total_debt", "Total debt"], ["current_assets", "Current assets"],
  ["current_liabilities", "Current liabilities"], ["receivables", "Trade receivables"], ["inventory", "Inventories"], ["payables", "Trade payables"],
  ["cash", "Cash & equivalents"], ["operating_cash_flow", "Operating cash flow"], ["total_assets", "Total assets"],
];

const RATIOS: { key: string; label: string; fmt: (v: number | null) => string; bench: string; good: (v: number) => boolean }[] = [
  { key: "ebitda_margin", label: "EBITDA margin", fmt: pct, bench: "> 12%", good: (v) => v > 0.12 },
  { key: "revenue_growth", label: "Revenue growth", fmt: pct, bench: "> 8%", good: (v) => v > 0.08 },
  { key: "dscr", label: "DSCR", fmt: times, bench: "≥ 1.25x", good: (v) => v >= 1.25 },
  { key: "interest_coverage", label: "Interest coverage", fmt: times, bench: "≥ 2.5x", good: (v) => v >= 2.5 },
  { key: "debt_to_ebitda", label: "Debt / EBITDA", fmt: times, bench: "≤ 3.5x", good: (v) => v <= 3.5 },
  { key: "debt_equity", label: "Debt / Equity", fmt: times, bench: "≤ 2.0x", good: (v) => v <= 2 },
  { key: "current_ratio", label: "Current ratio", fmt: times, bench: "≥ 1.33x", good: (v) => v >= 1.33 },
  { key: "receivable_days", label: "Receivable days", fmt: (v) => (v === null ? "—" : `${Math.round(v)}`), bench: "≤ 90", good: (v) => v <= 90 },
  { key: "tol_tnw", label: "TOL / TNW", fmt: times, bench: "≤ 3.0x", good: (v) => v <= 3 },
];

export default function FinancialsPage() {
  const { caseId, overview } = useCaseContext();
  const { data, isLoading } = useFinancials(caseId);
  const can = useAuth((s) => s.can);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ fy: string; key: string; value: string } | null>(null);

  if (isLoading) return <BlockSkeleton />;
  if (!data?.statements.length) return <EmptyState icon={SheetIcon} title="No financial statements extracted yet" description="Upload an annual report or audited financials on the Documents tab." />;

  const statements = [...data.statements].reverse();
  const save = async () => {
    if (!editing) return;
    const num = editing.value.trim() === "" ? null : Number(editing.value) * 1e7;
    if (num !== null && Number.isNaN(num)) return toast.error("Enter a number in ₹ crore");
    const reason = window.prompt("Reason for the manual adjustment (audit trail):", "Per audited financials");
    if (!reason) return;
    try {
      await api.financials.update(caseId, editing.fy, { [editing.key]: num }, reason);
      toast.success("Financials updated", { description: "Re-score the case to reflect the change." });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["case", caseId] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const banks = overview?.facts.bank ?? [];
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard eyebrow="Trend" title="Revenue & profitability">{data.ratios.trend.length ? <RevenueTrend trend={data.ratios.trend} /> : null}</SectionCard>
        <SectionCard eyebrow="Trend" title="Coverage & leverage">{data.ratios.trend.length ? <LeverageTrend trend={data.ratios.trend} /> : null}</SectionCard>
      </div>

      <SectionCard eyebrow="Spread" title="Extracted financial statements (₹ crore)" bodyClassName="p-0" info="Hover a value for its source document, page and snippet. Analysts can correct values; edits are audited and marked manual.">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Line item</th>
                {statements.map((s) => (
                  <th key={s.fiscal_year} className="px-4 py-2 text-right font-mono text-xs">
                    {s.fiscal_year} {s.source === "manual" && <ToneBadge tone="accent" className="ml-1">edited</ToneBadge>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROWS.map(([key, label]) => (
                <tr key={key} className="group hover:bg-muted/30">
                  <td className="px-4 py-1.5 text-muted-foreground">{label}</td>
                  {statements.map((s) => {
                    const v = s.values[key];
                    const prov = s.provenance[key];
                    const isEditing = editing?.fy === s.fiscal_year && editing.key === key;
                    return (
                      <td key={s.fiscal_year} className="numeric px-4 py-1.5 text-right">
                        {isEditing ? (
                          <span className="inline-flex items-center gap-1">
                            <Input autoFocus className="h-7 w-24 text-right" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(null); }} aria-label={`${label} ${s.fiscal_year} in crore`} />
                            <button onClick={save} aria-label="Save"><Check className="h-3.5 w-3.5 text-success" /></button>
                            <button onClick={() => setEditing(null)} aria-label="Cancel"><X className="h-3.5 w-3.5" /></button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={prov?.method === "manual" ? "text-accent" : prov?.method === "derived" ? "italic" : ""}>{v === null || v === undefined ? "—" : (v / 1e7).toFixed(2)}</span>
                              </TooltipTrigger>
                              {prov && (
                                <TooltipContent className="max-w-sm text-xs">
                                  <p className="font-semibold">{prov.method === "manual" ? `Manual edit by ${prov.by}` : `${prov.filename}${prov.page ? `, page ${prov.page}` : ""}`}</p>
                                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{prov.snippet}</p>
                                  <p className="mt-1">Confidence {Math.round(prov.confidence * 100)}%</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                            {can("analyst") && (
                              <button className="opacity-0 transition group-hover:opacity-100" onClick={() => setEditing({ fy: s.fiscal_year, key, value: v ? (v / 1e7).toFixed(2) : "" })} aria-label={`Edit ${label} ${s.fiscal_year}`}>
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Analysis" title="Ratio analysis vs lending benchmarks" bodyClassName="p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ratio</th>
                {data.ratios.trend.map((r) => <th key={r.fiscal_year} className="px-4 py-2 text-right font-mono text-xs">{r.fiscal_year}</th>)}
                <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Benchmark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {RATIOS.map((r) => (
                <tr key={r.key}>
                  <td className="px-4 py-2 text-muted-foreground">{r.label}</td>
                  {data.ratios.trend.map((t) => {
                    const v = t[r.key] as number | null;
                    return <td key={t.fiscal_year} className={`numeric px-4 py-2 text-right ${v === null ? "" : r.good(v) ? "text-success" : "text-destructive"}`}>{r.fmt(v)}</td>;
                  })}
                  <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">{r.bench}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {banks.map((b) => (
        <SectionCard key={b.document_id} eyebrow="Banking conduct" title={`${b.bank_name ?? "Bank"} · ${b.account_masked ?? ""}`}>
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-4 content-start">
              <Stat label="Total credits" value={formatCr(b.total_credits)} />
              <Stat label="Avg balance" value={formatCr(b.average_balance)} />
              <Stat label="Bounces" value={b.bounce_count ?? 0} />
              <Stat label="Overdrawn days" value={b.overdraw_days ?? 0} />
              <Stat label="Credit volatility" value={b.credit_volatility !== null && b.credit_volatility !== undefined ? pct(b.credit_volatility, 0) : "—"} />
              <Stat label="Transactions" value={b.transaction_count ?? "—"} />
            </div>
            <div className="lg:col-span-2">{b.monthly?.length ? <MonthlyFlows monthly={b.monthly} /> : <p className="text-sm text-muted-foreground">Summary statement — no transaction-level data.</p>}</div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
