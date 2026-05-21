import { loadWorkspaceState, type WorkspaceState } from "./intelliCredit";
import { runPlatformAnalysis } from "./platformApi";
import type {
  PlatformAnalysisInput,
  PlatformAnalysisState,
} from "./platformTypes";
import type { StructuredExtraction, UploadedFileMeta } from "./creditTypes";

const STORAGE_KEY = "credx-platform-analysis-v1";
export const PLATFORM_ANALYSIS_EVENT = "credx-platform-analysis-updated";

const DEFAULT_ANALYSIS_STATE: PlatformAnalysisState = {
  status: "idle",
  message: "Upload and parse documents to activate live research, fraud, pricing, and CAM sync.",
  bundle: null,
  updated_at: null,
};

type WorkspaceSyncPatch = Partial<
  Pick<
    WorkspaceState,
    | "companyName"
    | "cin"
    | "sector"
    | "facilityType"
    | "requestedAmountCr"
    | "dueDiligenceNote"
    | "documents"
  >
>;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function firstDefined<T>(
  values: Array<T | null | undefined>,
): T | null {
  return values.find((value) => value !== null && value !== undefined) ?? null;
}

function maxDefined(values: Array<number | null | undefined>): number | null {
  const defined = values.filter((value): value is number => typeof value === "number");
  return defined.length > 0 ? Math.max(...defined) : null;
}

function averageDefined(values: Array<number | null | undefined>): number {
  const defined = values.filter((value): value is number => typeof value === "number");
  if (defined.length === 0) return 0;
  return Number((defined.reduce((sum, value) => sum + value, 0) / defined.length).toFixed(2));
}

function detectFinancialHealth(
  outputs: StructuredExtraction[],
): StructuredExtraction["financial_health"] {
  const priority: Array<StructuredExtraction["financial_health"]> = [
    "STRESSED",
    "MODERATE",
    "STRONG",
    "UNKNOWN",
  ];

  for (const value of priority) {
    if (outputs.some((output) => output.financial_health === value)) {
      return value;
    }
  }

  return "UNKNOWN";
}

function hasDocumentMatch(documents: UploadedFileMeta[], matcher: RegExp): boolean {
  return documents.some((document) =>
    matcher.test(
      [
        document.document_type,
        document.parse_summary?.detected_document_type,
        document.original_filename,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  );
}

function hasSignalMatch(documents: UploadedFileMeta[], matcher: RegExp): boolean {
  return documents.some((document) =>
    (document.parse_summary?.signals ?? []).some((signal) =>
      matcher.test([signal.label, signal.detail, signal.excerpt ?? ""].join(" ")),
    ),
  );
}

export function loadPlatformAnalysisState(): PlatformAnalysisState {
  if (!canUseStorage()) {
    return DEFAULT_ANALYSIS_STATE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ANALYSIS_STATE;

    const parsed = JSON.parse(raw) as Partial<PlatformAnalysisState>;
    return {
      status: parsed.status ?? DEFAULT_ANALYSIS_STATE.status,
      message: parsed.message ?? DEFAULT_ANALYSIS_STATE.message,
      bundle: parsed.bundle ?? null,
      updated_at: parsed.updated_at ?? null,
    };
  } catch {
    return DEFAULT_ANALYSIS_STATE;
  }
}

function persistPlatformAnalysisState(
  state: PlatformAnalysisState,
): PlatformAnalysisState {
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(PLATFORM_ANALYSIS_EVENT));
  }

  return state;
}

export function updatePlatformAnalysisState(
  patch: Partial<PlatformAnalysisState>,
): PlatformAnalysisState {
  const current = loadPlatformAnalysisState();
  return persistPlatformAnalysisState({
    status: patch.status ?? current.status,
    message: patch.message ?? current.message,
    bundle: patch.bundle ?? current.bundle,
    updated_at: patch.updated_at ?? current.updated_at,
  });
}

export function resetPlatformAnalysisState(): PlatformAnalysisState {
  return persistPlatformAnalysisState(DEFAULT_ANALYSIS_STATE);
}

export function collectStructuredExtraction(
  documents: UploadedFileMeta[],
  workspace: Pick<WorkspaceState, "companyName" | "cin">,
): StructuredExtraction | null {
  const outputs = documents
    .map((document) => document.parse_summary?.structured_output)
    .filter((output): output is StructuredExtraction => output !== null && output !== undefined);

  const aggregatedSignals = uniqueStrings(
    documents.flatMap((document) =>
      (document.parse_summary?.signals ?? []).map((signal) => signal.label),
    ),
  );

  if (outputs.length === 0 && aggregatedSignals.length === 0 && documents.length === 0) {
    return null;
  }

  return {
    company_name: firstDefined(outputs.map((output) => output.company_name)) ?? workspace.companyName,
    cin: firstDefined(outputs.map((output) => output.cin)) ?? workspace.cin,
    gst_number: firstDefined(outputs.map((output) => output.gst_number)),
    document_type: firstDefined(outputs.map((output) => output.document_type)),
    revenue: maxDefined(outputs.map((output) => output.revenue)),
    ebitda: maxDefined(outputs.map((output) => output.ebitda)),
    liabilities: maxDefined(outputs.map((output) => output.liabilities)),
    debt: maxDefined(outputs.map((output) => output.debt)),
    total_assets: maxDefined(outputs.map((output) => output.total_assets)),
    directors: uniqueStrings(outputs.flatMap((output) => output.directors ?? [])),
    risk_indicators: uniqueStrings([
      ...outputs.flatMap((output) => output.risk_indicators ?? []),
      ...aggregatedSignals,
    ]),
    financial_health: detectFinancialHealth(outputs),
    confidence_score:
      outputs.length > 0
        ? averageDefined(outputs.map((output) => output.confidence_score))
        : Number((documents.filter((document) => document.parse_summary?.status === "parsed").length / Math.max(documents.length, 1)).toFixed(2)),
  };
}

function buildFraudProxyInputs(
  documents: UploadedFileMeta[],
  extracted: StructuredExtraction | null,
): PlatformAnalysisInput["fraudInputs"] {
  const declaredTurnover = extracted?.revenue ?? null;
  const hasGstDoc = hasDocumentMatch(documents, /gst|gstr|goods and services tax/i);
  const hasBankDoc = hasDocumentMatch(documents, /bank statement|account statement/i);
  const hasGstMismatch = hasSignalMatch(
    documents,
    /gst reconciliation|circular-trading|round tripping|mismatch/i,
  );
  const hasLiquidityStress = hasSignalMatch(
    documents,
    /cash flow|liquidity|working capital|overdue/i,
  );

  const gstr3bAmount = hasGstDoc && declaredTurnover
    ? declaredTurnover
    : null;
  const gstr2aAmount =
    hasGstDoc && declaredTurnover
      ? Number((declaredTurnover * (hasGstMismatch ? 0.9 : 0.985)).toFixed(2))
      : null;
  const bankCredits =
    hasBankDoc && declaredTurnover
      ? Number((declaredTurnover * (hasLiquidityStress ? 0.86 : 0.96)).toFixed(2))
      : null;

  return {
    gstr_2a_amount: gstr2aAmount,
    gstr_3b_amount: gstr3bAmount,
    declared_turnover: declaredTurnover,
    bank_credits: bankCredits,
    supplier_gstins: [],
    customer_gstins: [],
  };
}

function buildAnalysisInput(
  patch?: WorkspaceSyncPatch,
): PlatformAnalysisInput {
  const current = loadWorkspaceState();
  const next = {
    companyName: patch?.companyName ?? current.companyName,
    cin: patch?.cin ?? current.cin,
    sector: patch?.sector ?? current.sector,
    facilityType: patch?.facilityType ?? current.facilityType,
    requestedAmountCr: patch?.requestedAmountCr ?? current.requestedAmountCr,
    dueDiligenceNote: patch?.dueDiligenceNote ?? current.dueDiligenceNote,
    documents: patch?.documents ?? current.documents,
  };

  const extracted = collectStructuredExtraction(next.documents, {
    companyName: next.companyName,
    cin: next.cin,
  });

  return {
    companyName: next.companyName,
    sector: next.sector,
    requestedAmountCr: next.requestedAmountCr,
    dueDiligenceNote: next.dueDiligenceNote,
    documents: next.documents,
    extracted,
    promoterNames: extracted?.directors ?? [],
    fraudInputs: buildFraudProxyInputs(next.documents, extracted),
  };
}

export async function syncPlatformAnalysis(
  patch?: WorkspaceSyncPatch,
): Promise<PlatformAnalysisState> {
  const currentState = loadPlatformAnalysisState();
  const input = buildAnalysisInput(patch);

  if (input.documents.length === 0) {
    return resetPlatformAnalysisState();
  }

  persistPlatformAnalysisState({
    ...currentState,
    status: "syncing",
    message: `Refreshing CredX platform analysis for ${input.companyName}...`,
  });

  try {
    const bundle = await runPlatformAnalysis(input);
    return persistPlatformAnalysisState({
      status: "synced",
      message:
        "Research intelligence, fraud graph, pricing, and CAM preview are now aligned to the latest case inputs.",
      bundle,
      updated_at: bundle.synced_at,
    });
  } catch (error) {
    const detail =
      error instanceof Error && error.message
        ? ` ${error.message}`
        : "";

    return persistPlatformAnalysisState({
      status: "fallback",
      message:
        "Live platform services are unavailable, so CredX is using local underwriting synthesis for this session." +
        detail,
      bundle: currentState.bundle,
      updated_at: currentState.updated_at,
    });
  }
}

export function buildCopilotContext(
  workspace: WorkspaceState,
  analysisState: PlatformAnalysisState,
): Record<string, unknown> {
  const bundle = analysisState.bundle;

  return {
    company_name: workspace.companyName,
    cin: workspace.cin,
    sector: workspace.sector,
    facility_type: workspace.facilityType,
    requested_amount_cr: workspace.requestedAmountCr,
    due_diligence_note: workspace.dueDiligenceNote,
    document_summary: workspace.documentSummary,
    top_signals: workspace.topSignals,
    structured_synthesis: workspace.structuredSynthesis,
    missing_sources: workspace.sourceCoverage.filter((item) => !item.available),
    extracted: bundle?.extracted ?? null,
    research_summary: bundle?.research?.summary ?? null,
    research_findings: bundle?.research?.findings ?? [],
    research_sources: bundle?.research?.sources ?? [],
    fraud_summary: bundle?.fraud?.summary ?? null,
    fraud_alerts: bundle?.fraud?.suspicious_cycle_alerts ?? [],
    decision: bundle?.decision ?? null,
    cam_summary: bundle?.cam?.summary ?? null,
    sync_status: analysisState.status,
  };
}
