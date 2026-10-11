"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, FlaskConical, Loader2, LogOut, Menu, Monitor, Moon, Plus, Search, Sun,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";

import { NewCaseDialog } from "@/components/case/new-case-dialog";
import { Logo } from "@/components/common/logo";
import { GrowBar } from "@/components/common/motion";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { jobLabel, qk, useCases, useJobs } from "@/hooks/queries";
import { useHotkey } from "@/hooks/use-hotkeys";
import { relativeTime } from "@/lib/format";
import { scoreTone, toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { DEMO_MODE } from "@/services/client";
import { roleLabel, useAuth } from "@/store/auth";
import { useUi } from "@/store/ui";

import { CommandPalette } from "./command-palette";
import { NAV } from "./nav";

function initials(name?: string | null) {
  return name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ?? "?";
}

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Primary navigation as horizontal tabs with a sliding active pill. */
function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const can = useAuth((s) => s.can);
  const { data: cases } = useCases();
  const recent = (cases?.items ?? []).slice(0, 6);
  return (
    <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
      {NAV.filter((n) => !n.minRole || can(n.minRole)).map((item) => {
        const active = isActive(pathname, item.href);
        const base = cn("relative flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium transition-colors xl:px-3", active ? "text-foreground" : "text-muted-foreground hover:text-foreground");
        const pill = active && <motion.span layoutId="topnav-active" className="absolute inset-0 rounded-lg bg-muted" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />;
        if (item.href === "/cases") {
          return (
            <DropdownMenu key={item.href}>
              <div className="flex items-center">
                <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(base, "rounded-r-none pr-1.5")}>
                  {pill}
                  <item.icon className={cn("relative h-4 w-4", active && "text-primary")} />
                  <span className="relative">{item.label}</span>
                  {cases && <span className="numeric relative rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{cases.total}</span>}
                </Link>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-9 items-center rounded-r-lg px-1 text-muted-foreground transition hover:text-foreground" aria-label="Recent cases">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
              </div>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Recent cases</DropdownMenuLabel>
                {recent.map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => router.push(`/cases/${c.id}`)} className="gap-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: toneHsl[scoreTone(c.latest_score)] }} />
                    <span className="min-w-0 flex-1 truncate">{c.company.name.replace(/ (Private )?Limited$/, "")}</span>
                    <span className="numeric text-xs text-muted-foreground">{c.latest_score ?? "—"}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/cases")}>View all cases</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={base}>
            {pill}
            <item.icon className={cn("relative h-4 w-4", active && "text-primary")} />
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const can = useAuth((s) => s.can);
  const setNewCase = useUi((s) => s.setNewCase);
  const { data: cases } = useCases();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-4"><Logo /></div>
      {can("analyst") && <div className="px-3 pb-3"><Button className="w-full" onClick={() => { setNewCase(true); onNavigate(); }}><Plus /> New case</Button></div>}
      <nav className="space-y-0.5 px-3" aria-label="Primary">
        {NAV.filter((n) => !n.minRole || can(n.minRole)).map((item) => (
          <Link key={item.href} href={item.href} onClick={onNavigate}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition", isActive(pathname, item.href) ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <item.icon className="h-4 w-4" />{item.label}
          </Link>
        ))}
      </nav>
      {!!cases?.items.length && (
        <div className="mt-5 px-3">
          <p className="label mb-1.5 px-3">Recent cases</p>
          {cases.items.slice(0, 5).map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} onClick={onNavigate} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: toneHsl[scoreTone(c.latest_score)] }} />
              <span className="truncate">{c.company.name.replace(/ (Private )?Limited$/, "")}</span>
              <span className="numeric ml-auto text-[11px]">{c.latest_score ?? "—"}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const { data: c } = useQuery({ queryKey: qk.case(params?.id ?? ""), queryFn: () => api.cases.get(params!.id!), enabled: !!params?.id });
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const labels: Record<string, string> = { dashboard: "Home", cases: "Cases", copilot: "AI Copilot", jobs: "Pipelines", admin: "Governance", documents: "Documents", financials: "Financials", research: "Research", fraud: "Fraud graph", decision: "Decision", cam: "CAM", workspace: "Workspace" };
  const crumbs = parts.map((p, i) => ({
    href: `/${parts.slice(0, i + 1).join("/")}`,
    label: p === params?.id ? (c?.company.name.replace(/ (Private )?Limited$/, "") ?? "…") : labels[p] ?? p,
  }));
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex min-w-0 items-center gap-1 text-[13px]">
      {crumbs.map((cr, i) => (
        <span key={cr.href} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
          {i === crumbs.length - 1
            ? <span className="truncate font-medium">{cr.label}</span>
            : <Link href={cr.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">{cr.label}</Link>}
        </span>
      ))}
    </nav>
  );
}

function JobsPopover() {
  const { data: running } = useJobs({ status: "queued,running" });
  const { data: recent } = useJobs({}, false);
  const active = running?.length ?? 0;
  const list = [...(running ?? []), ...(recent ?? []).filter((j) => !running?.some((r) => r.id === j.id))].slice(0, 6);
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="relative gap-1.5" aria-label={`${active} running jobs`}>
              {active ? <Loader2 className="animate-spin text-primary" /> : <Activity />}
              <AnimatePresence>
                {active > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="numeric rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{active}</motion.span>
                )}
              </AnimatePresence>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Background jobs</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Pipelines</p>
          <Link href="/jobs" className="text-xs text-primary hover:underline">Open monitor</Link>
        </div>
        <ul className="max-h-[360px] divide-y divide-border overflow-y-auto">
          {list.map((j) => (
            <li key={j.id} className="px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                {j.status === "succeeded" ? <CheckCircle2 className="h-4 w-4 text-success" /> : j.status === "failed" ? <CircleAlert className="h-4 w-4 text-destructive" /> : <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                <span className="font-medium">{jobLabel(j.kind)}</span>
                <span className="ml-auto text-xs text-muted-foreground">{relativeTime(j.created_at)}</span>
              </div>
              {(j.status === "running" || j.status === "queued") && (
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><GrowBar pct={j.progress} duration={500} className="rounded-full bg-primary" /></div>
                  <p className="mt-1 text-xs text-muted-foreground">{j.message ?? j.stage}</p>
                </div>
              )}
            </li>
          ))}
          {!list.length && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No pipeline activity yet.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** "Live" pulse with seconds since the workspace last synced with the API. */
function LiveIndicator() {
  const { dataUpdatedAt } = useQuery({ queryKey: qk.dashboard, queryFn: api.dashboard, refetchInterval: 15_000 });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ago = dataUpdatedAt ? Math.max(0, Math.round((now - dataUpdatedAt) / 1000)) : null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="hidden h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground lg:inline-flex" aria-label="Live sync status">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-success" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Live
        </span>
      </TooltipTrigger>
      <TooltipContent>{ago === null ? "Connecting…" : `Synced ${ago < 2 ? "just now" : `${ago}s ago`} · refreshes every 15s`}</TooltipContent>
    </Tooltip>
  );
}

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = !mounted ? Sun : theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Theme: ${theme}. Switch to ${next}`} onClick={() => setTheme(next)}><Icon /></Button>
      </TooltipTrigger>
      <TooltipContent>Theme: {mounted ? theme : "light"}</TooltipContent>
    </Tooltip>
  );
}

function Header({ onMenu }: { onMenu: () => void }) {
  const { setPalette, setNewCase } = useUi();
  const { user, logout, can } = useAuth();
  const router = useRouter();
  return (
    <header className="no-print sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 md:px-6 xl:gap-4 xl:px-8">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation"><Menu /></Button>
        <Link href="/dashboard" aria-label="CredX home" className="shrink-0"><Logo compact className="xl:hidden" /><Logo className="hidden xl:flex" /></Link>
        <span className="hidden h-6 w-px bg-border lg:block" />
        <TopNav />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button onClick={() => setPalette(true)} aria-label="Search (Ctrl+K)"
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-sm text-muted-foreground shadow-[0_1px_2px_hsl(var(--shadow-color)/0.04)] transition hover:border-foreground/20 hover:text-foreground 2xl:w-56 2xl:px-3">
            <Search className="h-4 w-4" />
            <span className="hidden 2xl:inline">Search…</span>
            <span className="ml-auto hidden items-center gap-0.5 2xl:flex"><span className="kbd">Ctrl</span><span className="kbd">K</span></span>
          </button>
          {DEMO_MODE && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="hidden items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent xl:inline-flex"><FlaskConical className="h-3 w-3" />Demo</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">Fictional borrowers served from an in-browser mock API.</TooltipContent>
            </Tooltip>
          )}
          <LiveIndicator />
          <JobsPopover />
          <ThemeSwitch />
          {can("analyst") && (
            <Button className="hidden px-2.5 md:inline-flex xl:px-3.5" onClick={() => setNewCase(true)} aria-label="New case"><Plus /><span className="hidden xl:inline">New case</span></Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-semibold text-white ring-offset-background transition hover:ring-2 hover:ring-primary/30 hover:ring-offset-2" aria-label="Account menu">
                {initials(user?.full_name)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <p className="truncate text-sm">{user?.full_name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{user?.email} · {roleLabel(user?.role)}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { logout(); router.push("/login"); }}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { token, hydrated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { setPalette, setNewCase } = useUi();
  const [mobileOpen, setMobileOpen] = useState(false);
  const can = useAuth((s) => s.can);
  useHotkey("mod+k", () => setPalette(true));
  useHotkey("n", () => can("analyst") && setNewCase(true));

  // One document-level listener powers the cursor spotlight on every panel (see .panel::before).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(".panel") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
      el.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    if (hydrated && !token) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, token, router, pathname]);

  if (!hydrated || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3">
        <Logo compact className="animate-pulse" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <Header onMenu={() => setMobileOpen(true)} />
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] bg-surface-2 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <MobileNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <main id="main" className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden" aria-hidden><div className="animate-aurora absolute inset-0 bg-aurora opacity-70" /></div>
        <motion.div key={pathname.split("/").slice(0, 3).join("/")} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
          <Breadcrumbs />
          {children}
        </motion.div>
      </main>
      <CommandPalette />
      <NewCaseDialog />
    </div>
  );
}
