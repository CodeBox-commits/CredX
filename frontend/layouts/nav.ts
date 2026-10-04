import { Activity, Bot, BriefcaseBusiness, LayoutDashboard, ShieldCheck, type LucideIcon } from "lucide-react";

import type { Role } from "@/types/api";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  shortcut: string;
  minRole?: Role;
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Command Center", icon: LayoutDashboard, description: "Portfolio, alerts and pipeline health", shortcut: "G D" },
  { href: "/cases", label: "Credit Cases", icon: BriefcaseBusiness, description: "Underwriting queue and case workspaces", shortcut: "G C" },
  { href: "/copilot", label: "AI Copilot", icon: Bot, description: "Ask questions across any case", shortcut: "G A" },
  { href: "/jobs", label: "Job Monitor", icon: Activity, description: "Async ingestion & analysis pipelines", shortcut: "G J" },
  { href: "/admin", label: "Governance", icon: ShieldCheck, description: "Users, audit trail, model & AI providers", shortcut: "G G", minRole: "credit_manager" },
];

export const CASE_TABS = [
  { slug: "", label: "Overview" },
  { slug: "documents", label: "Documents" },
  { slug: "financials", label: "Financials" },
  { slug: "research", label: "Research" },
  { slug: "fraud", label: "Fraud Graph" },
  { slug: "decision", label: "Decision" },
  { slug: "cam", label: "CAM" },
  { slug: "workspace", label: "Analyst Workspace" },
  { slug: "copilot", label: "Copilot" },
] as const;
