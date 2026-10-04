"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Moon, Play, Plus, Sparkles } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { toast } from "sonner";

import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { RiskBadge } from "@/components/common/primitives";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";
import { useUi } from "@/store/ui";

import { CASE_TABS, NAV } from "./nav";

export function CommandPalette() {
  const { paletteOpen, setPalette, setNewCase } = useUi();
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const { theme, setTheme } = useTheme();
  const can = useAuth((s) => s.can);
  const { data } = useQuery({ queryKey: ["cases", { palette: true }], queryFn: () => api.cases.list({ limit: 50 }), enabled: paletteOpen });

  // "g d" / "g c" style two-key navigation.
  useEffect(() => {
    let pending = false;
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || e.metaKey || e.ctrlKey) return;
      if (e.key === "g") {
        pending = true;
        clearTimeout(timer);
        timer = setTimeout(() => (pending = false), 900);
        return;
      }
      if (pending) {
        const item = NAV.find((n) => n.shortcut.split(" ")[1].toLowerCase() === e.key.toLowerCase());
        if (item) router.push(item.href);
        pending = false;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const go = (href: string) => {
    setPalette(false);
    router.push(href);
  };

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPalette}>
      <CommandInput placeholder="Type a company, case reference or command…" />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No results.</CommandEmpty>
        {params?.id && (
          <CommandGroup heading="This case">
            {CASE_TABS.map((t) => (
              <CommandItem key={t.slug} value={`case tab ${t.label}`} onSelect={() => go(`/cases/${params.id}${t.slug ? `/${t.slug}` : ""}`)}>
                <FileText className="mr-2 h-4 w-4" /> {t.label}
              </CommandItem>
            ))}
            {can("analyst") && (
              <CommandItem value="run full analysis" onSelect={async () => {
                setPalette(false);
                await api.cases.analyze(params.id!);
                toast.message("Full analysis started");
              }}>
                <Play className="mr-2 h-4 w-4" /> Run full analysis
              </CommandItem>
            )}
          </CommandGroup>
        )}
        <CommandGroup heading="Navigate">
          {NAV.filter((n) => !n.minRole || can(n.minRole)).map((n) => (
            <CommandItem key={n.href} value={`${n.label} ${n.description}`} onSelect={() => go(n.href)}>
              <n.icon className="mr-2 h-4 w-4" /> {n.label}
              <CommandShortcut>{n.shortcut}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Cases">
          {data?.items.map((c) => (
            <CommandItem key={c.id} value={`${c.company.name} ${c.reference} ${c.company.gstin ?? ""}`} onSelect={() => go(`/cases/${c.id}`)}>
              <span className="truncate">{c.company.name}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">{c.reference}</span>
              <span className="ml-auto"><RiskBadge risk={c.latest_risk_level} /></span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          {can("analyst") && (
            <CommandItem value="new credit case" onSelect={() => { setPalette(false); setNewCase(true); }}>
              <Plus className="mr-2 h-4 w-4" /> New credit case
            </CommandItem>
          )}
          <CommandItem value="ask copilot" onSelect={() => go("/copilot")}>
            <Sparkles className="mr-2 h-4 w-4" /> Ask the AI copilot
          </CommandItem>
          <CommandItem value="toggle theme dark light" onSelect={() => { setTheme(theme === "dark" ? "light" : "dark"); setPalette(false); }}>
            <Moon className="mr-2 h-4 w-4" /> Toggle dark / light theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
