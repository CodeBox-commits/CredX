import type { StructuredExtraction, UploadedFileMeta } from "./creditTypes";

export type ResearchIntelligenceRequest = {
  company_name: string;
  sector?: string;
  promoter_names?: string[];
  analyst_note?: string | null;
  extracted?: StructuredExtraction | null;
};

export type ResearchSource = {
  source: string;
  detail: string;
};

export type ResearchFinding = {
  category: "promoter" | "litigation" | "sector" | "regulatory" | "sentiment";
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
};

export type ResearchIntelligenceResponse = {
  litigation_risk: "LOW" | "MEDIUM" | "HIGH";
  promoter_sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  sector_outlook: "FAVORABLE" | "STABLE" | "WEAK";
  summary: string;
  findings: ResearchFinding[];
  sources: ResearchSource[];
};

export type FraudAnalysisRequest = {
  company_name: string;
  extracted?: StructuredExtraction | null;
  gstr_2a_amount?: number | null;
  gstr_3b_amount?: number | null;
  declared_turnover?: number | null;
  bank_credits?: number | null;
  supplier_gstins?: string[];
  customer_gstins?: string[];
};

export type GraphNode = {
  id: string;
  label: string;
  type: string;
  risk: string;
};

export type GraphEdge = {
  source: string;
  target: string;
  label: string;
};

export type FraudAlert = {
  label: string;
  severity: "low" | "medium" | "high";
  detail: string;
};

export type FraudAnalysisResponse = {
  fraud_risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  suspicious_cycle_alerts: FraudAlert[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  summary: string;
};

export type UnderwritingRequest = {
  company_name: string;
  sector?: string;
  requested_amount?: number;
  analyst_note?: string | null;
  extracted?: StructuredExtraction | null;
  research?: ResearchIntelligenceResponse | null;
  fraud?: FraudAnalysisResponse | null;
};

export type DecisionFactor = {
  label: string;
  impact: "positive" | "negative";
  contribution: number;
  detail: string;
};

export type CreditDecisionResponse = {
  credit_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  approval_probability: number;
  recommended_loan_amount: number;
  suggested_interest_rate: number;
  decision: "APPROVE" | "CONDITIONAL APPROVAL" | "REJECT";
  top_risk_factors: string[];
  factors: DecisionFactor[];
  five_cs: Record<string, number>;
  pricing_rationale: string;
};

export type CamPreviewRequest = {
  company_name: string;
  sector?: string;
  requested_amount?: number;
  analyst_note?: string | null;
  extracted?: StructuredExtraction | null;
  research?: ResearchIntelligenceResponse | null;
  fraud?: FraudAnalysisResponse | null;
  decision?: CreditDecisionResponse | null;
};

export type CamSection = {
  title: string;
  content: string;
};

export type CamPreviewResponse = {
  sections: CamSection[];
  export_formats: string[];
  summary: string;
};

export type CopilotRequest = {
  question: string;
  context?: Record<string, unknown>;
};

export type CopilotResponse = {
  answer: string;
  provider: string;
  tokens_used: number;
};

export type PlatformAnalysisBundle = {
  extracted: StructuredExtraction | null;
  research: ResearchIntelligenceResponse | null;
  fraud: FraudAnalysisResponse | null;
  decision: CreditDecisionResponse | null;
  cam: CamPreviewResponse | null;
  documents: UploadedFileMeta[];
  synced_at: string;
};

export type PlatformAnalysisStatus =
  | "idle"
  | "syncing"
  | "synced"
  | "fallback"
  | "error";

export type PlatformAnalysisState = {
  status: PlatformAnalysisStatus;
  message: string | null;
  bundle: PlatformAnalysisBundle | null;
  updated_at: string | null;
};

export type PlatformAnalysisInput = {
  companyName: string;
  sector: string;
  requestedAmountCr: number;
  dueDiligenceNote: string;
  documents: UploadedFileMeta[];
  extracted: StructuredExtraction | null;
  promoterNames: string[];
  fraudInputs: Omit<FraudAnalysisRequest, "company_name" | "extracted">;
};
