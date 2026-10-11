"use client";

import { type ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, BriefcaseBusiness, Columns3, List, Plus, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { DecisionBadge, EmptyState, MeterBar, PageHeader, StatusBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCases } from "@/hooks/queries";
import { formatCr, relativeTime, titleCase } from "@/lib/format";
import { scoreTone, toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { useUi } from "@/store/ui";
import type { CreditCase } from "@/types/api";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "ingesting,analyzing", label: "Analysing" },
  { value: "in_review", label: "In review" },
  { value: "escalated", label: "Committee" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Declined" },
];

const BOARD = [
  { label: "Draft", statuses: ["draft"] },
  { label: "Analysing", statuses: ["ingesting", "analyzing"] },
  { label: "In review", statuses: ["in_review"] },
  { label: "Committee", statuses: ["escalated"] },
  { label: "Decided", statuses: ["approved", "rejected"] },
];

/** 0–5 lifecycle position used for the mini progress bar. */
function stageIndex(c: CreditCase) {
  if (c.final_decision) return 5;
  if (c.latest_score) return 4;
  if (c.status === "analyzing") return 2;
  if (c.status === "ingesting") return 1;
  return 0;
}

function StageDots({ c }: { c: CreditCase }) {
  const idx = stageIndex(c);
  return (
    <div className="flex items-center gap-1" aria-label={`Stage ${idx} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("h-1.5 w-4 rounded-full", i <= idx ? (c.status === "rejected" ? "bg-destructive" : "bg-primary") : "bg-muted")} />
      ))}
    </div>
  );
}

function ScorePill({ score }: { score: number | null }) {
  const tone = scoreTone(score);
  return (
    <span className="numeric inline-flex min-w-[48px] justify-center rounded-lg px-2 py-1 text-sm font-semibold"
      style={{ color: toneHsl[tone], background: toneHsl[tone].replace(")", " / 0.1)") }}>{score ?? "—"}</span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-xs font-bold text-primary">
      {name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
    </span>
  );
}

function CasesView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const risk = params.get("risk") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [view, setView] = useState<"table" | "board">("table");
  const [sorting, setSorting] = useState<SortingState>([{ id: params.get("sort") === "score" ? "score" : "updated_at", desc: true }]);
  const { data, isLoading } = useCases({ q: q || undefined, status: status || undefined, risk: risk || undefined });
  const can = useAuth((s) => s.can);
  const setNewCase = useUi((s) => s.setNewCase);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const columns = useMemo<ColumnDef<CreditCase>[]>(() => [
    {
      id: "company", accessorFn: (r) => r.company.name, header: "Borrower",
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={row.original.company.name} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{row.original.company.name}</p>
            <p className="truncate text-xs text-muted-foreground"><span className="font-mono">{row.original.reference}</span> · {titleCase(row.original.company.sector)}</p>
          </div>
        </div>
      ),
    },
    {
      id: "amount", accessorKey: "requested_amount", header: "Facility",
      cell: ({ row }) => <div><p className="numeric font-medium">{formatCr(row.original.requested_amount)}</p><p className="text-xs text-muted-foreground">{row.original.facility_type}</p></div>,
    },
    { id: "stage", accessorFn: stageIndex, header: "Progress", cell: ({ row }) => <div className="space-y-1.5"><StatusBadge status={row.original.status} /><StageDots c={row.original} /></div> },
    { id: "score", accessorKey: "latest_score", header: "Score", sortingFn: "basic", cell: ({ getValue }) => <ScorePill score={getValue() as number | null} /> },
    {
      id: "fraud", accessorKey: "latest_fraud_score", header: "Fraud",
      cell: ({ getValue }) => { const v = getValue() as number | null; return v === null ? <span className="text-muted-foreground">—</span> : <MeterBar value={v} className="w-24" />; },
    },
    { id: "decision", accessorFn: (r) => r.final_decision ?? "", header: "Decision", cell: ({ row }) => row.original.final_decision ? <DecisionBadge decision={row.original.final_decision} /> : <span className="text-xs text-muted-foreground">Pending</span> },
    {
      id: "owner", accessorFn: (r) => r.assigned_to?.full_name ?? "", header: "Owner",
      cell: ({ row }) => row.original.assigned_to ? (
        <span className="flex items-center gap-2 text-xs"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">{row.original.assigned_to.full_name.split(" ").map((p) => p[0]).join("")}</span>{row.original.assigned_to.full_name.split(" ")[0]}</span>
      ) : <span className="text-xs text-muted-foreground">Unassigned</span>,
    },
    { id: "updated_at", accessorKey: "updated_at", header: "Updated", cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{relativeTime(getValue() as string)}</span> },
  ], []);

  const table = useReactTable({
    data: data?.items ?? [], columns, state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
  });
  const filtered = !!(status || risk || q);

  return (
    <>
      <PageHeader
        icon={BriefcaseBusiness}
        title="Credit cases"
        description="Every application with its stage, score, fraud signal and decision. Click a row to open the case workspace."
        actions={can("analyst") && <Button onClick={() => setNewCase(true)}><Plus /> New case</Button>}
      />

      <div className="panel mb-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 pl-9" placeholder="Search borrower, reference, GSTIN" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search cases" />
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => {
            const active = status === f.value;
            return (
              <button key={f.label} role="tab" aria-selected={active} onClick={() => setParam("status", f.value)}
                className={cn("relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {active && <motion.span layoutId="status-filter" className="absolute inset-0 rounded-lg bg-muted" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                <span className="relative">{f.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 lg:ml-auto">
          <Select value={risk || "all"} onValueChange={(v) => setParam("risk", v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Filter by risk"><SelectValue placeholder="Any risk" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any risk</SelectItem>
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => <SelectItem key={r} value={r}>{titleCase(r.toLowerCase())} risk</SelectItem>)}
            </SelectContent>
          </Select>
          {filtered && <Button variant="ghost" size="sm" onClick={() => { setQ(""); router.replace(pathname); }}><X /> Clear</Button>}
          <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="View">
            {([["table", List], ["board", Columns3]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} aria-label={`${v} view`}
                className={cn("flex h-7 w-8 items-center justify-center rounded-md transition", view === v ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="numeric mb-3 px-1 text-xs text-muted-foreground">{data?.total ?? 0} case{data?.total === 1 ? "" : "s"}{filtered && " match your filters"}</p>

      {view === "table" ? (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-border/70">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => {
                      const dir = h.column.getIsSorted();
                      return (
                        <th key={h.id} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          <button className="inline-flex items-center gap-1 transition hover:text-foreground" onClick={h.column.getToggleSortingHandler()} aria-label={`Sort by ${String(h.column.columnDef.header)}`}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {dir === "asc" ? <ArrowUp className="h-3 w-3" /> : dir === "desc" ? <ArrowDown className="h-3 w-3" /> : null}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border/70">
                {isLoading && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={columns.length} className="px-4 py-3"><Skeleton className="h-10 w-full rounded-lg" /></td></tr>)}
                {table.getRowModel().rows.map((row, i) => (
                  <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="group cursor-pointer transition hover:bg-muted/40 focus-within:bg-muted/40" onClick={() => router.push(`/cases/${row.original.id}`)}
                    tabIndex={0} onKeyDown={(e) => e.key === "Enter" && router.push(`/cases/${row.original.id}`)} aria-label={`Open ${row.original.company.name}`}>
                    {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3.5 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && !data?.items.length && (
            <div className="p-6"><EmptyState icon={BriefcaseBusiness} title={filtered ? "No cases match" : "No cases yet"} description={filtered ? "Try a different filter or search." : "Open a case to start underwriting."}
              action={!filtered && can("analyst") && <Button onClick={() => setNewCase(true)}><Plus /> New case</Button>} /></div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-3 xl:grid-cols-5">
          {BOARD.map((col) => {
            const items = (data?.items ?? []).filter((c) => col.statuses.includes(c.status));
            return (
              <div key={col.label} className="min-w-[240px] rounded-2xl bg-muted/50 p-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <p className="text-sm font-semibold">{col.label}</p>
                  <span className="numeric rounded-full bg-surface px-2 text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="mt-1 space-y-2">
                  {items.map((c, i) => (
                    <motion.button key={c.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      onClick={() => router.push(`/cases/${c.id}`)} className="panel-interactive block w-full p-3 text-left">
                      <div className="flex items-start gap-2.5">
                        <Avatar name={c.company.name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{c.company.name.replace(/ (Private )?Limited$/, "")}</p>
                          <p className="numeric text-xs text-muted-foreground">{formatCr(c.requested_amount)} · {c.facility_type}</p>
                        </div>
                        <ScorePill score={c.latest_score} />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <StageDots c={c} />
                        <span className="text-[11px] text-muted-foreground">{relativeTime(c.updated_at)}</span>
                      </div>
                      {(c.latest_fraud_score ?? 0) >= 50 && <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">Fraud score {c.latest_fraud_score}/100</p>}
                    </motion.button>
                  ))}
                  {!items.length && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function CasesPage() {
  return <Suspense><CasesView /></Suspense>;
}
