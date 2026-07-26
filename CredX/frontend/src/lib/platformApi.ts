import type {
  CamPreviewRequest,
  CamPreviewResponse,
  CaseDashboardSummary,
  CaseSyncRequest,
  CaseSyncResponse,
  CopilotRequest,
  CopilotResponse,
  CreditDecisionResponse,
  FraudAnalysisRequest,
  FraudAnalysisResponse,
  PersistedCaseDetail,
  PersistedCaseSummary,
  PlatformAnalysisBundle,
  PlatformAnalysisInput,
  ResearchIntelligenceRequest,
  ResearchIntelligenceResponse,
  UnderwritingRequest,
  WorkflowJobRecord,
} from "./platformTypes";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

async function postJson<TResponse>(
  path: string,
  payload: unknown,
): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("CredX could not reach the platform API.");
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as Record<string, unknown>;
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : typeof data.error === "string"
            ? data.error
            : null;
      throw new Error(detail || `Request failed with status ${response.status}.`);
    }

    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}.`);
  }

  return (await response.json()) as TResponse;
}

async function getJson<TResponse>(path: string): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`);
  } catch {
    throw new Error("CredX could not reach the platform API.");
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}.`);
  }

  return (await response.json()) as TResponse;
}

export function requestResearchIntelligence(
  payload: ResearchIntelligenceRequest,
): Promise<ResearchIntelligenceResponse> {
  return postJson<ResearchIntelligenceResponse>(
    "/research/intelligence",
    payload,
  );
}

export function requestFraudAnalysis(
  payload: FraudAnalysisRequest,
): Promise<FraudAnalysisResponse> {
  return postJson<FraudAnalysisResponse>("/fraud/analyze", payload);
}

export function requestCreditDecision(
  payload: UnderwritingRequest,
): Promise<CreditDecisionResponse> {
  return postJson<CreditDecisionResponse>("/underwriting/score", payload);
}

export function requestCamPreview(
  payload: CamPreviewRequest,
): Promise<CamPreviewResponse> {
  return postJson<CamPreviewResponse>("/cam/preview", payload);
}

export function requestCopilotResponse(
  payload: CopilotRequest,
): Promise<CopilotResponse> {
  return postJson<CopilotResponse>("/copilot/chat", payload);
}

export function syncPersistedCase(
  payload: CaseSyncRequest,
): Promise<CaseSyncResponse> {
  return postJson<CaseSyncResponse>("/cases/sync", payload);
}

export function requestCaseList(
  limit = 12,
): Promise<PersistedCaseSummary[]> {
  return getJson<PersistedCaseSummary[]>(`/cases?limit=${limit}`);
}

export function requestDashboardSummary(
  limit = 10,
): Promise<CaseDashboardSummary> {
  return getJson<CaseDashboardSummary>(`/cases/dashboard-summary?limit=${limit}`);
}

export function requestCaseDetail(
  caseId: string,
): Promise<PersistedCaseDetail> {
  return getJson<PersistedCaseDetail>(`/cases/${caseId}`);
}

export function requestWorkflowJobs(
  caseId?: string,
): Promise<WorkflowJobRecord[]> {
  const query = caseId ? `?case_id=${caseId}` : "";
  return getJson<WorkflowJobRecord[]>(`/jobs${query}`);
}

export async function runPlatformAnalysis(
  input: PlatformAnalysisInput,
): Promise<PlatformAnalysisBundle> {
  const research = await requestResearchIntelligence({
    company_name: input.companyName,
    sector: input.sector,
    promoter_names: input.promoterNames,
    analyst_note: input.dueDiligenceNote || null,
    extracted: input.extracted,
  });

  const fraud = await requestFraudAnalysis({
    company_name: input.companyName,
    extracted: input.extracted,
    ...input.fraudInputs,
  });

  const decision = await requestCreditDecision({
    company_name: input.companyName,
    sector: input.sector,
    requested_amount: input.requestedAmountCr,
    analyst_note: input.dueDiligenceNote || null,
    extracted: input.extracted,
    research,
    fraud,
  });

  const cam = await requestCamPreview({
    company_name: input.companyName,
    sector: input.sector,
    requested_amount: input.requestedAmountCr,
    analyst_note: input.dueDiligenceNote || null,
    extracted: input.extracted,
    research,
    fraud,
    decision,
  });

  return {
    extracted: input.extracted,
    research,
    fraud,
    decision,
    cam,
    documents: input.documents,
    synced_at: new Date().toISOString(),
  };
}
