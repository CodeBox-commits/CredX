"use client";

import { type ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, BriefcaseBusiness, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DecisionBadge, EmptyState, PageHeader, RiskBadge, StatusBadge, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCases } from "@/hooks/queries";
import { formatCr, relativeTime, titleCase } from "@/lib/format";
import { scoreTone } from "@/lib/tones";
import { useAuth } from "@/store/auth";
import { useUi } from "@/store/ui";
import type { CreditCase } from "@/types/api";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft,ingesting,analyzing", label: "In progress" },
  { value: "in_review", label: "In review" },
  { value: "escalated", label: "Escalated" },
  { value: "approved,rejected", label: "Decided" },
];

export default function CasesPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "updated_at", desc: true }]);
  const { data, isLoading } = useCases({ q: q || undefined, status: status === "all" ? undefined : status });
  const can = useAuth((s) => s.can);
  const setNewCase = useUi((s) => s.setNewCase);

  const columns = useMemo<ColumnDef<CreditCase>[]>(() => [
    {
      id: "company", accessorFn: (r) => r.company.name, header: "Borrower",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.company.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.reference}{row.original.is_demo && " · demo"}</p>
        </div>
      ),
    },
    { id: "sector", accessorFn: (r) => r.company.sector, header: "Sector", cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{titleCase(getValue() as string) || "—"}</span> },
    { id: "facility", accessorKey: "facility_type", header: "Facility", cell: ({ row }) => <span className="text-xs">{row.original.facility_type}</span> },
    { id: "amount", accessorKey: "requested_amount", header: "Requested", cell: ({ getValue }) => <span className="numeric">{formatCr(getValue() as number)}</span> },
    { id: "status", accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    {
      id: "score", accessorKey: "latest_score", header: "Score", sortingFn: "basic",
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v ? <ToneBadge tone={scoreTone(v)} className="numeric">{v}</ToneBadge> : <span className="text-muted-foreground">—</span>;
      },
    },
    { id: "risk", accessorKey: "latest_risk_level", header: "Risk", cell: ({ getValue }) => <RiskBadge risk={getValue() as string} /> },
    {
      id: "fraud", accessorKey: "latest_fraud_score", header: "Fraud",
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v === null ? "—" : <span className={`numeric ${v >= 50 ? "font-semibold text-destructive" : v >= 25 ? "text-warning" : "text-muted-foreground"}`}>{v}</span>;
      },
    },
    { id: "decision", accessorKey: "final_decision", header: "Final", cell: ({ getValue }) => (getValue() ? <DecisionBadge decision={getValue() as string} /> : <span className="text-xs text-muted-foreground">Pending</span>) },
    { id: "updated_at", accessorKey: "updated_at", header: "Updated", cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{relativeTime(getValue() as string)}</span> },
  ], []);

  const table = useReactTable({
    data: data?.items ?? [], columns, state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <PageHeader
        eyebrow="Underwriting queue"
        title="Credit cases"
        description="Every borrower application with its pipeline status, model score, fraud score and final decision."
        actions={can("analyst") && <Button onClick={() => setNewCase(true)}><Plus className="mr-2 h-4 w-4" />New case</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search borrower, reference or GSTIN" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search cases" />
        </div>
        <ToggleGroup type="single" value={status} onValueChange={(v) => v && setStatus(v)} className="flex-wrap justify-start" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => <ToggleGroupItem key={f.value} value={f.value} size="sm" className="text-xs">{f.label}</ToggleGroupItem>)}
        </ToggleGroup>
        <p className="numeric text-xs text-muted-foreground md:ml-auto">{data?.total ?? 0} cases</p>
      </div>
      <Card className="overflow-hidden border-border/70">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-border bg-muted/40">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={h.column.getToggleSortingHandler()} aria-label={`Sort by ${String(h.column.columnDef.header)}`}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={columns.length} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
              ))}
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="cursor-pointer transition hover:bg-muted/40 focus-within:bg-muted/40" onClick={() => router.push(`/cases/${row.original.id}`)}
                  tabIndex={0} onKeyDown={(e) => e.key === "Enter" && router.push(`/cases/${row.original.id}`)} aria-label={`Open ${row.original.company.name}`}>
                  {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && !data?.items.length && (
          <div className="p-6"><EmptyState icon={BriefcaseBusiness} title="No cases match" description="Adjust the filters or open a new case." /></div>
        )}
      </Card>
    </>
  );
}
