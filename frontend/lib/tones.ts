// Semantic colour mapping shared by badges, charts and the graph.

export type Tone = "success" | "warning" | "destructive" | "primary" | "muted" | "accent";

export const riskTone = (risk?: string | null): Tone =>
  ({ LOW: "success", MEDIUM: "warning", HIGH: "destructive", CRITICAL: "destructive" } as Record<string, Tone>)[risk ?? ""] ?? "muted";

export const severityTone = riskTone;

export const decisionTone = (d?: string | null): Tone =>
  ({ APPROVE: "success", APPROVE_WITH_CONDITIONS: "success", REFER: "warning", DECLINE: "destructive" } as Record<string, Tone>)[d ?? ""] ??
  "muted";

export const statusTone = (s?: string | null): Tone =>
  ({
    draft: "muted", ingesting: "primary", analyzing: "primary", in_review: "accent", escalated: "warning",
    approved: "success", rejected: "destructive", queued: "muted", running: "primary", succeeded: "success",
    failed: "destructive", processed: "success", processing: "primary", uploaded: "muted",
    pass: "success", warn: "warning", fail: "destructive", na: "muted",
    POSITIVE: "success", NEUTRAL: "muted", NEGATIVE: "destructive", STRONG: "success", STABLE: "primary", WEAK: "warning",
  } as Record<string, Tone>)[s ?? ""] ?? "muted";

export const toneClasses: Record<Tone, string> = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/12 text-warning border-warning/30",
  destructive: "bg-destructive/12 text-destructive border-destructive/25",
  primary: "bg-primary/10 text-primary border-primary/25",
  accent: "bg-accent/12 text-accent border-accent/30",
  muted: "bg-muted text-muted-foreground border-border",
};

export const toneHsl: Record<Tone, string> = {
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  muted: "hsl(var(--muted-foreground))",
};

export const scoreTone = (score?: number | null): Tone =>
  score == null ? "muted" : score >= 760 ? "success" : score >= 680 ? "primary" : score >= 600 ? "warning" : "destructive";
