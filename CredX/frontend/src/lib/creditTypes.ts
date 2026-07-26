export type AnalysisSignal = {
  label: string;
  severity: "low" | "medium" | "high";
  detail: string;
  page_number?: number | null;
  excerpt?: string;
};

export type AnalysisHighlight = {
  title: string;
  detail: string;
  page_number?: number | null;
};

export type IngestionStep = {
  name: string;
  status: "pending" | "completed" | "failed" | "skipped";
  detail: string;
};

export type StructuredExtraction = {
  company_name?: string | null;
  cin?: string | null;
  gst_number?: string | null;
  pan?: string | null;
  document_type?: string | null;
  revenue?: number | null;
  ebitda?: number | null;
  operating_profit?: number | null;
  net_profit?: number | null;
  liabilities?: number | null;
  debt?: number | null;
  current_assets?: number | null;
  current_liabilities?: number | null;
  fixed_assets?: number | null;
  inventory?: number | null;
  cash?: number | null;
  net_worth?: number | null;
  total_assets?: number | null;
  interest_expense?: number | null;
  tax_expense?: number | null;
  loans?: number | null;
  creditors?: number | null;
  debtors?: number | null;
  directors?: string[];
  auditor?: string | null;
  financial_year?: string | null;
  risk_indicators?: string[];
  financial_health?: "STRONG" | "MODERATE" | "STRESSED" | "UNKNOWN";
  confidence_score?: number;
};

export type ParseSummary = {
  parsed: boolean;
  status: "parsed" | "skipped" | "failed";
  reason?: string;
  parser?: string;
  result_type?: string;
  page_count?: number;
  character_count?: number;
  artifact_path?: string;
  detected_document_type?: string;
  summary?: string;
  score?: number;
  risk_level?: "low" | "medium" | "high";
  signals?: AnalysisSignal[];
  highlights?: AnalysisHighlight[];
  structured_output?: StructuredExtraction | null;
  pipeline_steps?: IngestionStep[];
  validation_warnings?: string[];
  tables?: Array<Record<string, unknown>>;
  extraction_duration_ms?: number;
};

export type UploadedFileMeta = {
  document_id: string;
  company_id: string | null;
  document_type: string | null;
  original_filename: string;
  stored_filename: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number;
  uploaded_at: string;
  parse_summary: ParseSummary | null;
};

export type UploadMultipleResponse = {
  success: boolean;
  count: number;
  files: UploadedFileMeta[];
  processing_mode?: "backend" | "local";
  warning?: string;
};
