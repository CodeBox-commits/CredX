"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Building, ClipboardList, Factory, Landmark, MessageSquare, Pin, Scale, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { errorMessage, qk } from "@/hooks/queries";
import { relativeTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";
import type { Note } from "@/types/api";

export const CATEGORIES = [
  { key: "site_visit", label: "Site visit", icon: Factory },
  { key: "management", label: "Management", icon: Users },
  { key: "operations", label: "Operations", icon: Building },
  { key: "financial", label: "Financial", icon: Landmark },
  { key: "collateral", label: "Collateral", icon: ClipboardList },
  { key: "compliance", label: "Compliance", icon: Scale },
];

export function ImpactChip({ points }: { points: number | null | undefined }) {
  if (points === null || points === undefined) return null;
  return <ToneBadge tone={points < 0 ? "destructive" : points > 0 ? "success" : "muted"} className="numeric">{points > 0 ? "+" : ""}{points} pts</ToneBadge>;
}

export function NoteItem({ note, replies, caseId }: { note: Note; replies: Note[]; caseId: string }) {
  const qc = useQueryClient();
  const { user, can } = useAuth();
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: qk.notes(caseId) });
  const effective = note.impact_points ?? note.inferred_impact ?? note.preview_impact;
  const mine = note.author?.id === user?.id || can("credit_manager");
  const cat = CATEGORIES.find((c) => c.key === note.category);
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative pb-5 pl-8">
      <span className={cn("absolute left-0 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card text-white", (effective ?? 0) < 0 ? "bg-destructive" : (effective ?? 0) > 0 ? "bg-success" : "bg-muted-foreground")}>
        {cat ? <cat.icon className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
      </span>
      <div className={cn("rounded-xl border bg-surface p-4", note.pinned ? "border-accent/40" : "border-border")}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">{note.author?.full_name.split(" ").map((p) => p[0]).join("") ?? "?"}</span>
          <span className="font-semibold">{note.author?.full_name ?? "Unknown"}</span>
          <span className="text-muted-foreground">{relativeTime(note.created_at)}</span>
          <ToneBadge tone="muted">{titleCase(note.category)}</ToneBadge>
          {note.pinned && <ToneBadge tone="accent"><Pin className="h-3 w-3" /> Pinned</ToneBadge>}
          <span className="ml-auto flex items-center gap-1.5"><ImpactChip points={effective} />{note.five_c && <span className="text-[11px] text-muted-foreground">{titleCase(note.five_c)}</span>}</span>
        </div>
        <p className="mt-2.5 text-sm leading-relaxed">{note.body}</p>
        {note.impact_rationale && <p className="mt-1.5 text-xs text-muted-foreground">Engine: {note.impact_rationale}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <button className="flex items-center gap-1 transition hover:text-foreground" onClick={() => setOpen(!open)}><MessageSquare className="h-3.5 w-3.5" />{replies.length ? `${replies.length} repl${replies.length > 1 ? "ies" : "y"}` : "Reply"}</button>
          {mine && (
            <>
              <button className="flex items-center gap-1 transition hover:text-foreground" onClick={() => act(() => api.notes.update(note.id, { pinned: !note.pinned }))}><Pin className="h-3.5 w-3.5" />{note.pinned ? "Unpin" : "Pin"}</button>
              <label className="flex items-center gap-1.5">In CAM <Switch className="scale-75" checked={note.include_in_cam} onCheckedChange={(v) => act(() => api.notes.update(note.id, { include_in_cam: v }))} aria-label="Include in CAM" /></label>
              {confirmDelete ? (
                <span className="ml-auto flex items-center gap-2">
                  <span>Delete (audited)?</span>
                  <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => act(() => api.notes.remove(note.id))}>Delete</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirmDelete(false)}>Keep</Button>
                </span>
              ) : (
                <button className="ml-auto flex items-center gap-1 transition hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" />Delete</button>
              )}
            </>
          )}
        </div>
        <AnimatePresence>
          {(open || replies.length > 0) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-2 border-t border-border/70 pt-3">
              {replies.map((r) => (
                <div key={r.id} className="rounded-lg bg-muted/50 px-3 py-2 text-[13px]"><span className="text-xs font-semibold">{r.author?.full_name}</span> <span className="text-xs text-muted-foreground">{relativeTime(r.created_at)}</span><p className="mt-0.5">{r.body}</p></div>
              ))}
              {open && can("analyst") && (
                <form className="flex gap-2" onSubmit={async (e) => {
                  e.preventDefault();
                  if (reply.trim().length < 3) return;
                  await act(() => api.notes.create(caseId, { body: reply, kind: "comment", parent_id: note.id, category: note.category }));
                  setReply("");
                }}>
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
