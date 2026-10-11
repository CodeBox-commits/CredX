"use client";

import { motion } from "framer-motion";
import { ArrowRight, Briefcase, Check, FileSearch, Gavel, Loader2, Network, ReceiptText, ShieldCheck, Sparkles, UserCog } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { DEMO_MODE } from "@/services/client";
import { useAuth } from "@/store/auth";

// Demo accounts created by `python -m database.seed` (see backend/database/seed.py).
const DEMO = [
  { email: "analyst@credx.demo", label: "Credit analyst", hint: "Upload, analyse, add notes", icon: Briefcase },
  { email: "manager@credx.demo", label: "Credit manager", hint: "Decide, approve overrides", icon: Gavel },
  { email: "admin@credx.demo", label: "Administrator", hint: "Users, audit & models", icon: UserCog },
];
const DEMO_PASSWORD = "CredX@2026";

const STEPS = [
  { icon: FileSearch, label: "Documents read", detail: "Annual report · GSTR-3B · bank statement" },
  { icon: Network, label: "Fraud graph built", detail: "Circular trading & shared directors checked" },
  { icon: Sparkles, label: "Explainable score", detail: "799 · CX2 · every point traced" },
  { icon: ReceiptText, label: "CAM drafted", detail: "Committee-ready PDF & DOCX" },
];

function StoryPanel() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % (STEPS.length + 1)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative hidden overflow-hidden bg-[hsl(234_45%_12%)] p-10 text-white lg:flex lg:flex-col">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-primary/40 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[420px] w-[420px] rounded-full bg-accent/30 blur-[120px]" />
      <div className="relative"><Logo className="[&_span]:text-white [&_.text-muted-foreground]:text-white/60" /></div>

      <div className="relative mt-auto max-w-md">
        <p className="text-sm font-medium text-white/60">AI underwriting for Indian corporate lending</p>
        <h2 className="mt-3 font-display text-[34px] font-bold leading-[1.1]">From document pack to credit decision in minutes.</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-white/70">
          CredX reads the financials, checks GST and banking for fraud, researches the promoters and explains every point of the score.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium text-white/60">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-emerald-400" /><span className="relative h-2 w-2 rounded-full bg-emerald-400" /></span>
            Live pipeline · Sunline Processors Ltd
          </p>
          <ol className="space-y-2.5">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={s.label} className="flex items-center gap-3">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-500", done ? "bg-emerald-400/20 text-emerald-300" : active ? "bg-white/15 text-white" : "bg-white/5 text-white/40")}>
                    {done ? <Check className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <s.icon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm transition-colors duration-500", done || active ? "text-white" : "text-white/45")}>{s.label}</span>
                    <span className="block truncate text-xs text-white/45">{s.detail}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <p className="relative mt-10 flex items-center gap-2 text-xs text-white/45"><ShieldCheck className="h-3.5 w-3.5" /> Role-based access · full audit trail · data stays in your deployment</p>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/dashboard";
  const setSession = useAuth((s) => s.setSession);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const finish = (res: Awaited<ReturnType<typeof api.auth.login>>) => {
    setSession(res.access_token, res.user, res.expires_in);
    toast.success(`Welcome, ${res.user.full_name.split(" ")[0]}`);
    router.replace(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("form");
    try {
      finish(mode === "login" ? await api.auth.login(email, password) : await api.auth.register(email, password, name));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const demo = async (demoEmail: string) => {
    setBusy(demoEmail);
    try {
      finish(await api.auth.login(demoEmail, DEMO_PASSWORD));
    } catch (err) {
      toast.error(errorMessage(err), { description: "Seed the demo with: python -m database.seed" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-[400px]">
      <Link href="/" className="lg:hidden"><Logo className="mb-10" /></Link>
      <h1 className="text-[26px] font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{mode === "login" ? "Sign in to your underwriting workspace." : "The first account on a fresh install becomes the administrator."}</p>

      <div className="mt-8">
        <p className="label mb-3">{DEMO_MODE ? "Demo workspace — pick a role" : "Try the seeded demo workspace"}</p>
        <div className="grid gap-2">
          {DEMO.map((d) => (
            <button key={d.email} onClick={() => demo(d.email)} disabled={!!busy}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition hover:border-primary/40 hover:shadow-[0_8px_24px_-16px_hsl(var(--primary)/0.6)] disabled:opacity-60">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><d.icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{d.label}</span>
                <span className="block text-xs text-muted-foreground">{d.hint}</span>
              </span>
              {busy === d.email ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />}
            </button>
          ))}
        </div>
      </div>

      <div className="my-7 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or use your account<span className="h-px flex-1 bg-border" /></div>

      <form className="space-y-4" onSubmit={submit}>
        {mode === "register" && (
          <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ananya Rao" /></div>
        )}
        <div className="space-y-1.5"><Label htmlFor="email">Work email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@bank.in" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : undefined} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button className="w-full" size="lg" disabled={!!busy}>
          {busy === "form" && <Loader2 className="animate-spin" />}{mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? "New to CredX?" : "Already have an account?"}{" "}
        <button className="font-medium text-primary hover:underline" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <StoryPanel />
      <div className="relative flex items-center justify-center px-5 py-12">
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-40 lg:hidden" />
        <Suspense><LoginForm /></Suspense>
      </div>
    </div>
  );
}
