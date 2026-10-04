"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu, ScrollText, Search, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionCard, Stat, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/hooks/queries";
import { relativeTime } from "@/lib/format";
import { api } from "@/services/api";
import { roleLabel, useAuth } from "@/store/auth";
import type { Role } from "@/types/api";

const ROLES: Role[] = ["admin", "credit_manager", "analyst", "viewer"];

function UsersTab() {
  const qc = useQueryClient();
  const me = useAuth((s) => s.user);
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: api.users.list });
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "analyst" });
  const create = useMutation({
    mutationFn: () => api.users.create(form),
    onSuccess: () => { toast.success("User created"); setForm({ full_name: "", email: "", password: "", role: "analyst" }); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const update = async (id: string, body: Record<string, unknown>) => {
    try { await api.users.update(id, body); qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Updated"); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <SectionCard title="Team" className="xl:col-span-2" bodyClassName="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-2">User</th><th className="px-4 py-2">Role</th><th className="px-4 py-2">Active</th><th className="px-4 py-2 text-right">Last login</th></tr></thead>
          <tbody className="divide-y divide-border">
            {users?.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2"><p className="font-medium">{u.full_name}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                <td className="px-4 py-2">
                  <Select value={u.role} onValueChange={(v) => update(u.id, { role: v })} disabled={u.id === me?.id}>
                    <SelectTrigger className="h-8 w-40" aria-label={`Role for ${u.email}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-2"><Switch checked={u.is_active} disabled={u.id === me?.id} onCheckedChange={(v) => update(u.id, { is_active: v })} aria-label={`Active ${u.email}`} /></td>
                <td className="px-4 py-2 text-right text-xs text-muted-foreground">{relativeTime(u.last_login_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
      <SectionCard title="Invite user">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <Input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} aria-label="Full name" />
          <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="Email" />
          <Input type="password" placeholder="Temporary password (min 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-label="Password" />
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}</SelectContent>
          </Select>
          <Button className="w-full" disabled={create.isPending || form.password.length < 8}>Create user</Button>
        </form>
      </SectionCard>
    </div>
  );
}

function AuditTab() {
  const [action, setAction] = useState("");
  const { data } = useQuery({ queryKey: ["audit", action], queryFn: () => api.audit.list(action ? { action } : {}) });
  return (
    <SectionCard title="Immutable audit trail" bodyClassName="p-0" actions={
      <div className="relative"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="h-8 w-56 pl-8" placeholder="Filter action (e.g. case.)" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter audit by action" /></div>
    }>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Actor</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Summary</th><th className="px-4 py-2">Request</th></tr></thead>
          <tbody className="divide-y divide-border">
            {data?.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("en-IN")}</td>
                <td className="px-4 py-2 text-xs">{a.actor_email}</td>
                <td className="px-4 py-2 font-mono text-xs">{a.action}</td>
                <td className="max-w-md truncate px-4 py-2" title={JSON.stringify(a.details)}>{a.summary}</td>
                <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">{a.request_id?.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function ModelTab() {
  const { data: model } = useQuery({ queryKey: ["model-info"], queryFn: api.score.model });
  const { data: providers } = useQuery({ queryKey: ["copilot-providers"], queryFn: api.copilot.providers });
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <SectionCard eyebrow="Risk model" title={model?.version ?? "…"} className="xl:col-span-2">
        {model && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <Stat label="AUC" value={model.metrics.auc} /><Stat label="Gini" value={model.metrics.gini} /><Stat label="KS" value={model.metrics.ks} />
              <Stat label="Brier" value={model.metrics.brier} /><Stat label="Trees" value={model.trees} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Trained {relativeTime(model.trained_at)} on {model.data_source} · monotone constraints {model.params.monotone_constraints}</p>
            <p className="eyebrow mb-2 mt-5">Global importance (mean |SHAP|)</p>
            <ul className="space-y-1.5">
              {model.global_importance.map((g: { feature: string; label: string; mean_abs_shap: number }) => {
                const max = model.global_importance[0].mean_abs_shap;
                return (
                  <li key={g.feature} className="grid grid-cols-[180px_1fr_60px] items-center gap-3 text-xs">
                    <span className="truncate">{g.label}</span>
                    <div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(g.mean_abs_shap / max) * 100}%` }} /></div>
                    <span className="numeric text-right text-muted-foreground">{g.mean_abs_shap.toFixed(3)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </SectionCard>
      <SectionCard eyebrow="AI copilot" title="Provider chain">
        <ol className="space-y-2 text-sm">
          {providers?.order.map((p, i) => (
            <li key={p} className="flex items-center gap-2">
              <span className="numeric w-5 text-muted-foreground">{i + 1}.</span>
              <span className="capitalize">{p}</span>
              {providers.models[p] && <span className="font-mono text-xs text-muted-foreground">{providers.models[p]}</span>}
              <ToneBadge tone={providers.active.includes(p) ? "success" : "muted"} className="ml-auto">{providers.active.includes(p) ? "active" : "no key"}</ToneBadge>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">Set ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY on the backend. Failures fall through to the next provider; the local grounded engine is always last.</p>
      </SectionCard>
    </div>
  );
}

export default function AdminPage() {
  const isAdmin = useAuth((s) => s.can("admin"));
  return (
    <>
      <PageHeader eyebrow="Governance" title="Users, audit & models" description="Role-based access, an append-only audit trail and model risk transparency." />
      <Tabs defaultValue={isAdmin ? "users" : "audit"}>
        <TabsList className="mb-5">
          {isAdmin && <TabsTrigger value="users"><Users className="mr-1.5 h-3.5 w-3.5" />Users</TabsTrigger>}
          <TabsTrigger value="audit"><ScrollText className="mr-1.5 h-3.5 w-3.5" />Audit trail</TabsTrigger>
          <TabsTrigger value="model"><Cpu className="mr-1.5 h-3.5 w-3.5" />Model & AI</TabsTrigger>
        </TabsList>
        {isAdmin && <TabsContent value="users"><UsersTab /></TabsContent>}
        <TabsContent value="audit"><AuditTab /></TabsContent>
        <TabsContent value="model"><ModelTab /></TabsContent>
      </Tabs>
    </>
  );
}
