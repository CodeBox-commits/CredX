from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from .mixins import StringIdentifierMixin, TimestampMixin


class UnderwritingCase(StringIdentifierMixin, TimestampMixin, Base):
    __tablename__ = "underwriting_cases"
    __table_args__ = (
        Index("ix_underwriting_cases_company_id", "company_id"),
        Index("ix_underwriting_cases_status", "status"),
        Index("ix_underwriting_cases_last_synced_at", "last_synced_at"),
    )

    company_id: Mapped[str] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    facility_type: Mapped[str] = mapped_column(String(120), default="Term Loan")
    requested_amount_cr: Mapped[float] = mapped_column(Numeric(16, 2), default=0.0)
    due_diligence_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="draft")
    current_stage: Mapped[str] = mapped_column(String(80), default="ingestion")
    latest_decision: Mapped[str | None] = mapped_column(String(80), nullable=True)
    latest_risk_level: Mapped[str | None] = mapped_column(String(40), nullable=True)
    credit_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approval_probability: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    recommended_loan_amount_cr: Mapped[float | None] = mapped_column(Numeric(16, 2), nullable=True)
    suggested_interest_rate: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    risk_premium: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Numeric(5, 3), nullable=True)
    decision_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    positive_factors: Mapped[str | None] = mapped_column(Text, nullable=True)
    negative_factors: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_drivers: Mapped[str | None] = mapped_column(Text, nullable=True)
    pricing_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    financial_ratios_json: Mapped[dict | None] = mapped_column(String(2048), nullable=True)
    feature_vector_json: Mapped[dict | None] = mapped_column(String(2048), nullable=True)
    warnings_json: Mapped[dict | None] = mapped_column(String(2048), nullable=True)
    financial_health: Mapped[str | None] = mapped_column(String(40), nullable=True)
    processing_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    analysis_status: Mapped[str] = mapped_column(String(40), default="draft")
    sync_status: Mapped[str] = mapped_column(String(40), default="idle")
    last_synced_at: Mapped[str | None] = mapped_column(String(64), nullable=True)

    company = relationship("Company", back_populates="cases")
    documents = relationship(
        "CaseDocument",
        back_populates="case",
        cascade="all, delete-orphan",
    )
    snapshots = relationship(
        "CaseAnalysisSnapshot",
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="desc(CaseAnalysisSnapshot.created_at)",
    )
    jobs = relationship(
        "WorkflowJob",
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="desc(WorkflowJob.created_at)",
    )
    notes = relationship(
        "AnalystNote",
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="desc(AnalystNote.created_at)",
    )
    audit_events = relationship(
        "CaseAuditEvent",
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="desc(CaseAuditEvent.created_at)",
    )
