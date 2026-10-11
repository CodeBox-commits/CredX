"use client";

import { motion } from "framer-motion";
import {
  ArrowRight, BadgeIndianRupee, Bot, Check, FileSearch, FileStack, Gavel, Landmark, LineChart, Network, Radar, ReceiptText, ScanSearch,
  ShieldAlert, Sparkles,
} from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/common/logo";
import { GrowBar } from "@/components/common/motion";
import { ScoreRing } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";

const FLOW = [
  { icon: FileStack, title: "Upload", text: "Annual reports, GST returns, bank statements, legal notices" },
  { icon: ScanSearch, title: "Extract", text: "OCR, tables and entities with confidence & provenance" },
  { icon: Radar, title: "Research", text: "Promoter news, litigation, MCA and RBI sector context" },
  { icon: Network, title: "Fraud graph", text: "Circular trading, shell entities, shared directors" },
  { icon: Gavel, title: "Decide", text: "XGBoost score with SHAP drivers, policy & pricing" },
  { icon: ReceiptText, title: "CAM", text: "Banking-grade appraisal memo in PDF & DOCX" },
];

const FEATURES = [
  { icon: FileSearch, title: "Document AI that shows its work", text: "Every extracted number links back to the page, table and snippet it came from — with a confidence score analysts can trust or correct." },
  { icon: Sparkles, title: "Explainable, not a black box", text: "A monotone XGBoost PD model whose SHAP contributions add up exactly to the score, plus analyst overlays you can see and audit." },
  { icon: ShieldAlert, title: "Fraud graph built in", text: "GSTN invoice flows and MCA directorships become a relationship graph that surfaces circular trading and pass-through shells." },
  { icon: Bot, title: "Copilot grounded in the case", text: "Ask why a case scored low, how pricing was built or what would change the decision — answers cite the case data only." },
  { icon: LineChart, title: "Spreads & ratios in seconds", text: "Multi-year P&L and balance-sheet spreads with DSCR, leverage, working-capital cycle and sector benchmarks." },
  { icon: ReceiptText, title: "Committee-ready CAM", text: "Five Cs, financial analysis, fraud observations, pricing and conditions — editable, versioned and exportable." },
];

const INDIA = [
  "GSTR-1 / 3B / 2A reconciliation & ITC checks",
  "MCA21 charges, directors & filing discipline",
  "RBI sector context, PSL & prudential norms",
  "NCLT, DRT, SARFAESI & NI Act §138 detection",
  "Lakh / crore formatting everywhere",
  "Nayak & MPBF working-capital sizing",
];

function HeroPreview() {
  return (
    <div className="relative mx-auto mt-14 w-full max-w-5xl">
      <div className="absolute inset-x-10 -top-6 h-40 rounded-full bg-primary/25 blur-[90px]" />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="panel relative overflow-hidden p-2 shadow-[0_40px_120px_-40px_hsl(var(--primary)/0.45)]">
        <div className="rounded-xl border border-border/70 bg-background">
          <div className="flex items-center gap-1.5 border-b border-border/70 px-4 py-2.5">
            {["bg-destructive/60", "bg-warning/60", "bg-success/60"].map((c) => <span key={c} className={`h-2.5 w-2.5 rounded-full ${c}`} />)}
            <span className="ml-3 font-mono text-[11px] text-muted-foreground">credx.app/cases/sunline</span>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent font-display font-bold text-white">SP</span>
                <div>
                  <p className="font-semibold">Sunline Processors Limited</p>
                  <p className="text-xs text-muted-foreground">CX-2026-0001 · ₹40.00 Cr Term Loan · Food processing</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                {["Documents", "Financials", "Intelligence", "Decision", "CAM"].map((s, i) => (
                  <motion.div key={s} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.12 }}
                    className="flex flex-1 items-center gap-1.5 rounded-lg bg-muted/70 px-2 py-1.5 text-[11px] font-medium">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-white"><Check className="h-2.5 w-2.5" /></span>
                    <span className="truncate">{s}</span>
                  </motion.div>
                ))}
              </div>
              <div className="space-y-2 rounded-xl border border-border/70 p-3">
                <p className="text-xs font-medium text-muted-foreground">Top score drivers (SHAP)</p>
                {[["DSCR of 2.47x covers debt service", 40], ["Healthy EBITDA margin of 14.0%", 8], ["Leverage of 2.3x is moderate", 6], ["Supportive sector backdrop", 4]].map(([t, p], i) => (
                  <div key={String(t)} className="flex items-center gap-3 text-xs">
                    <span className="w-52 truncate">{t}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <GrowBar pct={Number(p) * 2.4} delay={900 + i * 100} className="rounded-full bg-success" />
                    </div>
                    <span className="numeric w-8 text-right text-success">+{p}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/70 bg-surface-2 p-4">
              <ScoreRing score={799} size={140} sublabel="CX2 · Low risk" />
              <span className="rounded-full bg-success/12 px-3 py-1 text-xs font-semibold text-success">Recommend: Approve ₹40.00 Cr @ 10.40%</span>
            </div>
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.4 }}
        className="panel absolute -right-12 -top-8 hidden w-64 animate-float p-3 shadow-xl xl:block">
        <p className="flex items-center gap-2 text-xs font-semibold text-destructive"><ShieldAlert className="h-3.5 w-3.5" /> Circular trading detected</p>
        <p className="mt-1 text-xs text-muted-foreground">Nebula → Zenith → Apex → Nebula · ₹35 Cr re-invoiced round the ring</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.6 }}
        className="panel absolute -bottom-10 -left-12 hidden w-64 p-3 shadow-xl [animation-delay:1s] xl:block xl:animate-float">
        <p className="flex items-center gap-2 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5 text-primary" /> Copilot</p>
        <p className="mt-1 text-xs text-muted-foreground">&ldquo;Kaveri Infra is held back by 161 receivable days — collecting in 75 days would add ~9 points.&rdquo;</p>
      </motion.div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-aurora" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-dots opacity-50 mask-fade-b" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#workflow" className="transition hover:text-foreground">Workflow</a>
          <a href="#features" className="transition hover:text-foreground">Platform</a>
          <a href="#india" className="transition hover:text-foreground">Built for India</a>
        </nav>
        <div className="flex gap-2">
          <Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button>
          <Button asChild><Link href="/dashboard">Open workspace <ArrowRight /></Link></Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-14 text-center md:pt-20">
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-medium text-primary">
          <BadgeIndianRupee className="h-3.5 w-3.5" /> AI underwriting for Indian corporate & MSME lending
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="mx-auto mt-6 max-w-4xl text-balance text-[40px] font-extrabold leading-[1.05] tracking-tight md:text-[64px]">
          Credit decisions you can <span className="text-gradient">explain</span>, in minutes.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
          className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
          CredX turns a borrower&apos;s document pack into a scored, fraud-checked, research-backed recommendation and a committee-ready CAM — with every number traceable to its source.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild><Link href="/dashboard">Launch workspace <ArrowRight /></Link></Button>
          <Button size="lg" variant="outline" asChild><Link href="/login">Try the demo</Link></Button>
        </motion.div>
        <HeroPreview />
      </section>

      <section id="workflow" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <p className="label text-center">One workflow</p>
        <h2 className="mt-2 text-center text-3xl font-bold md:text-4xl">From upload to sanction memo</h2>
        <div className="relative mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="absolute left-[8%] right-[8%] top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block" />
          {FLOW.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="relative text-center">
              <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface text-primary shadow-sm"><f.icon className="h-6 w-6" /></span>
              <p className="mt-3 text-[11px] font-semibold text-primary">0{i + 1}</p>
              <p className="font-semibold">{f.title}</p>
              <p className="mx-auto mt-1 max-w-[180px] text-xs text-muted-foreground">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <p className="label text-center">Platform</p>
        <h2 className="mt-2 text-center text-3xl font-bold md:text-4xl">Everything an underwriter needs, in one place</h2>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="panel-interactive p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></span>
              <p className="mt-4 font-semibold">{f.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="india" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <div className="panel relative overflow-hidden p-8 md:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent"><Landmark className="h-5 w-5" /></span>
              <h2 className="mt-4 text-3xl font-bold">Built for Indian lending, not translated to it</h2>
              <p className="mt-3 text-muted-foreground">GST, MCA, RBI and Indian court forums are first-class signals — not afterthoughts bolted onto a generic scoring model.</p>
            </div>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {INDIA.map((x) => (
                <li key={x} className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-surface p-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"><Check className="h-3 w-3" /></span>{x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-8 text-center">
        <h2 className="text-3xl font-bold md:text-4xl">See it on a real-looking case</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Five fictional borrowers — from a clean approval to a circular-trading decline — are seeded and ready.</p>
        <Button size="lg" className="mt-7" asChild><Link href="/login">Open the demo workspace <ArrowRight /></Link></Button>
      </section>

      <footer className="relative z-10 border-t border-border/70 py-8 text-center text-xs text-muted-foreground">
        CredX · AI corporate credit intelligence · Demo data is fictional
      </footer>
    </div>
  );
}
