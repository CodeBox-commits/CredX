"""Uploaded evidence and the structured data extracted from it."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base, IdMixin, JSONType, TimestampMixin
from models.enums import DocumentStatus

if TYPE_CHECKING:
    from models.core import CreditCase


class Document(IdMixin, TimestampMixin, Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("case_id", "sha256", name="uq_documents_case_sha"),)

    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(512))
    content_type: Mapped[str] = mapped_column(String(80))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    declared_type: Mapped[str | None] = mapped_column(String(40))  # analyst hint at upload time
    doc_type: Mapped[str | None] = mapped_column(String(40), index=True)
    classification_confidence: Mapped[float | None] = mapped_column(Float)
    classification_signals: Mapped[list[str]] = mapped_column(JSONType, default=list)
    status: Mapped[str] = mapped_column(String(20), default=DocumentStatus.UPLOADED, index=True)
    page_count: Mapped[int | None] = mapped_column(Integer)
    ocr_used: Mapped[bool] = mapped_column(Boolean, default=False)
    extraction_confidence: Mapped[float | None] = mapped_column(Float)
    extracted: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    text_preview: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    uploaded_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    case: Mapped[CreditCase] = relationship(back_populates="documents")


class FinancialStatement(IdMixin, TimestampMixin, Base):
    """One fiscal year of normalised financials (all amounts in INR)."""

    __tablename__ = "financial_statements"
    __table_args__ = (UniqueConstraint("case_id", "fiscal_year", name="uq_financials_case_fy"),)

    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"))
    fiscal_year: Mapped[str] = mapped_column(String(8))  # "FY25"
    revenue: Mapped[float | None] = mapped_column(Float)
    ebitda: Mapped[float | None] = mapped_column(Float)
    depreciation: Mapped[float | None] = mapped_column(Float)
    interest_expense: Mapped[float | None] = mapped_column(Float)
    pat: Mapped[float | None] = mapped_column(Float)
    total_debt: Mapped[float | None] = mapped_column(Float)
    short_term_debt: Mapped[float | None] = mapped_column(Float)
    long_term_debt: Mapped[float | None] = mapped_column(Float)
    current_portion_ltd: Mapped[float | None] = mapped_column(Float)
    current_assets: Mapped[float | None] = mapped_column(Float)
    current_liabilities: Mapped[float | None] = mapped_column(Float)
    total_assets: Mapped[float | None] = mapped_column(Float)
    net_worth: Mapped[float | None] = mapped_column(Float)
    receivables: Mapped[float | None] = mapped_column(Float)
    inventory: Mapped[float | None] = mapped_column(Float)
    payables: Mapped[float | None] = mapped_column(Float)
    cash: Mapped[float | None] = mapped_column(Float)
    operating_cash_flow: Mapped[float | None] = mapped_column(Float)
    contingent_liabilities: Mapped[float | None] = mapped_column(Float)
    related_party_transactions: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(20), default="extracted")  # extracted | manual | demo
    confidence: Mapped[float | None] = mapped_column(Float)
    provenance: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)  # field -> {doc, page, snippet}


class GstFiling(IdMixin, TimestampMixin, Base):
    __tablename__ = "gst_filings"

    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"))
    gstin: Mapped[str | None] = mapped_column(String(15), index=True)
    return_type: Mapped[str] = mapped_column(String(12))  # GSTR-1 | GSTR-3B | GSTR-2A | GSTR-2B
    period: Mapped[str] = mapped_column(String(16))  # "2025-03" or "FY25"
    taxable_turnover: Mapped[float | None] = mapped_column(Float)
    tax_paid: Mapped[float | None] = mapped_column(Float)
    itc_claimed: Mapped[float | None] = mapped_column(Float)
    filed_on: Mapped[date | None] = mapped_column(Date)
    days_late: Mapped[int | None] = mapped_column(Integer)


class BankStatementSummary(IdMixin, TimestampMixin, Base):
    __tablename__ = "bank_statement_summaries"

    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"))
    bank_name: Mapped[str | None] = mapped_column(String(120))
    account_masked: Mapped[str | None] = mapped_column(String(32))
    period_start: Mapped[date | None] = mapped_column(Date)
    period_end: Mapped[date | None] = mapped_column(Date)
    opening_balance: Mapped[float | None] = mapped_column(Float)
    closing_balance: Mapped[float | None] = mapped_column(Float)
    total_credits: Mapped[float | None] = mapped_column(Float)
    total_debits: Mapped[float | None] = mapped_column(Float)
    average_balance: Mapped[float | None] = mapped_column(Float)
    bounce_count: Mapped[int] = mapped_column(Integer, default=0)
    overdraw_days: Mapped[int] = mapped_column(Integer, default=0)
    monthly: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    counterparties: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
