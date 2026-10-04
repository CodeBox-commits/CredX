"""Canonical, typed contract for everything the ingestion engine produces.

Every parser/extractor writes into these models, and every downstream engine
(scoring, fraud, research, CAM) reads from them. Monetary values are always
absolute INR (not lakhs/crores) after normalisation.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

DocType = Literal[
    "annual_report",
    "financial_statement",
    "gst_return",
    "bank_statement",
    "sanction_letter",
    "legal_notice",
    "mca_filing",
    "shareholding_pattern",
    "rating_report",
    "unknown",
]

FinancialHealth = Literal["STRONG", "MODERATE", "STRESSED", "UNKNOWN"]


class FieldEvidence(BaseModel):
    """Provenance for an extracted value — powers the 'why do we believe this' UI."""

    field: str
    value: Any
    confidence: float
    method: Literal["table", "line_item", "narrative", "derived", "ocr", "manual"]
    page: int | None = None
    snippet: str | None = None
    fiscal_year: str | None = None


class FinancialYearData(BaseModel):
    fiscal_year: str
    revenue: float | None = None
    ebitda: float | None = None
    depreciation: float | None = None
    interest_expense: float | None = None
    pbt: float | None = None
    pat: float | None = None
    total_assets: float | None = None
    total_liabilities: float | None = None
    current_assets: float | None = None
    current_liabilities: float | None = None
    inventory: float | None = None
    receivables: float | None = None
    payables: float | None = None
    cash: float | None = None
    net_worth: float | None = None
    total_debt: float | None = None
    short_term_debt: float | None = None
    long_term_debt: float | None = None
    cfo: float | None = None
    capex: float | None = None
    confidence: float = 0.0

    def populated(self) -> dict[str, float]:
        return {
            k: v
            for k, v in self.model_dump(exclude={"fiscal_year", "confidence"}).items()
            if v is not None
        }


class GstPeriodData(BaseModel):
    gstin: str | None = None
    period: str  # YYYY-MM, or FYxxxx for annual summaries
    gstr1_turnover: float | None = None
    gstr3b_turnover: float | None = None
    gstr2a_turnover: float | None = None
    tax_paid: float | None = None
    itc_claimed: float | None = None
    itc_available: float | None = None
    filing_delay_days: int = 0


class Counterparty(BaseModel):
    name: str
    gstin: str | None = None
    amount: float | None = None
    invoice_count: int | None = None
    role: Literal["supplier", "customer", "lender", "related_party", "unknown"] = "unknown"


class BankMonthData(BaseModel):
    month: str  # YYYY-MM
    credits: float = 0.0
    debits: float = 0.0
    avg_balance: float | None = None
    closing_balance: float | None = None
    inward_bounces: int = 0
    outward_bounces: int = 0
    emi_debits: float | None = None
    cash_deposits: float | None = None


class BankSummary(BaseModel):
    bank_name: str | None = None
    account_ref: str = "primary"
    months: list[BankMonthData] = Field(default_factory=list)
    opening_balance: float | None = None
    closing_balance: float | None = None
    total_credits: float | None = None
    total_debits: float | None = None
    bounce_count: int = 0
    overdraft_breach_days: int = 0
    counterparties: list[Counterparty] = Field(default_factory=list)


class LegalMatter(BaseModel):
    forum: str
    case_type: str
    counterparty: str | None = None
    amount: float | None = None
    status: str = "PENDING"
    reference: str | None = None
    filed_on: str | None = None
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"
    summary: str = ""


class SanctionFacility(BaseModel):
    lender: str | None = None
    facility: str
    limit: float | None = None
    interest_rate: float | None = None
    tenor_months: int | None = None
    security: str | None = None
    covenants: list[str] = Field(default_factory=list)


class Shareholder(BaseModel):
    name: str
    category: Literal["promoter", "public", "institution", "other"] = "other"
    holding_pct: float
    pledged_pct: float = 0.0


class Director(BaseModel):
    name: str
    din: str | None = None
    designation: str | None = None
    other_directorships: list[str] = Field(default_factory=list)


class MCAProfile(BaseModel):
    company_status: str | None = None
    incorporation_date: str | None = None
    authorised_capital: float | None = None
    paid_up_capital: float | None = None
    last_agm_date: str | None = None
    charges: list[dict[str, Any]] = Field(default_factory=list)
    filing_delays: int = 0


class RiskIndicator(BaseModel):
    code: str
    label: str
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    snippet: str | None = None
    page: int | None = None


class EntityProfile(BaseModel):
    company_name: str | None = None
    cin: str | None = None
    pan: str | None = None
    gstins: list[str] = Field(default_factory=list)
    directors: list[Director] = Field(default_factory=list)
    auditor: str | None = None
    registered_address: str | None = None
    financial_year: str | None = None


class ExtractedTable(BaseModel):
    page: int
    method: str
    header: list[str]
    rows: list[list[str]]
    title: str | None = None


class DocumentExtraction(BaseModel):
    """The structured JSON produced for every ingested document."""

    doc_type: DocType = "unknown"
    doc_type_confidence: float = 0.0
    classification_signals: list[str] = Field(default_factory=list)
    page_count: int = 0
    ocr_used: bool = False
    text_chars: int = 0
    unit_detected: str | None = None
    entities: EntityProfile = Field(default_factory=EntityProfile)
    financials: list[FinancialYearData] = Field(default_factory=list)
    gst: list[GstPeriodData] = Field(default_factory=list)
    counterparties: list[Counterparty] = Field(default_factory=list)
    bank: BankSummary | None = None
    legal: list[LegalMatter] = Field(default_factory=list)
    sanctions: list[SanctionFacility] = Field(default_factory=list)
    shareholding: list[Shareholder] = Field(default_factory=list)
    mca: MCAProfile | None = None
    risk_indicators: list[RiskIndicator] = Field(default_factory=list)
    evidence: list[FieldEvidence] = Field(default_factory=list)
    tables: list[ExtractedTable] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    summary: dict[str, Any] = Field(default_factory=dict)
    stage_timings_ms: dict[str, int] = Field(default_factory=dict)
