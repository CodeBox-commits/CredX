"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Flag, MessageSquare, Pin, RefreshCw, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCaseContext } from "@/components/case/case-context";
import { SectionCard, StatusBadge, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, qk, useCaseAction, useEscalations, useNotes } from "@/hooks/queries";
import { relativeTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";
import type { Note } from "@/types/api";

const CATEGORIES = ["site_visit", "management", "operations", "financial", "collateral", "compliance", "general"];
const EXAMPLES = ["Factory operating at 40% capacity.", "Promoter infused ₹5 crore equity last quarter.", "Collateral verified — clear title.", "Inventory mismatch found during stock audit."];

function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function ImpactChip({ points }: { points: number | null | undefined }) {
  if (points === null || points === undefined) return null;
  return <ToneBadge tone={points < 0 ? "destructive" : points > 0 ? "success" : "muted"} className="numeric">{points > 0 ? "+" : ""}{points} pts</ToneBadge>;
}

function NoteItem({ note, replies, caseId }: { note: Note; replies: Note[]; caseId: string }) {
  const qc = useQueryClient();
  const { user, can } = useAuth();
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: qk.notes(caseId) });
  const effective = note.impact_points ?? note.inferred_impact ?? note.preview_impact;
  const mine = note.author?.id === user?.id || can("credit_manager");
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative ml-5 border-l border-border pb-5 pl-5">
      <span className={cn("absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full border-2 border-background", (effective ?? 0) < 0 ? "bg-destructive" : (effective ?? 0) > 0 ? "bg-success" : "bg-muted-foreground")} />
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold">{note.author?.full_name ?? "Unknown"}</span>
          <span className="text-muted-foreground">{relativeTime(note.created_at)}</span>
          <ToneBadge tone="primary">{titleCase(note.category)}</ToneBadge>
          {note.pinned && <Pin className="h-3 w-3 text-accent" />}
          <span className="ml-auto flex items-center gap-1.5">
            <ImpactChip points={effective} />
            {note.impact_points !== null && <span className="text-[10px] text-muted-foreground">analyst-set</span>}
          </span>
        </div>
        <p className="mt-2 text-sm">{note.body}</p>
        {note.impact_rationale && <p className="mt-1 text-xs text-muted-foreground">Engine: {note.impact_rationale}</p>}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setOpen(!open)}><MessageSquare className="h-3.5 w-3.5" />{replies.length || ""} Reply</button>
          {mine && (
            <>
              <button className="flex items-center gap-1 hover:text-foreground" onClick={async () => { await api.notes.update(note.id, { pinned: !note.pinned }); refresh(); }}><Pin className="h-3.5 w-3.5" />{note.pinned ? "Unpin" : "Pin"}</button>
              <label className="flex items-center gap-1.5">In CAM <Switch className="scale-75" checked={note.include_in_cam} onCheckedChange={async (v) => { await api.notes.update(note.id, { include_in_cam: v }); refresh(); }} aria-label="Include in CAM" /></label>
              <button className="ml-auto flex items-center gap-1 hover:text-destructive" onClick={async () => { if (confirm("Delete this note? This is recorded in the audit trail.")) { await api.notes.remove(note.id); refresh(); } }} aria-label="Delete note"><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
        <AnimatePresence>
          {(open || replies.length > 0) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-2 border-t border-border pt-3">
              {replies.map((r) => (
                <div key={r.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm"><span className="text-xs font-semibold">{r.author?.full_name}</span> <span className="text-xs text-muted-foreground">{relativeTime(r.created_at)}</span><p>{r.body}</p></div>
              ))}
              {open && can("analyst") && (
                <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (reply.trim().length < 3) return; await api.notes.create(caseId, { body: reply, kind: "comment", parent_id: note.id, category: note.category }); setReply(""); refresh(); }}>
                  <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Internal comment…" className="h-8" aria-label="Reply" />
                  <Button size="sm" type="submit">Reply</Button>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

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
  const debounced = useDebounced(body);
  const { data: preview } = useQuery({ queryKey: ["note-preview", debounced], queryFn: () => api.notes.preview(debounced), enabled: debounced.trim().length >= 3 });

  const create = useMutation({
    mutationFn: () => api.notes.create(caseId, { body, category, kind: "note", impact_points: explicit ? points : null }),
    onSuccess: () => {
      setBody(""); setExplicit(false); setPoints(0);
      qc.invalidateQueries({ queryKey: qk.notes(caseId) });
      toast.success("Note added", { description: "Re-score to apply it to the decision.", action: { label: "Re-score now", onClick: () => rescore.mutate() } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const escalate = useMutation({
    mutationFn: () => api.escalations.create(caseId, escReason),
    onSuccess: () => { setEscReason(""); qc.invalidateQueries({ queryKey: ["case", caseId] }); toast.success("Escalated to credit manager"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const resolve = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api.escalations.resolve(id, text),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case", caseId] }); toast.success("Escalation resolved"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const roots = (notes ?? []).filter((n) => !n.parent_id).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  const repliesOf = (id: string) => (notes ?? []).filter((n) => n.parent_id === id);
  const impact = explicit ? points : preview?.inferred_points;

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        {can("analyst") && (
          <SectionCard eyebrow="Qualitative evidence" title="Add an observation" info="Notes influence the score as bounded, cited overlays (±40 per note, ±80 total), appear in the CAM and feed the copilot.">
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="e.g. Factory operating at 40% capacity; two of five press lines idle." aria-label="Observation" />
            <div className="mt-2 flex flex-wrap gap-1.5">{EXAMPLES.map((e) => <button key={e} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-foreground" onClick={() => setBody(e)}>{e}</button>)}</div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-44" aria-label="Category"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={explicit} onCheckedChange={setExplicit} aria-label="Set impact manually" />Set impact manually</label>
              {explicit && <div className="flex w-56 items-center gap-3"><Slider min={-40} max={40} step={1} value={[points]} onValueChange={([v]) => setPoints(v)} aria-label="Impact points" /><span className="numeric w-10 text-sm">{points > 0 ? "+" : ""}{points}</span></div>}
              <div className="ml-auto flex items-center gap-2">
                {body.trim().length >= 3 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Score impact <ImpactChip points={impact ?? 0} />
                  </motion.div>
                )}
                <Button onClick={() => create.mutate()} disabled={body.trim().length < 3 || create.isPending}><Send className="mr-1.5 h-3.5 w-3.5" />Add note</Button>
              </div>
            </div>
            {!explicit && preview && body.trim().length >= 3 && <p className="mt-2 text-xs text-muted-foreground">Engine reading: {preview.rationale} · Five C: {titleCase(preview.five_c)}</p>}
          </SectionCard>
        )}
        <SectionCard eyebrow="Collaborative review" title={`Notes timeline (${roots.length})`} actions={can("analyst") && <Button variant="outline" size="sm" onClick={() => rescore.mutate()}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Apply to score</Button>}>
          <ul className="-ml-5">{roots.map((n) => <NoteItem key={n.id} note={n} replies={repliesOf(n.id)} caseId={caseId} />)}</ul>
          {!roots.length && <p className="text-sm text-muted-foreground">No observations yet. Site-visit and management-meeting notes belong here.</p>}
        </SectionCard>
      </div>

      <div className="space-y-5">
        <SectionCard eyebrow="Workflow" title="Escalations" actions={<Flag className="h-4 w-4 text-muted-foreground" />}>
          {can("analyst") && (
            <div className="mb-4 space-y-2">
              <Textarea rows={2} value={escReason} onChange={(e) => setEscReason(e.target.value)} placeholder="Why does this need a credit manager / committee?" aria-label="Escalation reason" />
              <Button size="sm" variant="outline" disabled={escReason.length < 10 || escalate.isPending} onClick={() => escalate.mutate()}><ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />Escalate</Button>
            </div>
          )}
          <ul className="space-y-2">
            {escalations?.map((e) => (
              <li key={e.id} className="rounded-lg border border-border p-2.5 text-sm">
                <div className="flex items-center gap-2"><StatusBadge status={e.status === "open" ? "escalated" : "approved"} /><span className="text-xs text-muted-foreground">{e.raised_by?.full_name} · {relativeTime(e.created_at)}</span></div>
                <p className="mt-1">{e.reason}</p>
                {e.resolution && <p className="mt-1 text-xs text-success">Resolved by {e.resolved_by?.full_name}: {e.resolution}</p>}
                {e.status === "open" && can("credit_manager") && (
                  <Button size="sm" className="mt-2" onClick={() => { const text = prompt("Resolution note"); if (text) resolve.mutate({ id: e.id, text }); }}>Resolve</Button>
                )}
              </li>
            ))}
            {!escalations?.length && <p className="text-sm text-muted-foreground">No escalations.</p>}
          </ul>
        </SectionCard>
        <SectionCard eyebrow="Compliance" title="Audit trail" bodyClassName="max-h-[460px] overflow-y-auto p-0 scrollbar-thin">
          <ul className="divide-y divide-border text-sm">
            {audit?.map((a) => (
              <li key={a.id} className="px-5 py-2">
                <p className="text-xs text-muted-foreground"><span className="font-mono">{a.action}</span> · {a.actor_email} · {relativeTime(a.created_at)}</p>
                <p className="truncate">{a.summary}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
