"""API schemas (request/response contracts)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from utils.india import is_valid_cin, is_valid_gstin, is_valid_pan


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- auth / users
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class RegisterRequest(LoginRequest):
    full_name: str = Field(min_length=2, max_length=160)


class UserOut(ORM):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class UserCreate(RegisterRequest):
    role: Literal["admin", "credit_manager", "analyst", "viewer"] = "analyst"


class UserUpdate(BaseModel):
    role: Literal["admin", "credit_manager", "analyst", "viewer"] | None = None
    is_active: bool | None = None
    full_name: str | None = None


# ---------------------------------------------------------------- companies / cases
class Promoter(BaseModel):
    name: str
    din: str | None = None
    role: str | None = "Director"
    shareholding_pct: float | None = None


class CompanyIn(BaseModel):
    name: str = Field(min_length=3, max_length=255)
    cin: str | None = None
    pan: str | None = None
    gstin: str | None = None
    sector: str | None = None
    sub_sector: str | None = None
    constitution: str | None = None
    incorporation_year: int | None = Field(default=None, ge=1850, le=2100)
    city: str | None = None
    state: str | None = None
    website: str | None = None
    promoters: list[Promoter] = Field(default_factory=list)
    external_rating: str | None = None

    @field_validator("gstin")
    @classmethod
    def _gstin(cls, v: str | None) -> str | None:
        if v and not is_valid_gstin(v):
            raise ValueError("Invalid GSTIN (format or checksum)")
        return v.upper() if v else v

    @field_validator("pan")
    @classmethod
    def _pan(cls, v: str | None) -> str | None:
        if v and not is_valid_pan(v):
            raise ValueError("Invalid PAN format")
        return v.upper() if v else v

    @field_validator("cin")
    @classmethod
    def _cin(cls, v: str | None) -> str | None:
        if v and not is_valid_cin(v):
            raise ValueError("Invalid CIN format")
        return v.upper() if v else v


class CompanyOut(ORM):
    id: str
    name: str
    cin: str | None
    pan: str | None
    gstin: str | None
    sector: str | None
    sub_sector: str | None
    constitution: str | None
    incorporation_year: int | None
    city: str | None
    state: str | None
    website: str | None
    promoters: list[dict[str, Any]]
    external_rating: str | None
    created_at: datetime


class CaseCreate(BaseModel):
    company_id: str | None = None
    company: CompanyIn | None = None
    facility_type: str = "Term Loan"
    requested_amount: float = Field(gt=0)
    tenure_months: int = Field(default=60, ge=1, le=360)
    purpose: str | None = None
    collateral_type: str | None = None
    collateral_value: float | None = Field(default=None, ge=0)
    priority: Literal["low", "normal", "high", "urgent"] = "normal"


class CaseUpdate(BaseModel):
    facility_type: str | None = None
    requested_amount: float | None = Field(default=None, gt=0)
    tenure_months: int | None = Field(default=None, ge=1, le=360)
    purpose: str | None = None
    collateral_type: str | None = None
    collateral_value: float | None = Field(default=None, ge=0)
    priority: Literal["low", "normal", "high", "urgent"] | None = None
    assigned_to_id: str | None = None


class CaseOut(ORM):
    id: str
    reference: str
    company: CompanyOut
    facility_type: str
    requested_amount: float
    tenure_months: int
    purpose: str | None
    collateral_type: str | None
    collateral_value: float | None
    status: str
    priority: str
    latest_score: int | None
    latest_risk_level: str | None
    latest_fraud_score: int | None
    final_decision: str | None
    decision_rationale: str | None
    decided_at: datetime | None
    is_demo: bool
    assigned_to: UserOut | None = None
    created_at: datetime
    updated_at: datetime


class DecisionIn(BaseModel):
    decision: Literal["APPROVE", "APPROVE_WITH_CONDITIONS", "REFER", "DECLINE"]
    rationale: str = Field(min_length=10, max_length=4000)


# ---------------------------------------------------------------- documents / jobs
class DocumentOut(ORM):
    id: str
    case_id: str
    filename: str
    content_type: str
    size_bytes: int
    declared_type: str | None
    doc_type: str | None
    classification_confidence: float | None
    classification_signals: list[str]
    status: str
    page_count: int | None
    ocr_used: bool
    extraction_confidence: float | None
    error: str | None
    created_at: datetime


class DocumentDetail(DocumentOut):
    extracted: dict[str, Any]
    text_preview: str | None


class JobOut(ORM):
    id: str
    kind: str
    case_id: str | None
    document_id: str | None
    status: str
    progress: int
    stage: str | None
    message: str | None
    steps: list[dict[str, Any]]
    result: dict[str, Any] | None
    error: str | None
    attempts: int
    backend: str
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    duration_ms: int | None


class UploadResult(BaseModel):
    documents: list[DocumentOut]
    jobs: list[JobOut]
    rejected: list[dict[str, str]]


class FinancialUpdate(BaseModel):
    values: dict[str, float | None]
    reason: str = Field(min_length=5, max_length=1000)


# ---------------------------------------------------------------- workflow
class NoteIn(BaseModel):
    body: str = Field(min_length=3, max_length=5000)
    category: Literal["site_visit", "management", "operations", "financial", "collateral", "compliance", "general"] = "general"
    kind: Literal["note", "comment"] = "note"
    parent_id: str | None = None
    impact_points: int | None = Field(default=None, ge=-40, le=40)
    impact_rationale: str | None = None
    five_c: Literal["character", "capacity", "capital", "collateral", "conditions"] | None = None
    include_in_cam: bool = True


class NoteUpdate(BaseModel):
    body: str | None = Field(default=None, min_length=3, max_length=5000)
    impact_points: int | None = Field(default=None, ge=-40, le=40)
    clear_impact: bool = False
    include_in_cam: bool | None = None
    pinned: bool | None = None


class NoteOut(ORM):
    id: str
    case_id: str
    parent_id: str | None
    kind: str
    category: str
    body: str
    impact_points: int | None
    inferred_impact: int | None
    impact_rationale: str | None
    five_c: str | None
    include_in_cam: bool
    pinned: bool
    author: UserOut | None
    created_at: datetime
    preview_impact: int | None = None
    preview_rationale: str | None = None


class OverrideIn(BaseModel):
    field: Literal["decision", "recommended_amount", "suggested_rate", "credit_score"]
    new_value: str = Field(min_length=1, max_length=80)
    reason: str = Field(min_length=10, max_length=2000)


class ReviewIn(BaseModel):
    approve: bool
    comment: str | None = Field(default=None, max_length=2000)


class OverrideOut(ORM):
    id: str
    case_id: str
    field: str
    original_value: str | None
    new_value: str
    reason: str
    status: str
    requested_by: UserOut | None
    reviewed_by: UserOut | None
    reviewed_at: datetime | None
    review_comment: str | None
    created_at: datetime


class EscalationIn(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)
    to_role: Literal["credit_manager", "admin"] = "credit_manager"


class ResolveIn(BaseModel):
    resolution: str = Field(min_length=5, max_length=2000)


class EscalationOut(ORM):
    id: str
    case_id: str
    to_role: str
    reason: str
    status: str
    resolution: str | None
    raised_by: UserOut | None
    resolved_by: UserOut | None
    resolved_at: datetime | None
    created_at: datetime


class AlertUpdate(BaseModel):
    status: Literal["open", "confirmed", "dismissed"]
    comment: str | None = None


class CamCommentsIn(BaseModel):
    comments: dict[str, str]
    regenerate: bool = True


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    case_id: str | None = None


class ChatOut(BaseModel):
    answer: str
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: float
    fallback_used: bool
    message_id: str


class AuditOut(ORM):
    id: str
    created_at: datetime
    actor_email: str | None
    action: str
    entity_type: str
    entity_id: str | None
    case_id: str | None
    summary: str | None
    details: dict[str, Any]
    request_id: str | None


class Page(BaseModel):
    items: list[Any]
    total: int
    limit: int
    offset: int
