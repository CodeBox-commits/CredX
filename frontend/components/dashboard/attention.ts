import { FileUp, Gavel, ShieldAlert, Users } from "lucide-react";

import type { CreditCase, DashboardSummary } from "@/types/api";

export interface AttentionItem {
  key: string;
  icon: typeof Gavel;
  tone: "destructive" | "warning" | "primary" | "muted";
  title: string;
  reason: string;
  cta: string;
  href: string;
  rank: number;
}

export function attentionItems(cases: CreditCase[], alerts: DashboardSummary["alerts"]): AttentionItem[] {
  const items: AttentionItem[] = [];
  const critical = new Set(alerts.filter((a) => a.severity === "CRITICAL").map((a) => a.case_id));
  for (const c of cases) {
    const name = c.company.name.replace(/ (Private )?Limited$/, "");
    if (critical.has(c.id)) {
      items.push({ key: `${c.id}-fraud`, icon: ShieldAlert, tone: "destructive", title: name, reason: `Critical fraud signal · fraud score ${c.latest_fraud_score}/100`, cta: "Open fraud graph", href: `/cases/${c.id}/fraud`, rank: 0 });
    }
    if (c.status === "escalated") {
      items.push({ key: `${c.id}-esc`, icon: Users, tone: "warning", title: name, reason: "Escalated — awaiting credit committee", cta: "Review case", href: `/cases/${c.id}/decision`, rank: 1 });
    } else if (c.status === "in_review" && c.latest_score && !c.final_decision) {
      items.push({ key: `${c.id}-dec`, icon: Gavel, tone: "primary", title: name, reason: `Scored ${c.latest_score} · ready for a decision`, cta: "Decide", href: `/cases/${c.id}/decision`, rank: 2 });
    } else if (c.status === "draft") {
      items.push({ key: `${c.id}-docs`, icon: FileUp, tone: "muted", title: name, reason: "No documents yet — upload to start analysis", cta: "Upload", href: `/cases/${c.id}/documents`, rank: 3 });
    }
  }
  return items.sort((a, z) => a.rank - z.rank).slice(0, 6);
}
