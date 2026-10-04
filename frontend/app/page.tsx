"use client";

import { motion } from "framer-motion";
import { ArrowRight, Bot, FileSearch, Network, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";

const FEATURES = [
  { icon: FileSearch, title: "Document AI", text: "Annual reports, GSTR-1/3B/2A, bank statements, MCA filings and legal notices → structured, cited financials. OCR for scans." },
  { icon: Sparkles, title: "Explainable scoring", text: "Monotone XGBoost PD model with exact SHAP points, policy rule book, Five Cs, loan sizing and risk-based pricing." },
  { icon: Network, title: "Fraud graph", text: "Circular trading, shared directors, shell conduits and GST mismatches — visualised as an interactive entity graph." },
  { icon: ShieldCheck, title: "Research intelligence", text: "Promoter news, NCLT/IBC litigation, MCA signals and RBI-aware sector outlook with source attribution." },
  { icon: ReceiptText, title: "Committee-ready CAM", text: "Banking-grade Credit Appraisal Memo with analyst comments, exported to PDF and DOCX in one click." },
  { icon: Bot, title: "AI copilot", text: "Grounded answers about any case — Claude, OpenAI or Gemini with automatic fallback and token accounting." },
];

const FLOW = ["Upload", "Extract", "Research", "Fraud graph", "Score & explain", "CAM"];

export default function Landing() {
  const token = useAuth((s) => s.token);
  const cta = token ? "/dashboard" : "/login";
  return (
    <div className="min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--primary)/0.25),transparent)]" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <Button asChild variant="outline" size="sm"><Link href={cta}>{token ? "Open workspace" : "Sign in"}</Link></Button>
      </header>
      <main className="relative mx-auto max-w-6xl px-6">
        <section className="pb-16 pt-14 text-center md:pt-24">
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="eyebrow mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
            Built for Indian corporate & MSME lending
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mx-auto max-w-4xl text-balance text-4xl font-semibold leading-[1.08] md:text-6xl">
            The AI-native underwriting operating system for <span className="bg-gradient-to-r from-primary to-chart-5 bg-clip-text text-transparent">corporate credit</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
            From a borrower's document pack to an explainable lending decision and a committee-ready CAM — in minutes, with every number traceable to its source.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg" className="gap-2"><Link href={cta}>Launch workspace <ArrowRight className="h-4 w-4" /></Link></Button>
          </motion.div>
          <div className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-center gap-2">
            {FLOW.map((step, i) => (
              <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.06 }} className="flex items-center gap-2">
                <span className="rounded-full border border-border bg-card px-3 py-1.5 font-mono text-xs">{String(i + 1).padStart(2, "0")} {step}</span>
                {i < FLOW.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </motion.div>
            ))}
          </div>
        </section>
        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
              className="card-hover rounded-2xl border border-border bg-card/80 p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </motion.div>
          ))}
        </section>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        CredX · Decision support for credit professionals — final sanction rests with the delegated authority.
      </footer>
    </div>
  );
}
