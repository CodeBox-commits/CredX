"use client";

import { Loader2, LockKeyhole } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/hooks/queries";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";

// Demo accounts created by `python -m database.seed` (see backend/database/seed.py).
const DEMO = [
  { email: "analyst@credx.demo", label: "Analyst" },
  { email: "manager@credx.demo", label: "Credit manager" },
  { email: "admin@credx.demo", label: "Admin" },
];
const DEMO_PASSWORD = "CredX@2026";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/dashboard";
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const finish = (res: Awaited<ReturnType<typeof api.auth.login>>) => {
    setSession(res.access_token, res.user, res.expires_in);
    toast.success(`Welcome, ${res.user.full_name.split(" ")[0]}`);
    router.replace(next);
  };

  const submit = async (e: FormEvent, mode: "login" | "register") => {
    e.preventDefault();
    setBusy(true);
    try {
      finish(mode === "login" ? await api.auth.login(email, password) : await api.auth.register(email, password, name));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const demo = async (demoEmail: string) => {
    setBusy(true);
    try {
      finish(await api.auth.login(demoEmail, DEMO_PASSWORD));
    } catch (err) {
      toast.error(errorMessage(err), { description: "Seed the demo with: python -m database.seed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card/90 p-7 shadow-2xl backdrop-blur">
      <Logo className="mb-6" />
      <Tabs defaultValue="login">
        <TabsList className="mb-5 grid w-full grid-cols-2">
          <TabsTrigger value="login">Sign in</TabsTrigger>
          <TabsTrigger value="register">Create account</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form className="space-y-4" onSubmit={(e) => submit(e, "login")}>
            <div className="space-y-1.5"><Label htmlFor="email">Work email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button className="w-full" disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}Sign in</Button>
          </form>
        </TabsContent>
        <TabsContent value="register">
          <form className="space-y-4" onSubmit={(e) => submit(e, "register")}>
            <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="remail">Work email</Label><Input id="remail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rpass">Password</Label><Input id="rpass" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button className="w-full" disabled={busy}>Create account</Button>
            <p className="text-xs text-muted-foreground">The first account on a fresh install becomes the administrator; later sign-ups join as analysts.</p>
          </form>
        </TabsContent>
      </Tabs>
      <div className="mt-6 border-t border-border pt-5">
        <p className="eyebrow mb-2.5">Demo workspace (seeded, fictional data)</p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO.map((d) => <Button key={d.email} variant="secondary" size="sm" disabled={busy} onClick={() => demo(d.email)}>{d.label}</Button>)}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="terminal-grid relative flex min-h-screen items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_30%,hsl(var(--primary)/0.18),transparent)]" />
      <Suspense><LoginForm /></Suspense>
    </div>
  );
}
