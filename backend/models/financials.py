"""Normalised financial facts extracted from documents (one row per period)."""

from __future__ import annotations

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database import Base, IdMixin, TimestampMixin

FINANCIAL_FIELDS = (
    "revenue",
    "ebitda",
    "depreciation",
    "interest_expense",
    "pbt",
    "pat",
    "total_assets",
    "total_liabilities",
    "current_assets",
    "current_liabilities",
    "inventory",
    "receivables",
    "payables",
    "cash",
    "net_worth",
    "total_debt",
    "short_term_debt",
    "long_term_debt",
    "cfo",
    "capex",
)


class FinancialStatement(IdMixin, TimestampMixin, Base):
    __tablename__ = "financial_statements"
    __table_args__ = (UniqueConstraint("case_id", "fiscal_year", name="uq_fin_case_year"),)

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    fiscal_year: Mapped[str] = mapped_column(String(8))  # e.g. FY2024
    is_audited: Mapped[bool] = mapped_column(Boolean, default=True)
    source_document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"))
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    revenue: Mapped[float | None] = mapped_column(Float)
    ebitda: Mapped[float | None] = mapped_column(Float)
    depreciation: Mapped[float | None] = mapped_column(Float)
    interest_expense: Mapped[float | None] = mapped_column(Float)
    pbt: Mapped[float | None] = mapped_column(Float)
    pat: Mapped[float | None] = mapped_column(Float)
    total_assets: Mapped[float | None] = mapped_column(Float)
    total_liabilities: Mapped[float | None] = mapped_column(Float)
    current_assets: Mapped[float | None] = mapped_column(Float)
    current_liabilities: Mapped[float | None] = mapped_column(Float)
    inventory: Mapped[float | None] = mapped_column(Float)
    receivables: Mapped[float | None] = mapped_column(Float)
    payables: Mapped[float | None] = mapped_column(Float)
    cash: Mapped[float | None] = mapped_column(Float)
    net_worth: Mapped[float | None] = mapped_column(Float)
    total_debt: Mapped[float | None] = mapped_column(Float)
    short_term_debt: Mapped[float | None] = mapped_column(Float)
    long_term_debt: Mapped[float | None] = mapped_column(Float)
    cfo: Mapped[float | None] = mapped_column(Float)
    capex: Mapped[float | None] = mapped_column(Float)


class GstReturn(IdMixin, TimestampMixin, Base):
    """Monthly GST summary combining GSTR-1, GSTR-3B and auto-populated GSTR-2A/2B."""

    __tablename__ = "gst_returns"
    __table_args__ = (UniqueConstraint("case_id", "gstin", "period", name="uq_gst_case_period"),)

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    gstin: Mapped[str] = mapped_column(String(15), index=True)
    period: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    gstr1_turnover: Mapped[float | None] = mapped_column(Float)
    gstr3b_turnover: Mapped[float | None] = mapped_column(Float)
    tax_paid: Mapped[float | None] = mapped_column(Float)
    itc_claimed: Mapped[float | None] = mapped_column(Float)  # as claimed in GSTR-3B
    itc_available: Mapped[float | None] = mapped_column(Float)  # as reflected in GSTR-2A/2B
    filing_delay_days: Mapped[int] = mapped_column(Integer, default=0)
    source_document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"))


class BankMonthly(IdMixin, TimestampMixin, Base):
    __tablename__ = "bank_monthly"
    __table_args__ = (UniqueConstraint("case_id", "account_ref", "month", name="uq_bank_case_month"),)

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    bank_name: Mapped[str | None] = mapped_column(String(120))
    account_ref: Mapped[str] = mapped_column(String(32), default="primary")
    month: Mapped[str] = mapped_column(String(7))
    credits: Mapped[float] = mapped_column(Float, default=0.0)
    debits: Mapped[float] = mapped_column(Float, default=0.0)
    avg_balance: Mapped[float | None] = mapped_column(Float)
    closing_balance: Mapped[float | None] = mapped_column(Float)
    inward_bounces: Mapped[int] = mapped_column(Integer, default=0)
    outward_bounces: Mapped[int] = mapped_column(Integer, default=0)
    emi_debits: Mapped[float | None] = mapped_column(Float)
    cash_deposits: Mapped[float | None] = mapped_column(Float)
    source_document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"))


class TradeLink(IdMixin, TimestampMixin, Base):
    """A directed money/invoice flow between two counterparties.

    Sourced from GSTR-2A supplier lists, GSTR-1 customer lists and bank statement
    counterparties. These rows are the transaction layer of the fraud graph.
    """

    __tablename__ = "trade_links"

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    source_name: Mapped[str] = mapped_column(String(255))
    source_gstin: Mapped[str | None] = mapped_column(String(15), index=True)
    target_name: Mapped[str] = mapped_column(String(255))
    target_gstin: Mapped[str | None] = mapped_column(String(15), index=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    invoice_count: Mapped[int] = mapped_column(Integer, default=0)
    link_type: Mapped[str] = mapped_column(String(24), default="sale")
    period: Mapped[str | None] = mapped_column(String(16))
    source: Mapped[str] = mapped_column(String(24), default="document")
