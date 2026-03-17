import { analyzeFilesLocally } from "./localIngestor";
import type { UploadMultipleResponse } from "./creditTypes";

export type {
  AnalysisHighlight,
  AnalysisSignal,
  ParseSummary,
  UploadedFileMeta,
  UploadMultipleResponse,
} from "./creditTypes";

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

  let response: Response;

  try {
    response = await fetch(`${API_BASE}/uploads/multiple`, {
      method: "POST",
      body: formData,
    });
  } catch {
    return analyzeFilesLocally({ files, companyId, documentType });
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as Record<string, unknown>;
      const detail =
        typeof payload.detail === "string"
          ? payload.detail
          : typeof payload.error === "string"
            ? payload.error
            : null;
      throw new Error(detail || `Upload failed with status ${response.status}`);
    }

    const message = await response.text();
    throw new Error(message || `Upload failed with status ${response.status}`);
  }

  const payload = (await response.json()) as UploadMultipleResponse;
  return {
    processing_mode: "backend",
    ...payload,
  };
}
