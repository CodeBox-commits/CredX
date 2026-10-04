from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .uploads import StructuredExtraction


class ResearchIntelligenceRequest(BaseModel):
    company_name: str
    sector: str = "General"
    promoter_names: list[str] = Field(default_factory=list)
    analyst_note: str | None = None
    extracted: StructuredExtraction | None = None


class ResearchSource(BaseModel):
    source: str
    detail: str


class ResearchFinding(BaseModel):
    category: Literal["promoter", "litigation", "sector", "regulatory", "sentiment"]
    severity: Literal["low", "medium", "high"]
    title: str
    detail: str


class ResearchIntelligenceResponse(BaseModel):
    litigation_risk: Literal["LOW", "MEDIUM", "HIGH"]
    promoter_sentiment: Literal["POSITIVE", "NEUTRAL", "NEGATIVE"]
    sector_outlook: Literal["FAVORABLE", "STABLE", "WEAK"]
    summary: str
    findings: list[ResearchFinding]
    sources: list[ResearchSource]


class FraudAnalysisRequest(BaseModel):
    company_name: str
    extracted: StructuredExtraction | None = None
    gstr_2a_amount: float | None = None
    gstr_3b_amount: float | None = None
    declared_turnover: float | None = None
    bank_credits: float | None = None
    supplier_gstins: list[str] = Field(default_factory=list)
    customer_gstins: list[str] = Field(default_factory=list)


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    risk: str


class GraphEdge(BaseModel):
    source: str
    target: str
    label: str


class FraudAlert(BaseModel):
    label: str
    severity: Literal["low", "medium", "high"]
    detail: str


class FraudAnalysisResponse(BaseModel):
    fraud_risk_score: int
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    suspicious_cycle_alerts: list[FraudAlert]
    graph: dict[str, list[Any]]
    summary: str


class UnderwritingRequest(BaseModel):
    company_name: str
    sector: str = "General"
    requested_amount: float = 0.0
    analyst_note: str | None = None
    extracted: StructuredExtraction | None = None
    research: ResearchIntelligenceResponse | None = None
    fraud: FraudAnalysisResponse | None = None


class DecisionFactor(BaseModel):
    label: str
    impact: Literal["positive", "negative"]
    contribution: float
    detail: str


class CreditDecisionResponse(BaseModel):
    credit_score: int
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    approval_probability: float
    recommended_loan_amount: float
    suggested_interest_rate: float
    decision: Literal["APPROVE", "CONDITIONAL APPROVAL", "REJECT"]
    top_risk_factors: list[str]
    factors: list[DecisionFactor]
    five_cs: dict[str, float]
    pricing_rationale: str


class CamPreviewRequest(BaseModel):
    company_name: str
    sector: str = "General"
    requested_amount: float = 0.0
    analyst_note: str | None = None
    extracted: StructuredExtraction | None = None
    research: ResearchIntelligenceResponse | None = None
    fraud: FraudAnalysisResponse | None = None
    decision: CreditDecisionResponse | None = None


class CamSection(BaseModel):
    title: str
    content: str


class CamPreviewResponse(BaseModel):
    sections: list[CamSection]
    export_formats: list[str]
    summary: str


class CopilotRequest(BaseModel):
    question: str
    context: dict[str, Any] = Field(default_factory=dict)


class CopilotResponse(BaseModel):
    answer: str
    provider: str
    tokens_used: int
