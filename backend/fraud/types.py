"""Inputs/outputs of the fraud engine (pure data, no ORM)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from extraction.normalization.schema import BankSummary, GstPeriodData

Severity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class PartyRef(BaseModel):
    name: str
    identifier: str | None = None  # GSTIN / DIN / CIN / PAN
    entity_type: str  # director | supplier | customer | related_party | group_company | lender | shareholder
    attributes: dict[str, Any] = Field(default_factory=dict)


class TradeFlow(BaseModel):
    source_name: str
    source_gstin: str | None = None
    target_name: str
    target_gstin: str | None = None
    amount: float = 0.0
    invoice_count: int = 0
    link_type: str = "sale"
    period: str | None = None


class FraudInputs(BaseModel):
    borrower_name: str
    borrower_gstin: str | None = None
    borrower_pan: str | None = None
    revenue: float | None = None
    parties: list[PartyRef] = Field(default_factory=list)
    flows: list[TradeFlow] = Field(default_factory=list)
    gst: list[GstPeriodData] = Field(default_factory=list)
    bank: BankSummary | None = None
    document_risk_codes: list[str] = Field(default_factory=list)


class FraudAlertData(BaseModel):
    alert_type: str
    severity: Severity
    title: str
    description: str
    entities: list[str] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    score_impact: float = 0.0


class GstCheck(BaseModel):
    code: str
    label: str
    status: Literal["PASS", "WARN", "FAIL", "NA"]
    value: float | None = None
    threshold: str
    detail: str


class FraudResult(BaseModel):
    fraud_risk_score: float
    risk_level: Severity
    alerts: list[FraudAlertData]
    gst_checks: list[GstCheck]
    graph: dict[str, Any]
    heatmap: dict[str, Any]
    metrics: dict[str, Any]
    summary: str
