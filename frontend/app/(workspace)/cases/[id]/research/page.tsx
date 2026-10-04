"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, Globe2, Landmark, Newspaper, RefreshCw, Scale } from "lucide-react";
import { useState } from "react";

import { SentimentTimeline } from "@/charts/intel-charts";
import { useCaseContext } from "@/components/case/case-context";
import { BlockSkeleton, EmptyState, SectionCard, Stat, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCaseAction, useResearch } from "@/hooks/queries";
import { formatCr, relativeTime, titleCase } from "@/lib/format";
import { riskTone, severityTone, statusTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import type { ResearchFinding } from "@/types/api";

function FindingCard({ f, index }: { f: ResearchFinding; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.03, 0.3) }} className="rounded-xl border border-border bg-card">
      <button className="flex w-full items-start gap-3 p-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="numeric mt-0.5 w-6 shrink-0 text-xs text-muted-foreground">[{index + 1}]</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{f.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {f.source} · {f.published_at ? relativeTime(f.published_at) : "undated"} · {titleCase(f.category)}
            {f.provider === "demo_intel" && <span className="ml-1 text-accent">· demo data (fictional)</span>}
          </p>
        </div>
        <ToneBadge tone={severityTone(f.severity)}>{f.severity}</ToneBadge>
        <span className={cn("numeric w-12 text-right text-xs", f.sentiment < -0.15 ? "text-destructive" : f.sentiment > 0.15 ? "text-success" : "text-muted-foreground")}>
          {f.sentiment > 0 ? "+" : ""}{f.sentiment.toFixed(2)}
        </span>
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 transition", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-border px-12 py-3 text-sm text-muted-foreground">
              {f.snippet || "No snippet provided by the source."}
              {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">Source <ExternalLink className="h-3 w-3" /></a>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export default function ResearchPage() {
  const { caseId, watchJob } = useCaseContext();
  const { data: r, isLoading } = useResearch(caseId);
  const can = useAuth((s) => s.can);
  const run = useCaseAction(caseId, "research", (j) => watchJob(j.id));
  const [cat, setCat] = useState("all");

  if (isLoading) return <BlockSkeleton />;
  if (!r) return <EmptyState icon={Globe2} title="No research yet" description="Secondary research runs as part of full analysis, or on its own." action={can("analyst") && <Button onClick={() => run.mutate()}>Run research</Button>} />;
  const findings = r.findings.filter((f) => cat === "all" || f.category === cat);
  const cats = ["all", ...new Set(r.findings.map((f) => f.category))];

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <SectionCard eyebrow="Synthesis" title="External intelligence summary" className="xl:col-span-2"
        actions={can("analyst") && <Button variant="outline" size="sm" onClick={() => run.mutate()} disabled={run.isPending}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh</Button>}>
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div><p className="eyebrow">Litigation risk</p><ToneBadge tone={riskTone(r.litigation_risk)} className="mt-1">{r.litigation_risk} · {Math.round(r.litigation_score)}</ToneBadge></div>
          <div><p className="eyebrow">Promoter sentiment</p><ToneBadge tone={statusTone(r.promoter_sentiment)} className="mt-1">{r.promoter_sentiment} · {r.sentiment_score.toFixed(2)}</ToneBadge></div>
          <div><p className="eyebrow">Sector outlook</p><ToneBadge tone={statusTone(r.sector_outlook)} className="mt-1">{r.sector_outlook}</ToneBadge></div>
          <div><p className="eyebrow">Overall external risk</p><ToneBadge tone={riskTone(r.overall_risk)} className="mt-1">{r.overall_risk}</ToneBadge></div>
        </div>
        <p className="text-sm leading-relaxed">{r.summary}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Sources: {r.providers.join(", ")} · summary by {r.summary_provider ?? "local"} · {r.queries.length} queries · {relativeTime(r.created_at)}
        </p>
      </SectionCard>

      <SectionCard eyebrow="Timeline" title="Sentiment over time">
        <SentimentTimeline findings={r.findings} />
      </SectionCard>

      <SectionCard eyebrow="Findings" title={`Research cards (${r.findings.length})`} className="xl:col-span-2"
        actions={
          <ToggleGroup type="single" value={cat} onValueChange={(v) => v && setCat(v)} aria-label="Filter findings">
            {cats.map((c) => <ToggleGroupItem key={c} value={c} size="sm" className="h-7 text-xs">{titleCase(c)}</ToggleGroupItem>)}
          </ToggleGroup>
        }>
        <ul className="space-y-2">
          {findings.map((f) => <FindingCard key={f.title} f={f} index={r.findings.indexOf(f)} />)}
          {!findings.length && <p className="text-sm text-muted-foreground">No findings in this category.</p>}
        </ul>
      </SectionCard>

      <div className="space-y-5">
        <SectionCard eyebrow="Courts & tribunals" title="Litigation exposure" actions={<Scale className="h-4 w-4 text-muted-foreground" />}>
          <ul className="space-y-2.5 text-sm">
            {r.litigation_cases.map((c, i) => (
              <li key={i} className="rounded-lg border border-border p-2.5">
                <p className="font-medium">{c.title ?? c.types.join(", ")}</p>
                <p className="text-xs text-muted-foreground">
                  {c.source === "document" ? "Uploaded notice" : "News"}{c.forum && ` · ${c.forum}`}{c.claim_amount ? ` · claim ${formatCr(c.claim_amount)}` : ""}{c.status && ` · ${c.status}`}
                  {c.borrower_is_claimant && <span className="text-success"> · borrower is claimant</span>} · weight {c.weight}
                </p>
              </li>
            ))}
            {!r.litigation_cases.length && <li className="text-muted-foreground">No litigation identified.</li>}
          </ul>
        </SectionCard>
        {r.mca && (
          <SectionCard eyebrow="MCA21" title="Corporate registry" actions={<Landmark className="h-4 w-4 text-muted-foreground" />}>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Status" value={titleCase(r.mca.company_status)} />
              <Stat label="Vintage" value={r.mca.vintage_years ? `${r.mca.vintage_years} yrs` : "—"} />
              <Stat label="Open charges" value={r.mca.open_charges.length} />
              <Stat label="Directors" value={r.mca.directors.length} />
            </div>
            {r.mca.cin_details && <p className="mt-3 font-mono text-xs text-muted-foreground">{r.mca.cin} · {r.mca.cin_details.listing} · {r.mca.cin_details.company_class}</p>}
            <ul className="mt-3 space-y-1.5 text-sm">{r.mca.observations.map((o) => <li key={o.text} className="flex gap-2"><ToneBadge tone={severityTone(o.severity)}>{o.severity}</ToneBadge>{o.text}</li>)}</ul>
          </SectionCard>
        )}
      </div>

      <SectionCard eyebrow={`Sector knowledge base · ${r.sector.kb_version}`} title={`${r.sector.name} — risk band ${r.sector.risk}/5`} className="xl:col-span-3"
        actions={<Newspaper className="h-4 w-4 text-muted-foreground" />}>
        <div className="grid gap-5 md:grid-cols-3">
          {[["Headwinds", r.sector.headwinds, "text-destructive"], ["Tailwinds", r.sector.tailwinds, "text-success"], ["RBI & regulatory context", r.sector.rbi_context, "text-primary"]].map(([title, items, cls]) => (
            <div key={title as string}>
              <p className={cn("mb-2 text-xs font-semibold", cls as string)}>{title as string}</p>
              <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">{(items as string[]).map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
