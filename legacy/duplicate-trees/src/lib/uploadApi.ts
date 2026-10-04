export type ParseSummary = {
  parsed: boolean;
  status: "parsed" | "skipped" | "failed";
  reason?: string;
  parser?: string;
  result_type?: string;
  page_count?: number;
  character_count?: number;
  artifact_path?: string;
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

type UploadMultipleResponse = {
  success: boolean;
  count: number;
  files: UploadedFileMeta[];
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export async function uploadMultipleFiles(params: {
  files: File[];
  companyId?: string;
  documentType?: string;
}): Promise<UploadMultipleResponse> {
  const { files, companyId, documentType } = params;
  const formData = new FormData();

  files.forEach((file) => formData.append("files", file));
  if (companyId) formData.append("company_id", companyId);
  if (documentType) formData.append("document_type", documentType);

  const response = await fetch(`${API_BASE}/uploads/multiple`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Upload failed with status ${response.status}`);
  }

  return response.json() as Promise<UploadMultipleResponse>;
}
