"use client";

import { AlertTriangle, ArrowUpRight, BriefcaseBusiness, Coins, Gauge, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";

import { PortfolioScatter, RiskDonut, StatusBars } from "@/charts/intel-charts";
import { CardsSkeleton, EmptyState, MetricCard, PageHeader, RiskBadge, SectionCard, StatusBadge, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/hooks/queries";
import { formatCr, relativeTime, titleCase } from "@/lib/format";
import { severityTone } from "@/lib/tones";
import { useAuth } from "@/store/auth";
import { useUi } from "@/store/ui";

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const user = useAuth((s) => s.user);
  const setNewCase = useUi((s) => s.setNewCase);
  const t = data?.totals;
  return (
    <>
      <PageHeader
        eyebrow="Command center"
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${user?.full_name.split(" ")[0] ?? ""}`}
        description="Portfolio health, decision pipeline and forensic alerts across every active underwriting case."
        actions={<Button onClick={() => setNewCase(true)}><BriefcaseBusiness className="mr-2 h-4 w-4" />New case</Button>}
      />
      {isLoading || !t ? <CardsSkeleton /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active cases" numeric={t.cases} icon={BriefcaseBusiness} hint={`${t.scored} scored · ${t.companies} borrowers`} delay={0} />
          <MetricCard label="Requested exposure" value={formatCr(t.requested_exposure)} icon={Coins} tone="accent" hint="Across the open pipeline" delay={0.05} />
          <MetricCard label="Average credit score" numeric={t.avg_score} icon={Gauge} tone="success" hint={`${t.approved} approved · ${t.in_review} in review`} delay={0.1} />
          <MetricCard label="Fraud watchlist" numeric={t.high_fraud} icon={ShieldAlert} tone={t.high_fraud ? "destructive" : "success"} hint={`${t.escalated} escalated to committee`} delay={0.15} />
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" eyebrow="Risk map" title="Credit score vs fraud score" info="Each bubble is a scored case, sized by requested amount. Bottom-right is the comfort zone.">
          {data?.score_distribution.length ? <PortfolioScatter points={data.score_distribution} /> : <EmptyState icon={Gauge} title="No scored cases yet" description="Upload a document pack and run analysis to populate the risk map." />}
        </SectionCard>
        <SectionCard eyebrow="Portfolio" title="Risk mix">
          {data && Object.keys(data.by_risk).length ? <RiskDonut byRisk={data.by_risk} /> : <EmptyState icon={Gauge} title="Nothing scored" />}
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" eyebrow="Queue" title="Recently active cases" actions={<Button asChild variant="ghost" size="sm"><Link href="/cases">View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link></Button>} bodyClassName="p-0">
          <div className="divide-y divide-border">
            {data?.recent_cases.map((c) => (
              <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.company}</p>
                  <p className="font-mono text-xs text-muted-foreground">{c.reference} · {formatCr(c.amount)} · {relativeTime(c.updated_at)}</p>
                </div>
                <StatusBadge status={c.status} />
                <span className="numeric w-10 text-right text-sm font-semibold">{c.score ?? "—"}</span>
                <RiskBadge risk={c.risk} />
              </Link>
            ))}
            {!data?.recent_cases.length && <div className="p-5"><EmptyState icon={BriefcaseBusiness} title="No cases yet" action={<Button onClick={() => setNewCase(true)}>Open the first case</Button>} /></div>}
          </div>
        </SectionCard>
        <div className="space-y-5">
          <SectionCard eyebrow="Forensics" title="Open high-severity alerts" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {data?.alerts.map((a) => (
                <li key={a.id}>
                  <Link href={`/cases/${a.case_id}/fraud`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.company} · {titleCase(a.alert_type)}</p>
                    </div>
                    <ToneBadge tone={severityTone(a.severity)} className="ml-auto">{a.severity}</ToneBadge>
                  </Link>
                </li>
              ))}
              {!data?.alerts.length && <li className="px-5 py-6 text-center text-sm text-muted-foreground">No open high-severity alerts.</li>}
            </ul>
          </SectionCard>
          <SectionCard eyebrow="Pipeline" title="Cases by status">
            {data && <StatusBars byStatus={data.by_status} />}
          </SectionCard>
          <SectionCard eyebrow="AI" title="Copilot usage (30d)">
            <ul className="space-y-2 text-sm">
              {data?.ai_usage.map((u) => (
                <li key={u.provider} className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="capitalize">{u.provider}</span>
                  <span className="numeric ml-auto text-xs text-muted-foreground">{u.calls} calls · {(u.input_tokens + u.output_tokens).toLocaleString("en-IN")} tokens</span>
                </li>
              ))}
              {!data?.ai_usage.length && <li className="text-muted-foreground">No AI calls yet.</li>}
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
