"use client";

import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, FileText, Loader2, MessageSquare, MessageSquarePlus, Printer, ReceiptText, Save, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useCaseContext } from "@/components/case/case-context";
import { BlockSkeleton, EmptyState, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, qk, useCam } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";
import { SectionBody } from "@/components/cam/cam-section";

export default function CamPage() {
  const { caseId, watchJob, overview, openCopilot } = useCaseContext();
  const [version, setVersion] = useState<number | undefined>();
  const { data: cam, isLoading } = useCam(caseId, version);
  const can = useAuth((s) => s.can);
  const qc = useQueryClient();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);
  useEffect(() => setComments(cam?.analyst_comments ?? {}), [cam?.id, cam?.analyst_comments]);

  // Scroll-spy for the outline.
  useEffect(() => {
    if (!cam) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id.replace("cam-", ""));
    }, { rootMargin: "-80px 0px -60% 0px" });
    docRef.current?.querySelectorAll("section[id^=cam-]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [cam]);

  if (isLoading) return <BlockSkeleton className="h-[600px]" />;
  if (!cam) {
    return (
      <EmptyState icon={ReceiptText} title="No CAM generated yet" description="A Credit Appraisal Memo is generated automatically at the end of full analysis, or on demand."
        action={can("analyst") && overview?.score && <Button onClick={async () => { try { const j = await api.cam.generate(caseId); watchJob(j.id); } catch (e) { toast.error(errorMessage(e)); } }}><ReceiptText /> Generate CAM</Button>} />
    );
  }
  const dirty = JSON.stringify(comments) !== JSON.stringify(cam.analyst_comments ?? {});
  const commentCount = Object.values(comments).filter(Boolean).length;
  const save = async (regenerate: boolean) => {
    setBusy(regenerate ? "regen" : "save");
    try {
      const res = await api.cam.saveComments(caseId, comments, regenerate);
      if (res.job) { watchJob(res.job.id); setVersion(undefined); toast.message("Regenerating CAM with your comments…"); }
      else { toast.success("Comments saved"); qc.invalidateQueries({ queryKey: qk.cam(caseId, version) }); }
      setEditing(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const download = async (fmt: "pdf" | "docx") => {
    setBusy(fmt);
    try {
      await api.cam.download(cam.id, fmt, `${name}.${fmt}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const name = `CAM-${overview?.case_record.reference ?? "case"}-v${cam.version}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
      {/* Outline */}
      <nav className="no-print hidden xl:sticky xl:top-24 xl:block xl:self-start" aria-label="CAM sections">
        <p className="label mb-2 px-2">Contents</p>
        <ol className="space-y-0.5">
          {cam.sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#cam-${s.id}`} className={cn("relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition", active === s.id ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {active === s.id && <motion.span layoutId="cam-outline" className="absolute inset-0 rounded-lg bg-muted" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                <span className="numeric relative w-4 text-[11px] text-muted-foreground">{i + 1}</span>
                <span className="relative truncate">{s.title}</span>
                {comments[s.id] && <MessageSquare className="relative ml-auto h-3 w-3 shrink-0 text-accent" />}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Document */}
      <div ref={docRef} className="panel overflow-hidden">
        <header className="relative overflow-hidden border-b border-border px-6 py-7 md:px-10">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-accent to-info" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label text-primary">Credit Appraisal Memorandum · Confidential</p>
              <h2 className="mt-1.5 text-2xl font-bold">{overview?.company.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{overview?.case_record.reference} · {overview?.case_record.facility_type} · prepared {new Date(cam.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div className="flex items-center gap-2">
              <ToneBadge tone="muted">v{cam.version}</ToneBadge>
              <ToneBadge tone={cam.status === "final" ? "success" : "warning"}>{cam.status}</ToneBadge>
            </div>
          </div>
        </header>
        <div className="divide-y divide-border/70">
          {cam.sections.map((s, i) => (
            <section key={s.id} id={`cam-${s.id}`} className="group scroll-mt-24 px-6 py-7 md:px-10">
              <div className="mb-4 flex items-center gap-3">
                <span className="numeric flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                <h3 className="text-[17px] font-semibold">{s.title}</h3>
                {can("analyst") && editing !== s.id && (
                  <Button variant="ghost" size="sm" className="no-print ml-auto h-7 opacity-0 transition group-hover:opacity-100 focus:opacity-100" onClick={() => setEditing(s.id)}>
                    <MessageSquarePlus /> {comments[s.id] ? "Edit comment" : "Comment"}
                  </Button>
                )}
              </div>
              <SectionBody s={s} />
              {editing === s.id ? (
                <div className="no-print mt-4 space-y-2 rounded-xl border border-accent/30 bg-accent/[0.05] p-3">
                  <Textarea autoFocus rows={3} value={comments[s.id] ?? ""} placeholder="Analyst comment for this section — appears in the exported CAM"
                    onChange={(e) => setComments((c) => ({ ...c, [s.id]: e.target.value }))} aria-label={`Comment on ${s.title}`} />
                  <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Done</Button></div>
                </div>
              ) : comments[s.id] ? (
                <button onClick={() => can("analyst") && setEditing(s.id)} className="mt-4 block w-full rounded-r-xl border-l-4 border-accent bg-accent/[0.08] px-4 py-2.5 text-left text-[13px]">
                  <span className="font-semibold text-accent">Analyst comment · </span>{comments[s.id]}
                </button>
              ) : null}
            </section>
          ))}
        </div>
        <footer className="border-t border-border bg-surface-2/60 px-6 py-4 text-xs text-muted-foreground md:px-10">
          Generated by CredX · narrative by {cam.narrative_provider ?? "local"} · subject to sanctioning-authority approval under the lender&apos;s credit policy.
        </footer>
      </div>

      {/* Actions */}
      <aside className="no-print space-y-4 xl:sticky xl:top-24 xl:self-start">
        <div className="panel space-y-3 p-4">
          <p className="text-sm font-semibold">Export</p>
          <Button className="w-full justify-start" onClick={() => download("pdf")} disabled={!!busy}>{busy === "pdf" ? <Loader2 className="animate-spin" /> : <Download />} Download PDF</Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => download("docx")} disabled={!!busy}>{busy === "docx" ? <Loader2 className="animate-spin" /> : <FileText />} Word (DOCX)</Button>
          <Button variant="ghost" className="w-full justify-start" onClick={() => window.print()}><Printer /> Print</Button>
          {cam.versions.length > 1 && (
            <Select value={String(version ?? cam.versions[cam.versions.length - 1])} onValueChange={(v) => setVersion(Number(v) === Math.max(...cam.versions) ? undefined : Number(v))}>
              <SelectTrigger aria-label="CAM version"><SelectValue /></SelectTrigger>
              <SelectContent>{[...cam.versions].sort((a, b) => b - a).map((v) => <SelectItem key={v} value={String(v)}>Version {v}{v === Math.max(...cam.versions) ? " (latest)" : ""}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        {can("analyst") && (
          <div className="panel space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Analyst comments</p>
              <span className="numeric rounded-full bg-accent/12 px-2 text-xs font-semibold text-accent">{commentCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">{dirty ? "You have unsaved changes." : "Hover a section and click Comment to annotate it."}</p>
            <Button size="sm" className="w-full" disabled={!dirty || !!busy} onClick={() => save(true)}>{busy === "regen" ? <Loader2 className="animate-spin" /> : <Save />} Save & regenerate</Button>
            <Button size="sm" variant="outline" className="w-full" disabled={!dirty || !!busy} onClick={() => save(false)}>{busy === "save" && <Loader2 className="animate-spin" />} Save only</Button>
          </div>
        )}
        <button onClick={openCopilot} className="panel-interactive flex w-full items-center gap-3 p-4 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white"><Sparkles className="h-4 w-4" /></span>
          <span><span className="block text-sm font-semibold">Ask the copilot</span><span className="block text-xs text-muted-foreground">Draft committee answers from this CAM</span></span>
        </button>
      </aside>
    </div>
  );
}
