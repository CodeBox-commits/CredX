"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, FileText, MessageSquarePlus, Printer, ReceiptText, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCaseContext } from "@/components/case/case-context";
import { BlockSkeleton, EmptyState, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, qk, useCam } from "@/hooks/queries";
import { decisionTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";
import type { CamSection } from "@/types/api";

function Table({ header, rows }: { header: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead><tr className="border-b border-border">{header.map((h) => <th key={h} className="px-2 py-1.5 text-left font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={cn("px-2 py-1.5 align-top", j > 0 && /^[₹+\-\d—]/.test(c) && "numeric")}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function SectionBody({ s }: { s: CamSection }) {
  const c = s.content;
  if (s.kind === "decision") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
          <ToneBadge tone={decisionTone(c.decision_code)} className="mt-0.5 shrink-0">{c.decision}</ToneBadge>
          <p className="text-sm leading-relaxed">{c.narrative}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {c.metrics.map((m: { label: string; value: string }) => (
            <div key={m.label} className="rounded-lg border border-border p-2"><p className="text-[11px] text-muted-foreground">{m.label}</p><p className="numeric font-semibold">{m.value}</p></div>
          ))}
        </div>
      </div>
    );
  }
  if (s.kind === "kv") {
    return <dl className="grid gap-x-6 gap-y-1.5 text-sm md:grid-cols-[200px_1fr]">{c.map((m: { label: string; value: string }) => <div key={m.label} className="contents"><dt className="text-muted-foreground">{m.label}</dt><dd>{m.value}</dd></div>)}</dl>;
  }
  if (s.kind === "text") return <p className="text-sm">{c}</p>;
  if (s.kind === "table") {
    return (
      <div className="space-y-3">
        <Table header={c.header} rows={c.rows} />
        {s.secondary && <Table header={s.secondary.header} rows={s.secondary.rows} />}
        {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
      </div>
    );
  }
  if (s.kind === "five_cs") {
    return (
      <div className="grid gap-2 md:grid-cols-5">
        {c.map((x: any) => (
          <div key={x.c} className="rounded-lg border border-border p-2.5 text-xs">
            <p className="font-semibold">{x.c}</p><p className="numeric text-xl font-semibold">{x.score}</p><p className="text-muted-foreground">{x.assessment}</p>
            <ul className="mt-1.5 space-y-0.5 text-muted-foreground">{x.evidence.map((e: string) => <li key={e}>• {e}</li>)}</ul>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      <p>{c.summary}</p>
      {c.badges && <div className="flex flex-wrap gap-2">{c.badges.map((b: any) => <span key={b.label} className="rounded-full border border-border px-2 py-0.5 text-xs">{b.label}: <b>{b.value}</b></span>)}</div>}
      {c.bullets?.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">{c.bullets.map((b: string) => <li key={b}>{b}</li>)}</ul>}
      {c.groups?.filter((g: any) => g.lines?.length).map((g: any) => (
        <div key={g.title}><p className="mt-2 font-semibold">{g.title}</p><ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">{g.lines.map((l: string) => <li key={l}>{l}</li>)}</ul></div>
      ))}
    </div>
  );
}

export default function CamPage() {
  const { caseId, watchJob, overview } = useCaseContext();
  const [version, setVersion] = useState<number | undefined>();
  const { data: cam, isLoading } = useCam(caseId, version);
  const can = useAuth((s) => s.can);
  const qc = useQueryClient();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => setComments(cam?.analyst_comments ?? {}), [cam?.id, cam?.analyst_comments]);

  if (isLoading) return <BlockSkeleton className="h-[600px]" />;
  if (!cam) {
    return (
      <EmptyState icon={ReceiptText} title="No CAM generated yet" description="A Credit Appraisal Memo is generated automatically at the end of full analysis."
        action={can("analyst") && overview?.score && <Button onClick={async () => { const j = await api.cam.generate(caseId); watchJob(j.id); }}>Generate CAM</Button>} />
    );
  }
  const dirty = JSON.stringify(comments) !== JSON.stringify(cam.analyst_comments ?? {});
  const save = async (regenerate: boolean) => {
    try {
      const res = await api.cam.saveComments(caseId, comments, regenerate);
      if (res.job) { watchJob(res.job.id); setVersion(undefined); toast.message("Regenerating CAM with your comments…"); }
      else { toast.success("Comments saved"); qc.invalidateQueries({ queryKey: qk.cam(caseId, version) }); }
      setEditing(null);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const name = `CAM-${overview?.case_record.reference ?? "case"}-v${cam.version}`;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
      <Card className="overflow-hidden border-border/70 bg-card">
        <div className="border-b-4 border-primary px-6 py-5 md:px-10">
          <p className="eyebrow text-primary">CredX · Credit Appraisal Memorandum</p>
          <h2 className="mt-1 text-2xl font-semibold">{overview?.company.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{overview?.case_record.reference} · Version {cam.version} · {new Date(cam.created_at).toLocaleString("en-IN")} · narrative by {cam.narrative_provider}</p>
        </div>
        <div className="divide-y divide-border">
          {cam.sections.map((s) => (
            <section key={s.id} id={`cam-${s.id}`} className="group scroll-mt-20 px-6 py-5 md:px-10">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-base font-semibold text-primary">{s.title}</h3>
                {can("analyst") && editing !== s.id && (
                  <Button variant="ghost" size="sm" className="no-print ml-auto h-7 opacity-60 group-hover:opacity-100" onClick={() => setEditing(s.id)}>
                    <MessageSquarePlus className="mr-1 h-3.5 w-3.5" />{comments[s.id] ? "Edit comment" : "Add comment"}
                  </Button>
                )}
              </div>
              <SectionBody s={s} />
              {editing === s.id ? (
                <div className="no-print mt-3 space-y-2">
                  <Textarea autoFocus rows={3} value={comments[s.id] ?? ""} placeholder="Analyst comment for this section (appears in the exported CAM)"
                    onChange={(e) => setComments((c) => ({ ...c, [s.id]: e.target.value }))} aria-label={`Comment on ${s.title}`} />
                  <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Done</Button></div>
                </div>
              ) : comments[s.id] ? (
                <div className="mt-3 rounded-r-lg border-l-4 border-accent bg-accent/10 px-3 py-2 text-sm"><b className="text-accent">Analyst comment:</b> {comments[s.id]}</div>
              ) : null}
            </section>
          ))}
        </div>
      </Card>

      <aside className="no-print space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card className="space-y-3 border-border/70 p-4">
          <p className="eyebrow">Export</p>
          <div className="grid gap-2">
            <Button onClick={() => api.cam.download(cam.id, "pdf", `${name}.pdf`)}><Download className="mr-2 h-4 w-4" />PDF</Button>
            <Button variant="outline" onClick={() => api.cam.download(cam.id, "docx", `${name}.docx`)}><FileText className="mr-2 h-4 w-4" />Word (DOCX)</Button>
            <Button variant="ghost" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print preview</Button>
          </div>
          {cam.versions.length > 1 && (
            <Select value={String(version ?? cam.versions[0])} onValueChange={(v) => setVersion(Number(v) === cam.versions[0] ? undefined : Number(v))}>
              <SelectTrigger aria-label="CAM version"><SelectValue /></SelectTrigger>
              <SelectContent>{cam.versions.map((v) => <SelectItem key={v} value={String(v)}>Version {v}{v === cam.versions[0] ? " (latest)" : ""}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </Card>
        {can("analyst") && (
          <Card className="space-y-2 border-border/70 p-4">
            <p className="eyebrow">Analyst comments</p>
            <p className="text-xs text-muted-foreground">{Object.values(comments).filter(Boolean).length} section comment(s){dirty && " · unsaved changes"}</p>
            <Button size="sm" className="w-full" disabled={!dirty} onClick={() => save(true)}><Save className="mr-2 h-3.5 w-3.5" />Save & regenerate</Button>
            <Button size="sm" variant="outline" className="w-full" disabled={!dirty} onClick={() => save(false)}>Save without regenerating</Button>
          </Card>
        )}
        <Card className="border-border/70 p-4">
          <p className="eyebrow mb-2">Sections</p>
          <nav className="space-y-1 text-sm">{cam.sections.map((s) => <a key={s.id} href={`#cam-${s.id}`} className="block truncate text-muted-foreground hover:text-foreground">{s.title}</a>)}</nav>
        </Card>
      </aside>
    </div>
  );
}
