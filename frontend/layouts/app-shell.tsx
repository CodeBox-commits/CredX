"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, ChevronsLeft, LogOut, Moon, Plus, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect } from "react";

import { NewCaseDialog } from "@/components/case/new-case-dialog";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useJobs } from "@/hooks/queries";
import { useHotkey } from "@/hooks/use-hotkeys";
import { cn } from "@/lib/utils";
import { roleLabel, useAuth } from "@/store/auth";
import { useUi } from "@/store/ui";

import { CommandPalette } from "./command-palette";
import { NAV } from "./nav";

function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed: collapsed, toggleSidebar } = useUi();
  const can = useAuth((s) => s.can);
  return (
    <aside className={cn("no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border/70 bg-surface/80 backdrop-blur md:flex", collapsed ? "w-[68px]" : "w-[232px]")}>
      <div className="flex h-14 items-center gap-2 px-4">
        <Link href="/dashboard" className="flex items-center gap-2" aria-label="CredX home"><Logo compact={collapsed} /></Link>
      </div>
      <nav className="flex-1 space-y-1 px-2.5 py-2" aria-label="Primary">
        {NAV.filter((n) => !n.minRole || can(n.minRole)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Tooltip key={item.href} open={collapsed ? undefined : false}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    active && "bg-primary/10 text-foreground",
                  )}
                >
                  {active && <motion.span layoutId="nav-pill" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary" />}
                  <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
      <div className="border-t border-border/70 p-2.5">
        <button onClick={toggleSidebar} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted" aria-label="Toggle sidebar">
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}

function Topbar() {
  const { theme, setTheme } = useTheme();
  const { setPalette, setNewCase } = useUi();
  const { user, logout, can } = useAuth();
  const router = useRouter();
  const { data: jobs } = useJobs({ status: "queued,running" });
  const active = jobs?.length ?? 0;
  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="md:hidden"><Logo compact /></div>
      <button
        onClick={() => setPalette(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border/80 bg-muted/50 px-3 text-sm text-muted-foreground transition hover:border-primary/40"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span className="truncate">Search cases, jump to pages, run actions…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 font-mono text-[10px] sm:block">⌘K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/jobs" className="relative flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-muted" aria-label={`${active} active jobs`}>
              <Activity className={cn("h-4 w-4", active && "text-primary")} />
              <AnimatePresence>
                {active > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="numeric rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {active}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Background jobs</TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </Button>
        {can("analyst") && (
          <Button size="sm" className="hidden gap-1.5 sm:inline-flex" onClick={() => setNewCase(true)}>
            <Plus className="h-4 w-4" /> New case
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-5 text-xs font-semibold text-primary-foreground" aria-label="Account menu">
              {user?.full_name?.split(" ").map((p) => p[0]).slice(0, 2).join("") ?? "?"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { token, hydrated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const setPalette = useUi((s) => s.setPalette);
  useHotkey("mod+k", () => setPalette(true));

  useEffect(() => {
    if (hydrated && !token) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, token, router, pathname]);

  if (!hydrated || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
    );
  }
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" className="terminal-grid min-w-0 flex-1 bg-[length:32px_32px]">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>
      <CommandPalette />
      <NewCaseDialog />
    </div>
  );
}
