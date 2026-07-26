from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class IngestionStep(BaseModel):
    name: str
    status: Literal["pending", "completed", "failed", "skipped"]
    detail: str


class AnalysisSignal(BaseModel):
    label: str
    severity: Literal["low", "medium", "high"]
    detail: str
    page_number: int | None = None
    excerpt: str | None = None


class AnalysisHighlight(BaseModel):
    title: str
    detail: str
    page_number: int | None = None


class StructuredExtraction(BaseModel):
    company_name: str | None = None
    cin: str | None = None
    gst_number: str | None = None
    pan: str | None = None
    document_type: str | None = None
    revenue: float | None = None
    ebitda: float | None = None
    operating_profit: float | None = None
    net_profit: float | None = None
    liabilities: float | None = None
    debt: float | None = None
    current_assets: float | None = None
    current_liabilities: float | None = None
    fixed_assets: float | None = None
    inventory: float | None = None
    cash: float | None = None
    net_worth: float | None = None
    total_assets: float | None = None
    interest_expense: float | None = None
    tax_expense: float | None = None
    loans: float | None = None
    creditors: float | None = None
    debtors: float | None = None
    directors: list[str] = Field(default_factory=list)
    auditor: str | None = None
    financial_year: str | None = None
    risk_indicators: list[str] = Field(default_factory=list)
    financial_health: Literal["STRONG", "MODERATE", "STRESSED", "UNKNOWN"] = "UNKNOWN"
    confidence_score: float = 0.0


class ParseSummary(BaseModel):
    parsed: bool
    status: Literal["parsed", "skipped", "failed"]
    reason: str | None = None
    parser: str | None = None
    result_type: str | None = None
    page_count: int | None = None
    character_count: int | None = None
    artifact_path: str | None = None
    detected_document_type: str | None = None
    summary: str | None = None
    score: int | None = None
    risk_level: Literal["low", "medium", "high"] | None = None
    signals: list[AnalysisSignal] = Field(default_factory=list)
    highlights: list[AnalysisHighlight] = Field(default_factory=list)
    structured_output: StructuredExtraction | None = None
    pipeline_steps: list[IngestionStep] = Field(default_factory=list)
    validation_warnings: list[str] = Field(default_factory=list)
    tables: list[dict[str, object]] = Field(default_factory=list)
    extraction_duration_ms: int | None = None


class UploadedFileMeta(BaseModel):
    document_id: str
    company_id: str | None = None
    document_type: str | None = None
    original_filename: str
    stored_filename: str
    storage_path: str
    content_type: str | None = None
    size_bytes: int
    uploaded_at: str
    parse_summary: ParseSummary | None = None


class UploadMultipleResponse(BaseModel):
    success: bool
    count: int
    files: list[UploadedFileMeta]
    processing_mode: Literal["backend", "local"] = "backend"
    warning: str | None = None
