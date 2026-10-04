from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class NormalizedFinancials:
    company_name: str | None = None
    cin: str | None = None
    gst_number: str | None = None
    pan: str | None = None
    directors: list[str] | None = None
    auditor: str | None = None
    revenue: float | None = None
    ebitda: float | None = None
    operating_profit: float | None = None
    net_profit: float | None = None
    debt: float | None = None
    current_assets: float | None = None
    current_liabilities: float | None = None
    fixed_assets: float | None = None
    inventory: float | None = None
    cash: float | None = None
    net_worth: float | None = None
    liabilities: float | None = None
    total_assets: float | None = None
    interest_expense: float | None = None
    tax_expense: float | None = None
    loans: float | None = None
    creditors: float | None = None
    debtors: float | None = None
    financial_year: str | None = None
    risk_indicators: list[str] | None = None
    financial_health: str = "UNKNOWN"
    confidence_score: float = 0.0
    validation_warnings: list[str] | None = None
    ratios: dict[str, float] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "company_name": self.company_name,
            "cin": self.cin,
            "gst_number": self.gst_number,
            "pan": self.pan,
            "directors": self.directors,
            "auditor": self.auditor,
            "revenue": self.revenue,
            "ebitda": self.ebitda,
            "operating_profit": self.operating_profit,
            "net_profit": self.net_profit,
            "debt": self.debt,
            "current_assets": self.current_assets,
            "current_liabilities": self.current_liabilities,
            "fixed_assets": self.fixed_assets,
            "inventory": self.inventory,
            "cash": self.cash,
            "net_worth": self.net_worth,
            "liabilities": self.liabilities,
            "total_assets": self.total_assets,
            "interest_expense": self.interest_expense,
            "tax_expense": self.tax_expense,
            "loans": self.loans,
            "creditors": self.creditors,
            "debtors": self.debtors,
            "financial_year": self.financial_year,
            "risk_indicators": self.risk_indicators,
            "financial_health": self.financial_health,
            "confidence_score": self.confidence_score,
            "validation_warnings": self.validation_warnings,
            "ratios": self.ratios,
        }
