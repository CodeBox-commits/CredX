"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldQuestion } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard, StatusBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, qk, useOverrides } from "@/hooks/queries";
import { decisionLabel, formatCr, relativeTime, titleCase } from "@/lib/format";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";
import type { Score } from "@/types/api";

export function OverridePanel({ caseId, score }: { caseId: string; score: Score }) {
  const { data: overrides } = useOverrides(caseId);
  const qc = useQueryClient();
  const { can, user } = useAuth();
  const [field, setField] = useState("decision");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const create = useMutation({
    mutationFn: () => api.overrides.create(caseId, { field, new_value: field === "recommended_amount" ? String(Number(value) * 1e7) : value, reason }),
    onSuccess: () => { toast.success("Override requested", { description: "A different credit manager must approve it." }); setValue(""); setReason(""); qc.invalidateQueries({ queryKey: qk.overrides(caseId) }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api.overrides.review(id, approve),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case", caseId] }); qc.invalidateQueries({ queryKey: ["cases"] }); toast.success("Override reviewed"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const current = field === "decision" ? decisionLabel(score.decision) : field === "recommended_amount" ? formatCr(score.recommended_amount) : `${score.suggested_rate}%`;
  return (
    <SectionCard title="Maker–checker overrides" icon={ShieldQuestion} info="Analysts propose; a different credit manager approves. Every step is audited.">
      {can("analyst") && (
        <div className="mb-5 space-y-3 rounded-xl border border-border bg-surface-2/60 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={field} onValueChange={(v) => { setField(v); setValue(""); }}>
              <SelectTrigger aria-label="Field to override"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="decision">Decision</SelectItem>
                <SelectItem value="recommended_amount">Amount (₹ Cr)</SelectItem>
                <SelectItem value="suggested_rate">Rate (%)</SelectItem>
              </SelectContent>
            </Select>
            {field === "decision" ? (
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger aria-label="New decision"><SelectValue placeholder="New decision" /></SelectTrigger>
                <SelectContent>{["APPROVE", "APPROVE_WITH_CONDITIONS", "REFER", "DECLINE"].map((d) => <SelectItem key={d} value={d}>{decisionLabel(d)}</SelectItem>)}</SelectContent>
              </Select>
            ) : <Input placeholder={`New value (now ${current})`} value={value} onChange={(e) => setValue(e.target.value)} aria-label="New value" />}
          </div>
          <Textarea rows={2} placeholder="Justification for the credit committee (min 10 characters)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Justification" />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Current: <b className="text-foreground">{current}</b></p>
            <Button size="sm" disabled={!value || reason.length < 10 || create.isPending} onClick={() => create.mutate()}>{create.isPending && <Loader2 className="animate-spin" />} Request override</Button>
          </div>
        </div>
      )}
      <ul className="space-y-2.5">
        {overrides?.map((o) => (
          <li key={o.id} className="rounded-xl border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{titleCase(o.field)}</span>
              <span className="font-mono text-xs text-muted-foreground">{o.original_value} → {o.field === "recommended_amount" ? formatCr(Number(o.new_value)) : o.new_value}</span>
              <span className="ml-auto"><StatusBadge status={o.status === "pending" ? "queued" : o.status === "approved" ? "succeeded" : "failed"} /></span>
            </div>
            <p className="mt-1.5 text-[13px] text-muted-foreground">“{o.reason}” — {o.requested_by?.full_name}, {relativeTime(o.created_at)}</p>
            {o.reviewed_by && <p className="mt-1 text-xs text-muted-foreground">Reviewed by {o.reviewed_by.full_name}{o.review_comment ? `: ${o.review_comment}` : ""}</p>}
            {o.status === "pending" && can("credit_manager") && o.requested_by?.id !== user?.id && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="success" onClick={() => review.mutate({ id: o.id, approve: true })}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => review.mutate({ id: o.id, approve: false })}>Reject</Button>
              </div>
            )}
          </li>
        ))}
        {!overrides?.length && <p className="text-sm text-muted-foreground">No overrides on this case.</p>}
      </ul>
    </SectionCard>
  );
}
