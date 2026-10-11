import {
  Activity, Bot, BriefcaseBusiness, FileStack, Gavel, LayoutDashboard, LayoutGrid, LineChart, Radar, ReceiptText, ShieldCheck,
  Users, type LucideIcon,
} from "lucide-react";

import type { CaseOverview, Role } from "@/types/api";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  shortcut: string;
  minRole?: Role;
}

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Underwriting",
    items: [
      { href: "/dashboard", label: "Home", icon: LayoutDashboard, description: "Your queue, portfolio health and alerts", shortcut: "G H" },
      { href: "/cases", label: "Cases", icon: BriefcaseBusiness, description: "Every credit application and its stage", shortcut: "G C" },
      { href: "/copilot", label: "AI Copilot", icon: Bot, description: "Ask questions across the portfolio", shortcut: "G A" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/jobs", label: "Pipelines", icon: Activity, description: "Live ingestion & analysis jobs", shortcut: "G J" },
      { href: "/admin", label: "Governance", icon: ShieldCheck, description: "Users, audit trail, model & AI providers", shortcut: "G G", minRole: "credit_manager" },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export type StageKey = "documents" | "financials" | "intelligence" | "decision" | "cam";
export type StageState = "done" | "active" | "ready" | "blocked" | "attention";

export interface CaseStage {
  key: StageKey;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Route slugs that belong to this stage (first one is the landing page). */
  slugs: string[];
  description: string;
}

export const CASE_STAGES: CaseStage[] = [
  { key: "documents", label: "Documents", short: "Docs", icon: FileStack, slugs: ["documents"], description: "Upload & AI extraction" },
  { key: "financials", label: "Financials", short: "Financials", icon: LineChart, slugs: ["financials"], description: "Spreads, ratios & trends" },
  { key: "intelligence", label: "Intelligence", short: "Intel", icon: Radar, slugs: ["research", "fraud"], description: "Research & fraud graph" },
  { key: "decision", label: "Decision", short: "Decision", icon: Gavel, slugs: ["decision"], description: "Score, drivers & pricing" },
  { key: "cam", label: "CAM", short: "CAM", icon: ReceiptText, slugs: ["cam"], description: "Credit appraisal memo" },
];

export const CASE_EXTRA = [
  { slug: "", label: "Overview", icon: LayoutGrid },
  { slug: "workspace", label: "Workspace", icon: Users },
] as const;

/** Flat list for the command palette. */
export const CASE_TABS = [
  { slug: "", label: "Overview" },
  { slug: "documents", label: "Documents" },
  { slug: "financials", label: "Financials" },
  { slug: "research", label: "Research" },
  { slug: "fraud", label: "Fraud graph" },
  { slug: "decision", label: "Decision" },
  { slug: "cam", label: "CAM" },
  { slug: "workspace", label: "Analyst workspace" },
] as const;

/** Derive each stage's state from the case overview so the stepper always reflects reality. */
export function stageStates(o: CaseOverview | undefined): Record<StageKey, StageState> {
  if (!o) return { documents: "ready", financials: "blocked", intelligence: "blocked", decision: "blocked", cam: "blocked" };
  const kinds = new Set(o.active_jobs.map((j) => j.kind));
  const analysing = kinds.has("full_analysis");
  const hasDocs = o.facts.documents.length > 0;
  const hasFin = Object.keys(o.financials ?? {}).length > 0;
  const hasIntel = !!o.research && !!o.fraud;
  const decided = !!o.case_record.final_decision;
  const fraudHot = (o.fraud?.fraud_score ?? 0) >= 50;
  return {
    documents: kinds.has("ingest_document") ? "active" : hasDocs ? "done" : "ready",
    financials: analysing && !hasFin ? "active" : hasFin ? "done" : hasDocs ? "ready" : "blocked",
    intelligence: analysing && !hasIntel ? "active" : hasIntel ? (fraudHot ? "attention" : "done") : hasDocs ? "ready" : "blocked",
    decision: kinds.has("score") ? "active" : decided ? "done" : o.score ? "ready" : "blocked",
    cam: kinds.has("cam") ? "active" : o.latest_cam_version > 0 ? "done" : o.score ? "ready" : "blocked",
  };
}
