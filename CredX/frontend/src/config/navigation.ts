import type { LucideIcon } from "lucide-react";
import {
  Bot,
  FileSearch,
  Globe2,
  Home,
  LayoutDashboard,
  ReceiptText,
  ShieldAlert,
} from "lucide-react";

export type WorkspaceRoute = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  end?: boolean;
};

export const workspaceRoutes: WorkspaceRoute[] = [
  {
    to: "/",
    label: "Home",
    description: "Platform overview and landing workspace",
    icon: Home,
    end: true,
  },
  {
    to: "/dashboard",
    label: "Command Center",
    description: "Portfolio snapshot, alerts, and decision trace",
    icon: LayoutDashboard,
  },
  {
    to: "/document-analyzer",
    label: "Ingestion",
    description: "Upload and parse underwriting evidence",
    icon: FileSearch,
  },
  {
    to: "/research",
    label: "Research",
    description: "Promoter, litigation, and sector intelligence",
    icon: Globe2,
  },
  {
    to: "/credit-risk",
    label: "Decisioning",
    description: "Score, explainability, and pricing outputs",
    icon: ShieldAlert,
  },
  {
    to: "/cam-generator",
    label: "CAM",
    description: "Committee-ready credit appraisal memo preview",
    icon: ReceiptText,
  },
  {
    to: "/copilot",
    label: "Copilot",
    description: "Context-aware underwriting assistant",
    icon: Bot,
  },
];
