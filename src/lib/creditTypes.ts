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
