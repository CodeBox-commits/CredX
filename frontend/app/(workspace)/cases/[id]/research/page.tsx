"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Building2, ChevronDown, ExternalLink, Factory, Gavel, Globe2, Landmark, Loader2, Megaphone, Newspaper, RefreshCw, Scale, ShieldAlert, Smile,
  TrendingDown, TrendingUp,
} from "lucide-react";
import { useState } from "react";

import { SentimentTimeline } from "@/charts/intel-charts";
import { useCaseContext } from "@/components/case/case-context";
import { BlockSkeleton, EmptyState, SectionCard, Stat, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { useCaseAction, useResearch } from "@/hooks/queries";
import { formatCr, relativeTime, titleCase } from "@/lib/format";
import { riskTone, severityTone, statusTone, type Tone, toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import type { ResearchFinding } from "@/types/api";

const CAT_ICON: Record<string, typeof Newspaper> = { news: Newspaper, litigation: Scale, regulatory: Gavel, mca: Building2, fraud: ShieldAlert, sector: Factory };

function SignalTile({ icon: Icon, label, value, tone, detail, delay }: { icon: typeof Scale; label: string; value: string; tone: Tone; detail: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="panel relative overflow-hidden p-4">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: toneHsl[tone] }} />
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: toneHsl[tone].replace(")", " / 0.12)"), color: toneHsl[tone] }}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-2 font-display text-xl font-bold" style={{ color: toneHsl[tone] }}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </motion.div>
  );
}

function FindingCard({ f, index }: { f: ResearchFinding; index: number }) {
  const [open, setOpen] = useState(false);
  const Icon = CAT_ICON[f.category] ?? Newspaper;
  const tone = severityTone(f.severity);
  return (
    <motion.li layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index * 0.04, 0.3) }} className="relative pl-8">
      <span className="absolute left-0 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card" style={{ background: toneHsl[tone] }}>
        <Icon className="h-3 w-3 text-white" />
      </span>
      <div className="rounded-xl border border-border bg-surface transition hover:border-foreground/15">
        <button className="flex w-full items-start gap-3 p-3.5 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">{f.title}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="numeric">[{index + 1}]</span><span>{f.source}</span><span>·</span><span>{f.published_at ? relativeTime(f.published_at) : "undated"}</span>
              {(f.provider === "demo_intel" || f.provider === "offline") && <span className="text-accent">· demo (fictional)</span>}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <ToneBadge tone={tone}>{f.severity}</ToneBadge>
            <span className={cn("numeric inline-flex items-center gap-0.5 text-[11px]", f.sentiment < -0.15 ? "text-destructive" : f.sentiment > 0.15 ? "text-success" : "text-muted-foreground")}>
              {f.sentiment < -0.15 ? <TrendingDown className="h-3 w-3" /> : f.sentiment > 0.15 ? <TrendingUp className="h-3 w-3" /> : null}
              {f.sentiment > 0 ? "+" : ""}{f.sentiment.toFixed(2)}
            </span>
          </div>
          <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="border-t border-border/70 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
                {f.snippet || "No snippet provided by the source."}
                {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">Open source <ExternalLink className="h-3 w-3" /></a>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
  if (!r) {
    return <EmptyState icon={Globe2} title="No research yet" description="Secondary research runs as part of full analysis, or on its own."
      action={can("analyst") && <Button onClick={() => run.mutate()} disabled={run.isPending}>{run.isPending ? <Loader2 className="animate-spin" /> : <Globe2 />} Run research</Button>} />;
  }
  const counts = r.findings.reduce<Record<string, number>>((m, f) => ((m[f.category] = (m[f.category] ?? 0) + 1), m), {});
  const findings = [...r.findings].filter((f) => cat === "all" || f.category === cat)
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  const sectorRisk = r.sector.risk > 5 ? `${r.sector.risk}/100` : `${r.sector.risk}/5`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SignalTile icon={Scale} label="Litigation risk" value={titleCase(r.litigation_risk.toLowerCase())} tone={riskTone(r.litigation_risk)} detail={`${r.litigation_cases.length} matter(s) · score ${Math.round(r.litigation_score)}`} delay={0} />
        <SignalTile icon={Smile} label="Promoter sentiment" value={titleCase(r.promoter_sentiment.toLowerCase())} tone={statusTone(r.promoter_sentiment)} detail={`Avg sentiment ${r.sentiment_score >= 0 ? "+" : ""}${r.sentiment_score.toFixed(2)}`} delay={0.05} />
        <SignalTile icon={Factory} label="Sector outlook" value={titleCase(r.sector_outlook.toLowerCase())} tone={statusTone(r.sector_outlook)} detail={`${r.sector.name} · risk ${sectorRisk}`} delay={0.1} />
        <SignalTile icon={ShieldAlert} label="Overall external risk" value={titleCase(r.overall_risk.toLowerCase())} tone={riskTone(r.overall_risk)} detail={`${r.findings.length} findings · ${r.providers.length} sources`} delay={0.15} />
      </div>

      <SectionCard title="Intelligence summary" icon={Megaphone}
        actions={can("analyst") && <Button variant="outline" size="sm" onClick={() => run.mutate()} disabled={run.isPending}>{run.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh</Button>}>
        <p className="text-[15px] leading-relaxed">{r.summary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Sources:</span>
          {r.providers.map((p) => <span key={p} className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px]">{p}</span>)}
          <span className="ml-auto">Summary by {r.summary_provider ?? "local"} · {r.queries.length} queries · {relativeTime(r.created_at)}</span>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SectionCard title="Intelligence feed" icon={Newspaper}
          actions={
            <div className="flex flex-wrap gap-1">
              {["all", ...Object.keys(counts)].map((c) => (
                <button key={c} onClick={() => setCat(c)} className={cn("rounded-lg px-2.5 py-1 text-xs font-medium transition", cat === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  {titleCase(c)} <span className="numeric opacity-70">{c === "all" ? r.findings.length : counts[c]}</span>
                </button>
              ))}
            </div>
          }>
          <ul className="relative space-y-3 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-px before:bg-border">
            {findings.map((f) => <FindingCard key={f.title} f={f} index={r.findings.indexOf(f)} />)}
            {!findings.length && <p className="pl-8 text-sm text-muted-foreground">No findings in this category.</p>}
          </ul>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Sentiment over time" icon={TrendingUp}><SentimentTimeline findings={r.findings} /></SectionCard>

          <SectionCard title="Litigation exposure" icon={Scale}>
            <ul className="space-y-2.5">
              {r.litigation_cases.map((c, i) => (
                <li key={i} className="rounded-xl border border-border/70 p-3">
                  <p className="text-[13px] font-medium">{c.title ?? c.types.map(titleCase).join(", ")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.forum ?? (c.source === "documents" ? "Uploaded notice" : "News")}{c.status && ` · ${c.status}`}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.claim_amount ? <ToneBadge tone="warning">Claim {formatCr(c.claim_amount)}</ToneBadge> : null}
                    {c.borrower_is_claimant && <ToneBadge tone="success">Borrower is claimant</ToneBadge>}
                    {c.types.map((t) => <ToneBadge key={t} tone="muted">{titleCase(t)}</ToneBadge>)}
                  </div>
                </li>
              ))}
              {!r.litigation_cases.length && <li className="rounded-xl bg-success/[0.07] p-3 text-[13px] text-success">No litigation identified across courts, tribunals and documents.</li>}
            </ul>
          </SectionCard>

          {r.mca && (
            <SectionCard title="MCA21 registry" icon={Landmark}>
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Status" value={titleCase(r.mca.company_status)} tone={r.mca.company_status.toLowerCase() === "active" ? "success" : "destructive"} />
                <Stat label="Vintage" value={r.mca.vintage_years ? `${r.mca.vintage_years} yrs` : "—"} />
                <Stat label="Open charges" value={r.mca.open_charges.length} />
                <Stat label="Directors" value={r.mca.directors.length} />
              </div>
              {r.mca.cin && <p className="mt-3 font-mono text-xs text-muted-foreground">CIN {r.mca.cin}</p>}
              <ul className="mt-3 space-y-2">{r.mca.observations.map((o) => <li key={o.text} className="flex items-start gap-2 text-[13px]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: toneHsl[severityTone(o.severity)] }} />{o.text}</li>)}</ul>
            </SectionCard>
          )}
        </div>
      </div>

      <SectionCard title={`${r.sector.name} — sector context`} icon={Factory} info={`CredX sector knowledge base ${r.sector.kb_version}. Verify the latest RBI circulars before relying on a reference.`}>
        <div className="grid gap-4 md:grid-cols-3">
          {([["Headwinds", r.sector.headwinds, "destructive", TrendingDown], ["Tailwinds", r.sector.tailwinds, "success", TrendingUp], ["RBI & regulatory context", r.sector.rbi_context, "primary", Landmark]] as const).map(([title, items, tone, Icon]) => (
            <div key={title} className="rounded-xl border border-border/70 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: toneHsl[tone] }}><Icon className="h-4 w-4" />{title}</p>
              <ul className="space-y-2 text-[13px] text-muted-foreground">{items.map((x) => <li key={x} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />{x}</li>)}</ul>
            </div>
          ))}
        </div>
        {r.sector.benchmark_ebitda_margin != null && <p className="mt-3 text-xs text-muted-foreground">Sector benchmark EBITDA margin: <b className="text-foreground">{(r.sector.benchmark_ebitda_margin * 100).toFixed(0)}%</b></p>}
      </SectionCard>
    </div>
  );
}
