"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ClipboardList, Flag, History, Loader2, MessageSquare, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useCaseContext } from "@/components/case/case-context";
import { AnimatedNumber, SectionCard, StatusBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, qk, useCaseAction, useEscalations, useNotes } from "@/hooks/queries";
import { relativeTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";
import { CATEGORIES, ImpactChip, NoteItem } from "@/components/workspace/note-item";
import { useDebounced } from "@/hooks/use-debounced";

const EXAMPLES = ["Factory operating at 40% capacity.", "Promoter infused ₹5 crore equity last quarter.", "Collateral verified — clear title.", "Management was evasive on related-party sales."];

export default function WorkspacePage() {
  const { caseId, watchJob } = useCaseContext();
  const { data: notes } = useNotes(caseId);
  const { data: escalations } = useEscalations(caseId);
  const { data: audit } = useQuery({ queryKey: ["case", caseId, "audit"], queryFn: () => api.cases.audit(caseId) });
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const rescore = useCaseAction(caseId, "rescore", (j) => watchJob(j.id));
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("site_visit");
  const [explicit, setExplicit] = useState(false);
  const [points, setPoints] = useState(0);
  const [escReason, setEscReason] = useState("");
  const [resolving, setResolving] = useState<{ id: string; text: string } | null>(null);
  const debounced = useDebounced(body);
  const { data: preview, isFetching: previewing } = useQuery({ queryKey: ["note-preview", debounced], queryFn: () => api.notes.preview(debounced), enabled: debounced.trim().length >= 3 });

  const create = useMutation({
    mutationFn: () => api.notes.create(caseId, { body, category, kind: "note", impact_points: explicit ? points : null }),
    onSuccess: () => {
      setBody(""); setExplicit(false); setPoints(0);
      qc.invalidateQueries({ queryKey: qk.notes(caseId) });
      qc.invalidateQueries({ queryKey: qk.overview(caseId) });
      toast.success("Observation added", { description: "Re-score to apply it to the decision.", action: { label: "Re-score now", onClick: () => rescore.mutate() } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const escalate = useMutation({
    mutationFn: () => api.escalations.create(caseId, escReason),
    onSuccess: () => { setEscReason(""); qc.invalidateQueries({ queryKey: ["case", caseId] }); qc.invalidateQueries({ queryKey: ["cases"] }); toast.success("Escalated to credit committee"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const resolve = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api.escalations.resolve(id, text),
    onSuccess: () => { setResolving(null); qc.invalidateQueries({ queryKey: ["case", caseId] }); qc.invalidateQueries({ queryKey: ["cases"] }); toast.success("Escalation resolved"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const roots = (notes ?? []).filter((n) => !n.parent_id).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  const repliesOf = (id: string) => (notes ?? []).filter((n) => n.parent_id === id);
  const impact = explicit ? points : (preview?.inferred_points ?? 0);
  const typing = body.trim().length >= 3;
  const netImpact = roots.reduce((s, n) => s + (n.impact_points ?? n.inferred_impact ?? 0), 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        {can("analyst") && (
          <SectionCard title="Add a field observation" icon={ClipboardList} info="Observations adjust the score as bounded, cited overlays (±40 per note, ±80 total), appear in the CAM and ground the copilot.">
            <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
              {CATEGORIES.map((c) => (
                <button key={c.key} role="radio" aria-checked={category === c.key} onClick={() => setCategory(c.key)}
                  className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition", category === c.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                  <c.icon className="h-3.5 w-3.5" />{c.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you observe? e.g. Factory operating at 40% capacity; two of five press lines idle." aria-label="Observation" className="pr-36" />
              <AnimatePresence>
                {typing && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className={cn("absolute right-2 top-2 rounded-lg border px-2.5 py-1.5 text-center", impact < 0 ? "border-destructive/30 bg-destructive/[0.07]" : impact > 0 ? "border-success/30 bg-success/[0.07]" : "border-border bg-muted/50")}>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score impact</p>
                    <p className={cn("numeric text-lg font-bold leading-tight", impact < 0 ? "text-destructive" : impact > 0 ? "text-success" : "text-muted-foreground")}>
                      {previewing && !explicit ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <>{impact > 0 ? "+" : ""}<AnimatedNumber value={impact} /></>}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((e) => <button key={e} className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground" onClick={() => setBody(e)}>{e}</button>)}
            </div>
            {!explicit && preview && typing && <p className="mt-3 text-xs text-muted-foreground">Engine reading: {preview.rationale} · maps to <b>{titleCase(preview.five_c)}</b></p>}
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/70 pt-4">
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground"><Switch checked={explicit} onCheckedChange={setExplicit} aria-label="Set impact manually" />Override impact</label>
              {explicit && <div className="flex w-56 items-center gap-3"><Slider min={-40} max={40} step={1} value={[points]} onValueChange={([v]) => setPoints(v)} aria-label="Impact points" /><span className="numeric w-10 text-sm">{points > 0 ? "+" : ""}{points}</span></div>}
              <Button className="ml-auto" onClick={() => create.mutate()} disabled={!typing || create.isPending}>{create.isPending ? <Loader2 className="animate-spin" /> : <Send />} Add observation</Button>
            </div>
          </SectionCard>
        )}

        <SectionCard title={`Observations (${roots.length})`} icon={MessageSquare}
          actions={<div className="flex items-center gap-2">
            {roots.length > 0 && <span className="text-xs text-muted-foreground">Net impact <ImpactChip points={netImpact} /></span>}
            {can("analyst") && <Button variant="outline" size="sm" onClick={() => rescore.mutate()} disabled={rescore.isPending}>{rescore.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-score</Button>}
          </div>}>
          <ul className="relative before:absolute before:bottom-4 before:left-[11px] before:top-4 before:w-px before:bg-border">
            {roots.map((n) => <NoteItem key={n.id} note={n} replies={repliesOf(n.id)} caseId={caseId} />)}
          </ul>
          {!roots.length && <p className="text-sm text-muted-foreground">No observations yet. Site-visit and management-meeting notes belong here.</p>}
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard title="Escalations" icon={Flag}>
          {can("analyst") && (
            <div className="mb-4 space-y-2">
              <Textarea rows={2} value={escReason} onChange={(e) => setEscReason(e.target.value)} placeholder="Why does this need a credit manager or committee?" aria-label="Escalation reason" />
              <Button size="sm" variant="outline" disabled={escReason.length < 10 || escalate.isPending} onClick={() => escalate.mutate()}><ArrowUpRight /> Escalate</Button>
            </div>
          )}
          <ul className="space-y-2.5">
            {escalations?.map((e) => (
              <li key={e.id} className={cn("rounded-xl border p-3 text-sm", e.status === "open" ? "border-warning/40 bg-warning/[0.05]" : "border-border")}>
                <div className="flex items-center gap-2"><StatusBadge status={e.status === "open" ? "escalated" : "approved"} /><span className="text-xs text-muted-foreground">{e.raised_by?.full_name} · {relativeTime(e.created_at)}</span></div>
                <p className="mt-1.5 text-[13px]">{e.reason}</p>
                {e.resolution && <p className="mt-1.5 text-xs text-success">Resolved by {e.resolved_by?.full_name}: {e.resolution}</p>}
                {e.status === "open" && can("credit_manager") && (
                  resolving?.id === e.id ? (
                    <form className="mt-2 flex gap-2" onSubmit={(ev) => { ev.preventDefault(); if (resolving.text.trim().length >= 3) resolve.mutate(resolving); }}>
                      <Input autoFocus className="h-8" placeholder="Resolution note" value={resolving.text} onChange={(ev) => setResolving({ id: e.id, text: ev.target.value })} />
                      <Button size="sm" type="submit" disabled={resolve.isPending}>Resolve</Button>
                    </form>
                  ) : <Button size="sm" className="mt-2" variant="soft" onClick={() => setResolving({ id: e.id, text: "" })}>Resolve</Button>
                )}
              </li>
            ))}
            {!escalations?.length && <p className="text-sm text-muted-foreground">No escalations.</p>}
          </ul>
        </SectionCard>
        <SectionCard title="Audit trail" icon={History} bodyClassName="max-h-[480px] overflow-y-auto p-0 scrollbar-thin">
          <ul className="divide-y divide-border/70">
            {audit?.map((a) => (
              <li key={a.id} className="px-5 py-2.5">
                <p className="truncate text-[13px]">{a.summary}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground"><span className="font-mono">{a.action}</span> · {a.actor_email?.split("@")[0]} · {relativeTime(a.created_at)}</p>
              </li>
            ))}
            {!audit?.length && <li className="px-5 py-6 text-center text-sm text-muted-foreground">No audit events yet.</li>}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
