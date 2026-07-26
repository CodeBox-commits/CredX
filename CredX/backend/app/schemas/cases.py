from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .platform import (
    CamPreviewResponse,
    CreditDecisionResponse,
    FraudAnalysisResponse,
    ResearchIntelligenceResponse,
)
from .uploads import StructuredExtraction, UploadedFileMeta


class PlatformAnalysisBundleInput(BaseModel):
    extracted: StructuredExtraction | None = None
    research: ResearchIntelligenceResponse | None = None
    fraud: FraudAnalysisResponse | None = None
    decision: CreditDecisionResponse | None = None
    cam: CamPreviewResponse | None = None
    documents: list[UploadedFileMeta] = Field(default_factory=list)
    synced_at: str


class WorkflowJobResponse(BaseModel):
    job_id: str
    case_id: str
    job_type: str
    status: str
    stage: str
    progress: int
    message: str | None = None
    created_at: str
    updated_at: str
    started_at: str | None = None
    completed_at: str | None = None


class AuditEventResponse(BaseModel):
    event_id: str
    case_id: str
    actor: str
    action: str
    from_status: str | None = None
    to_status: str | None = None
    details: str | None = None
    previous_score: int | None = None
    current_score: int | None = None
    previous_recommendation: str | None = None
    current_recommendation: str | None = None
    created_at: str


class AnalystNoteResponse(BaseModel):
    note_id: str
    case_id: str
    source: str
    note: str
    created_at: str


class CaseDashboardSummaryResponse(BaseModel):
    total_cases: int
    pending_reviews: int
    high_risk_cases: int
    recently_approved: int
    recently_rejected: int
    average_credit_score: float
    average_processing_time_ms: float
    pipeline_statistics: dict[str, int]
    status_distribution: dict[str, int]
    recent_activity: list[dict[str, str | int | None]]


class CaseSummaryResponse(BaseModel):
    case_id: str
    company_id: str
    company_name: str
    cin: str | None = None
    sector: str | None = None
    facility_type: str
    requested_amount_cr: float
    status: str
    current_stage: str
    decision: str | None = None
    risk_level: str | None = None
    credit_score: int | None = None
    approval_probability: float | None = None
    recommended_loan_amount_cr: float | None = None
    suggested_interest_rate: float | None = None
    risk_premium: float | None = None
    confidence_score: float | None = None
    decision_summary: str | None = None
    financial_health: str | None = None
    processing_time_ms: int | None = None
    version: int = 1
    analysis_status: str = "draft"
    sync_status: str
    last_synced_at: str | None = None
    document_count: int = 0
    latest_job_status: str | None = None
    created_at: str
    updated_at: str


class CaseDetailResponse(CaseSummaryResponse):
    due_diligence_note: str | None = None
    documents: list[UploadedFileMeta] = Field(default_factory=list)
    analysis_bundle: PlatformAnalysisBundleInput | None = None
    jobs: list[WorkflowJobResponse] = Field(default_factory=list)
    analyst_notes: list[AnalystNoteResponse] = Field(default_factory=list)
    audit_history: list[AuditEventResponse] = Field(default_factory=list)


class CaseSyncRequest(BaseModel):
    case_id: str | None = None
    company_name: str
    cin: str | None = None
    sector: str = "General"
    facility_type: str = "Term Loan"
    requested_amount_cr: float = 0.0
    due_diligence_note: str | None = None
    sync_status: Literal["synced", "fallback", "error"] = "synced"
    documents: list[UploadedFileMeta] = Field(default_factory=list)
    analysis_bundle: PlatformAnalysisBundleInput | None = None


class CaseSyncResponse(BaseModel):
    case: CaseDetailResponse
    job: WorkflowJobResponse


class AnalystNoteCreateRequest(BaseModel):
    source: str = "analyst"
    note: str
