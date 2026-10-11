"use client";

import { AlertTriangle, ArrowRight, BriefcaseBusiness, Clock3, Coins, Gauge, History, Plus, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PipelineFunnel, PortfolioScatter, RiskMix } from "@/charts/intel-charts";
import { LiveTicker } from "@/components/common/live-ticker";
import { CardsSkeleton, EmptyState, MetricCard, SectionCard, StatusBadge, ToneBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCases, useDashboard } from "@/hooks/queries";
import { formatCr, relativeTime, titleCase } from "@/lib/format";
import { scoreTone, severityTone, toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { useUi } from "@/store/ui";
import { attentionItems } from "@/components/dashboard/attention";


function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const { data: cases } = useCases();
  const user = useAuth((s) => s.user);
  const can = useAuth((s) => s.can);
  const setNewCase = useUi((s) => s.setNewCase);
  const router = useRouter();
  const activity = data?.recent_activity;
  const t = data?.totals;
  const attention = data && cases ? attentionItems(cases.items, data.alerts) : [];
  const scores = (data?.score_distribution ?? []).map((p) => p.score).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight md:text-[32px]">
            {greeting()}, <span className="text-gradient">{user?.full_name.split(" ")[0] ?? ""}</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {attention.length ? <>You have <b className="text-foreground">{attention.length} item{attention.length > 1 ? "s" : ""}</b> needing attention across {t?.cases ?? 0} active cases.</> : "Your underwriting queue is clear."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/copilot"><Sparkles className="text-primary" /> Ask copilot</Link></Button>
          {can("analyst") && <Button onClick={() => setNewCase(true)}><Plus /> New case</Button>}
        </div>
      </div>

      <LiveTicker data={data} activity={activity} />

      {/* KPIs */}
      {isLoading || !t ? <CardsSkeleton /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active cases" numeric={t.cases} icon={BriefcaseBusiness} hint={<>{t.scored} scored · {t.in_review} in review</>} trend={[2, 3, 3, 4, 4, 5, t.cases]} onClick={() => router.push("/cases")} />
          <MetricCard label="Requested exposure" value={formatCr(t.requested_exposure)} icon={Coins} tone="accent" hint="Across the open pipeline" trend={[60, 82, 95, 110, 128, 140, t.requested_exposure / 1e7]} delay={0.05} />
          <MetricCard label="Average CredX score" numeric={t.avg_score} icon={Gauge} tone={scoreTone(t.avg_score)} hint={<>{t.approved} approved · {t.escalated} at committee</>} trend={scores.length > 1 ? scores : undefined} delay={0.1} onClick={() => router.push("/cases?sort=score")} />
          <MetricCard label="Fraud watchlist" numeric={t.high_fraud} icon={ShieldAlert} tone={t.high_fraud ? "destructive" : "success"} hint={t.high_fraud ? "Cases with fraud score ≥ 50" : "No elevated fraud risk"} delay={0.15} onClick={() => router.push("/cases?risk=CRITICAL")} />
        </div>
      )}

      {/* Attention + pipeline */}
      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title="Needs your attention" icon={AlertTriangle} info="Actionable items across your queue: fraud signals, committee escalations, cases ready for a decision and drafts awaiting documents." bodyClassName="p-0"
          actions={<Button variant="ghost" size="sm" asChild><Link href="/cases">All cases <ArrowRight /></Link></Button>}>
          {!data || !cases ? (
            <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : attention.length ? (
            <ul className="stagger divide-y divide-border/70">
              {attention.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-muted/40">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${toneHsl[a.tone].replace(")", " / 0.12)")}`, color: toneHsl[a.tone] }}>
                      <a.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{a.title}</span>
                      <span className="block truncate text-[13px] text-muted-foreground">{a.reason}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition group-hover:border-primary/40 group-hover:text-primary">
                      {a.cta} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5"><EmptyState compact icon={Clock3} title="All caught up" description="Nothing is waiting on you right now." /></div>
          )}
        </SectionCard>

        <SectionCard title="Pipeline" icon={BriefcaseBusiness} info="Cases by lifecycle stage. Click a stage to filter the case list.">
          {data ? <PipelineFunnel byStatus={data.by_status} /> : <Skeleton className="h-56 rounded-xl" />}
        </SectionCard>
      </div>

      {/* Risk map + mix */}
      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title="Portfolio risk map" icon={Gauge} info="Each bubble is a scored case, sized by requested amount. Bottom-right is the comfort zone; anything above 50 on the fraud axis needs forensic review.">
          {data?.score_distribution.length ? <PortfolioScatter points={data.score_distribution} /> : <EmptyState compact icon={Gauge} title="No scored cases yet" description="Upload a document pack and run analysis to populate the risk map." />}
        </SectionCard>
        <SectionCard title="Risk mix" icon={ShieldAlert}>
          {data ? <RiskMix byRisk={data.by_risk} /> : <Skeleton className="h-40 rounded-xl" />}
          {data && (
            <div className="mt-5 border-t border-border/70 pt-4">
              <p className="label mb-2">Exposure by sector</p>
              <ul className="space-y-1.5">
                {Object.entries(data.by_sector).sort((a, z) => z[1] - a[1]).map(([k, n]) => (
                  <li key={k} className="flex items-center justify-between text-[13px]"><span className="text-muted-foreground">{titleCase(k)}</span><span className="numeric font-medium">{n}</span></li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Activity + alerts */}
      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title="Recent cases" icon={BriefcaseBusiness} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-border/70 text-left text-xs text-muted-foreground"><th className="px-5 py-2.5 font-medium">Borrower</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 text-right font-medium">Amount</th><th className="px-3 py-2.5 text-right font-medium">Score</th><th className="px-5 py-2.5 text-right font-medium">Updated</th></tr></thead>
              <tbody className="divide-y divide-border/70">
                {data?.recent_cases.map((c) => (
                  <tr key={c.id} onClick={() => router.push(`/cases/${c.id}`)} className="cursor-pointer transition hover:bg-muted/40">
                    <td className="px-5 py-3"><p className="truncate font-medium">{c.company}</p><p className="font-mono text-xs text-muted-foreground">{c.reference}</p></td>
                    <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                    <td className="numeric px-3 py-3 text-right">{formatCr(c.amount)}</td>
                    <td className="px-3 py-3 text-right"><span className="numeric inline-flex min-w-[44px] justify-center rounded-lg px-2 py-0.5 text-sm font-semibold" style={{ color: toneHsl[scoreTone(c.score)], background: toneHsl[scoreTone(c.score)].replace(")", " / 0.1)") }}>{c.score ?? "—"}</span></td>
                    <td className="px-5 py-3 text-right text-xs text-muted-foreground">{relativeTime(c.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data && !data.recent_cases.length && <div className="p-5"><EmptyState compact icon={BriefcaseBusiness} title="No cases yet" action={can("analyst") && <Button onClick={() => setNewCase(true)}><Plus /> Open the first case</Button>} /></div>}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Forensic alerts" icon={ShieldAlert} bodyClassName="p-0">
            <ul className="divide-y divide-border/70">
              {data?.alerts.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link href={`/cases/${a.case_id}/fraud`} className="flex items-start gap-3 px-5 py-3 transition hover:bg-muted/40">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: toneHsl[severityTone(a.severity)] }} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px] font-medium leading-snug">{a.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.company}</p>
                    </div>
                    <ToneBadge tone={severityTone(a.severity)}>{a.severity}</ToneBadge>
                  </Link>
                </li>
              ))}
              {data && !data.alerts.length && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No high-severity alerts.</li>}
            </ul>
          </SectionCard>

          <SectionCard title="Activity" icon={History} bodyClassName="pt-1">
            <ol className="relative space-y-3 border-l border-border pl-4">
              {(activity ?? []).slice(0, 6).map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border-2 border-surface bg-primary" />
                  <p className="line-clamp-2 text-[13px] leading-snug">{e.summary ?? titleCase(e.action)}</p>
                  <p className={cn("mt-0.5 text-[11px] text-muted-foreground")}>{e.actor_email?.split("@")[0] ?? "system"} · {relativeTime(e.created_at)}</p>
                </li>
              ))}
              {activity && !activity.length && <li className="text-sm text-muted-foreground">No activity yet.</li>}
            </ol>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
