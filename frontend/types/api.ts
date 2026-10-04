// Contracts mirrored from backend/schemas and the JSON produced by the engines.

export type Role = "admin" | "credit_manager" | "analyst" | "viewer";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Decision = "APPROVE" | "APPROVE_WITH_CONDITIONS" | "REFER" | "DECLINE";
export type CaseStatus = "draft" | "ingesting" | "analyzing" | "in_review" | "escalated" | "approved" | "rejected";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  user: User;
}

export interface Promoter {
  name: string;
  din?: string | null;
  role?: string | null;
  shareholding_pct?: number | null;
}

export interface Company {
  id: string;
  name: string;
  cin: string | null;
  pan: string | null;
  gstin: string | null;
  sector: string | null;
  sub_sector: string | null;
  constitution: string | null;
  incorporation_year: number | null;
  city: string | null;
  state: string | null;
  website: string | null;
  promoters: Promoter[];
  external_rating: string | null;
  created_at: string;
}

export interface CreditCase {
  id: string;
  reference: string;
  company: Company;
  facility_type: string;
  requested_amount: number;
  tenure_months: number;
  purpose: string | null;
  collateral_type: string | null;
  collateral_value: number | null;
  status: CaseStatus;
  priority: string;
  latest_score: number | null;
  latest_risk_level: RiskLevel | null;
  latest_fraud_score: number | null;
  final_decision: Decision | null;
  decision_rationale: string | null;
  decided_at: string | null;
  is_demo: boolean;
  assigned_to: User | null;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Job {
  id: string;
  kind: "ingest_document" | "research" | "fraud" | "score" | "cam" | "full_analysis";
  case_id: string | null;
  document_id: string | null;
  status: JobStatus;
  progress: number;
  stage: string | null;
  message: string | null;
  steps: { key: string; label: string; status: "pending" | "running" | "done" }[];
  result: Record<string, unknown> | null;
  error: string | null;
  attempts: number;
  backend: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
}

export interface ExtractedField {
  value: number;
  confidence: number;
  method: string;
  page: number | null;
  snippet: string;
}

export interface RedFlag {
  label: string;
  severity: Severity;
  five_c: string;
  evidence: string;
  page: number | null;
  filename?: string;
}

export interface Extraction {
  company_name: string | null;
  doc_type: string;
  fiscal_years: string[];
  headline: {
    company_name: string | null;
    revenue: number | null;
    ebitda: number | null;
    pat: number | null;
    debt: number | null;
    gst_number: string | null;
    financial_health: "STRONG" | "MODERATE" | "WEAK" | "STRESSED";
  };
  classification: { type: string; confidence: number; signals: string[]; scores: Record<string, number> };
  identifiers: { gstins: string[]; pans: string[]; cins: string[]; dins: string[]; invalid_gstins: string[] };
  directors: { name: string; din: string | null }[];
  financials: Record<string, Record<string, ExtractedField>>;
  gst?: { returns: { return_type: string; turnover?: number; evidence: string }[]; mismatch_pct: number | null; itc_claimed: number | null; tax_paid: number | null; days_late: number | null };
  bank?: Record<string, any>;
  legal?: Record<string, any>;
  sanction?: Record<string, any>;
  shareholding?: Record<string, any>;
  mca?: Record<string, any>;
  red_flags: RedFlag[];
  positive_signals: string[];
  tables: { page: number; method: string; header: string[]; rows: string[][]; accuracy: number }[];
  pages: { number: number; method: string; confidence: number; chars: number }[];
  ocr_used: boolean;
  page_count: number;
  confidence: { overall: number; text: number; classification: number; fields: number | null };
  warnings: string[];
  stages: { name: string; status: string; ms: number; error?: string }[];
}

export interface DocumentRecord {
  id: string;
  case_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  declared_type: string | null;
  doc_type: string | null;
  classification_confidence: number | null;
  classification_signals: string[];
  status: "uploaded" | "processing" | "processed" | "failed";
  page_count: number | null;
  ocr_used: boolean;
  extraction_confidence: number | null;
  error: string | null;
  created_at: string;
}

export interface DocumentDetail extends DocumentRecord {
  extracted: Extraction;
  text_preview: string | null;
}

export interface Contribution {
  feature: string;
  label: string;
  value: number | null;
  display_value: string;
  points: number;
  points_exact: number;
  direction: "increases_risk" | "reduces_risk";
  description: string;
  five_c: string;
  missing: boolean;
}

export interface Overlay {
  source: "analyst_note" | "red_flag";
  label: string;
  points: number;
  rationale: string;
  five_c: string;
  reference_id: string | null;
}

export interface PolicyRule {
  id: string;
  name: string;
  kind: "knockout" | "deviation";
  threshold: string;
  actual: string | number | null;
  status: "pass" | "fail" | "na";
  guidance: string;
}

export interface FiveC {
  title: string;
  score: number;
  assessment: string;
  model_points: number;
  overlay_points: number;
  evidence: string[];
}

export interface RatioRow {
  fiscal_year: string;
  revenue: number | null;
  ebitda: number | null;
  pat: number | null;
  total_debt: number | null;
  net_worth: number | null;
  ebitda_margin: number | null;
  pat_margin: number | null;
  revenue_growth: number | null;
  debt_to_ebitda: number | null;
  debt_equity: number | null;
  interest_coverage: number | null;
  dscr: number | null;
  current_ratio: number | null;
  receivable_days: number | null;
  inventory_days: number | null;
  payable_days: number | null;
  [k: string]: number | string | null;
}

export interface Score {
  id: string;
  version: number;
  model_version: string;
  model_score: number;
  credit_score: number;
  probability_of_default: number;
  approval_probability: number;
  risk_level: RiskLevel;
  rating: string;
  decision: Decision;
  recommended_amount: number;
  suggested_rate: number;
  contributions: Contribution[];
  overlays: Overlay[];
  overlay_total: number;
  base_points: number;
  policy: { rules: PolicyRule[]; knockouts: PolicyRule[]; deviations: PolicyRule[]; passed: number; not_evaluable: number };
  five_cs: Record<string, FiveC>;
  loan_sizing: {
    requested_amount: number;
    recommended_amount: number;
    binding_constraint: string;
    methods: { method: string; limit: number; basis: string; binding: boolean }[];
    tenure_months: number;
  };
  pricing: { suggested_rate: number; spread_over_benchmark: number; grade: string; components: { component: string; bps: number; rationale: string }[] };
  ratios: { latest_year: string | null; latest: RatioRow; trend: RatioRow[] };
  top_risk_factors: string[];
  top_strengths: string[];
  decision_reasons: string[];
  conditions: string[];
  what_if: { feature: string; label: string; current: string; target: string; score_gain: number }[];
  features: { values: Record<string, number | null>; sources: Record<string, string> };
  model_metrics: Record<string, number>;
  created_at: string;
}

export interface ResearchFinding {
  category: "news" | "litigation" | "regulatory" | "mca" | "fraud" | "sector";
  title: string;
  snippet: string | null;
  source: string;
  url: string | null;
  severity: Severity;
  sentiment: number;
  provider: string;
  published_at: string | null;
}

export interface Research {
  id: string;
  litigation_risk: RiskLevel;
  promoter_sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  sector_outlook: "STRONG" | "STABLE" | "WEAK";
  overall_risk: RiskLevel;
  summary: string;
  summary_provider?: string;
  sentiment_score: number;
  litigation_score: number;
  sector: {
    name: string;
    risk: number;
    outlook: string;
    headwinds: string[];
    tailwinds: string[];
    rbi_context: string[];
    kb_version: string;
    benchmark_ebitda_margin?: number;
  };
  mca: {
    cin: string | null;
    cin_details: Record<string, any> | null;
    vintage_years: number | null;
    company_status: string;
    open_charges: { holder: string; amount: number | null; status: string }[];
    observations: { severity: Severity; text: string }[];
    directors: { name: string; din: string | null }[];
  } | null;
  findings: ResearchFinding[];
  litigation_cases: { source: string; types: string[]; title?: string; forum?: string; claim_amount?: number; status?: string; weight: number; borrower_is_claimant?: boolean }[];
  providers: string[];
  queries: string[];
  created_at: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "borrower" | "company" | "person";
  risk: number;
  flagged: boolean;
  size: number;
  meta: Record<string, string>;
}

export interface GraphLink {
  source: string;
  target: string;
  type: "PAYS" | "INVOICES" | "DIRECTOR_OF";
  amount: number | null;
  count: number | null;
  flagged: boolean;
}

export interface FraudAlert {
  id: string;
  alert_type: string;
  severity: Severity;
  title: string;
  description: string;
  entities: string[];
  evidence: Record<string, any>;
  score_impact: number;
  status: "open" | "confirmed" | "dismissed";
}

export interface Fraud {
  id: string;
  fraud_score: number;
  risk_level: RiskLevel;
  summary: string;
  graph: { nodes: GraphNode[]; links: GraphLink[]; borrower_id: string };
  heatmap: ({ entity: string; id: string } & Record<string, number | string>)[];
  gst_checks: { check: string; status: "pass" | "warn" | "fail" | "na"; detail: string; value: number | null; score_impact: number }[];
  alerts: FraudAlert[];
  stats: Record<string, number>;
  created_at: string;
}

export interface CamSection {
  id: string;
  title: string;
  kind: "decision" | "kv" | "table" | "text" | "bullets" | "five_cs";
  content: any;
  analyst_comment: string;
  note?: string;
  secondary?: { header: string[]; rows: string[][] } | null;
}

export interface Cam {
  id: string;
  version: number;
  status: string;
  sections: CamSection[];
  analyst_comments: Record<string, string>;
  narrative_provider: string | null;
  created_at: string;
  versions: number[];
}

export interface Note {
  id: string;
  case_id: string;
  parent_id: string | null;
  kind: "note" | "comment";
  category: string;
  body: string;
  impact_points: number | null;
  inferred_impact: number | null;
  impact_rationale: string | null;
  five_c: string | null;
  include_in_cam: boolean;
  pinned: boolean;
  author: User | null;
  created_at: string;
  preview_impact: number | null;
  preview_rationale: string | null;
}

export interface Override {
  id: string;
  case_id: string;
  field: string;
  original_value: string | null;
  new_value: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_by: User | null;
  reviewed_by: User | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
}

export interface Escalation {
  id: string;
  case_id: string;
  to_role: string;
  reason: string;
  status: "open" | "resolved";
  resolution: string | null;
  raised_by: User | null;
  resolved_by: User | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  case_id: string | null;
  summary: string | null;
  details: Record<string, unknown>;
  request_id: string | null;
}

export interface CaseOverview {
  company: Company;
  case: Record<string, any>;
  case_record: CreditCase;
  score: Score | null;
  research: Research | null;
  fraud: { fraud_score: number; risk_level: RiskLevel; summary: string; alerts: Omit<FraudAlert, "id" | "entities" | "evidence" | "score_impact">[]; gst_checks: Fraud["gst_checks"] } | null;
  facts: {
    bank: Record<string, any>[];
    gst: Record<string, any>[];
    legal: Record<string, any>[];
    documents: { id: string; filename: string; doc_type: string; confidence: number }[];
    red_flags: RedFlag[];
    positive_signals: string[];
    shareholding: Record<string, any> | null;
  };
  notes: { id: string; body: string; effective_impact: number | null; category: string; author: string | null; created_at: string }[];
  active_jobs: Job[];
  financials: Record<string, Record<string, number>>;
  latest_cam_version: number;
}

export interface ChatReply {
  answer: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  fallback_used: boolean;
  message_id: string;
}

export interface TimelineEvent {
  type: "audit" | "note" | "job";
  at: string;
  actor: string | null;
  action: string;
  summary: string | null;
}

export interface DashboardSummary {
  totals: {
    cases: number;
    scored: number;
    avg_score: number | null;
    requested_exposure: number;
    approved: number;
    in_review: number;
    escalated: number;
    high_fraud: number;
    companies: number;
  };
  by_status: Record<string, number>;
  by_risk: Record<string, number>;
  by_sector: Record<string, number>;
  score_distribution: { reference: string; company: string; score: number; fraud: number | null; amount: number; risk: RiskLevel }[];
  recent_cases: { id: string; reference: string; company: string; status: CaseStatus; score: number | null; risk: RiskLevel | null; amount: number; updated_at: string }[];
  alerts: { id: string; case_id: string; company: string; title: string; severity: Severity; alert_type: string }[];
  ai_usage: { provider: string; input_tokens: number; output_tokens: number; calls: number }[];
  active_jobs: number;
}

export interface FinancialsResponse {
  statements: {
    fiscal_year: string;
    source: string;
    confidence: number | null;
    values: Record<string, number | null>;
    provenance: Record<string, { filename?: string; page?: number; snippet?: string; confidence: number; method?: string; by?: string }>;
  }[];
  ratios: Score["ratios"];
}
