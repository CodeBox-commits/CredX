"""Outputs of the research, fraud, scoring and CAM engines."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base, IdMixin, JSONType, TimestampMixin
from models.enums import AlertStatus


class ResearchReport(IdMixin, TimestampMixin, Base):
    __tablename__ = "research_reports"

    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"), index=True)
    litigation_risk: Mapped[str] = mapped_column(String(16))
    promoter_sentiment: Mapped[str] = mapped_column(String(16))
    sector_outlook: Mapped[str] = mapped_column(String(16))
    overall_risk: Mapped[str] = mapped_column(String(16))
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.0)  # -1 .. 1
    litigation_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0 .. 100
    summary: Mapped[str] = mapped_column(Text)
    sector: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    mca: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    providers: Mapped[list[str]] = mapped_column(JSONType, default=list)
    queries: Mapped[list[str]] = mapped_column(JSONType, default=list)

    findings: Mapped[list[ResearchFinding]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="ResearchFinding.published_at.desc()"
    )


class ResearchFinding(IdMixin, Base):
    __tablename__ = "research_findings"

    report_id: Mapped[str] = mapped_column(ForeignKey("research_reports.id", ondelete="CASCADE"), index=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(24), index=True)  # news|litigation|regulatory|mca|fraud|sector
    title: Mapped[str] = mapped_column(String(500))
    snippet: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(160))
    url: Mapped[str | None] = mapped_column(String(1000))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sentiment: Mapped[float] = mapped_column(Float, default=0.0)
    severity: Mapped[str] = mapped_column(String(16), default="LOW")
    tags: Mapped[list[str]] = mapped_column(JSONType, default=list)
    provider: Mapped[str] = mapped_column(String(32))

    report: Mapped[ResearchReport] = relationship(back_populates="findings")


class FraudAnalysis(IdMixin, TimestampMixin, Base):
    __tablename__ = "fraud_analyses"

    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"), index=True)
    fraud_score: Mapped[int] = mapped_column(Integer)  # 0 .. 100, higher = riskier
    risk_level: Mapped[str] = mapped_column(String(16))
    summary: Mapped[str] = mapped_column(Text)
    graph: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)  # nodes/links for the UI
    heatmap: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    gst_checks: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    stats: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)

    alerts: Mapped[list[FraudAlert]] = relationship(back_populates="analysis", cascade="all, delete-orphan")


class FraudAlert(IdMixin, TimestampMixin, Base):
    __tablename__ = "fraud_alerts"
    __table_args__ = (Index("ix_fraud_alerts_case_status", "case_id", "status"),)

    analysis_id: Mapped[str] = mapped_column(ForeignKey("fraud_analyses.id", ondelete="CASCADE"), index=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"))
    alert_type: Mapped[str] = mapped_column(String(40), index=True)
    severity: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    entities: Mapped[list[str]] = mapped_column(JSONType, default=list)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    score_impact: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default=AlertStatus.OPEN)

    analysis: Mapped[FraudAnalysis] = relationship(back_populates="alerts")


class CreditScore(IdMixin, TimestampMixin, Base):
    """Immutable, versioned decision snapshot. Every rescoring appends a row."""

    __tablename__ = "credit_scores"
    __table_args__ = (Index("ix_credit_scores_case_version", "case_id", "version", unique=True),)

    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer)
    model_version: Mapped[str] = mapped_column(String(40))
    model_score: Mapped[int] = mapped_column(Integer)  # pure ML score
    credit_score: Mapped[int] = mapped_column(Integer)  # after overlays
    probability_of_default: Mapped[float] = mapped_column(Float)
    approval_probability: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String(16))
    rating: Mapped[str] = mapped_column(String(8))  # internal grade CX1..CX8
    decision: Mapped[str] = mapped_column(String(32))
    recommended_amount: Mapped[float] = mapped_column(Float)
    suggested_rate: Mapped[float] = mapped_column(Float)
    features: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    contributions: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    overlays: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    policy: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    five_cs: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    loan_sizing: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    pricing: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    ratios: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    top_risk_factors: Mapped[list[str]] = mapped_column(JSONType, default=list)
    top_strengths: Mapped[list[str]] = mapped_column(JSONType, default=list)
    narrative: Mapped[str | None] = mapped_column(Text)
    # decision_reasons, conditions, what_if, base_points, overlay_total, model_metrics, model_pd
    explanation: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class CamReport(IdMixin, TimestampMixin, Base):
    __tablename__ = "cam_reports"
    __table_args__ = (Index("ix_cam_reports_case_version", "case_id", "version", unique=True),)

    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer)
    score_id: Mapped[str | None] = mapped_column(ForeignKey("credit_scores.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft | final
    sections: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    analyst_comments: Mapped[dict[str, str]] = mapped_column(JSONType, default=dict)  # section_id -> text
    html: Mapped[str | None] = mapped_column(Text)
    pdf_key: Mapped[str | None] = mapped_column(String(512))
    docx_key: Mapped[str | None] = mapped_column(String(512))
    narrative_provider: Mapped[str | None] = mapped_column(String(32))
    generated_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
