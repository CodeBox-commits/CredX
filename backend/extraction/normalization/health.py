"""Coarse financial-health label derived from extracted data (shown at upload time)."""

from __future__ import annotations

from .schema import FinancialHealth, FinancialYearData, RiskIndicator

_SEVERITY_WEIGHT = {"LOW": 0.5, "MEDIUM": 1.0, "HIGH": 2.0, "CRITICAL": 3.0}


def assess_financial_health(years: list[FinancialYearData], risks: list[RiskIndicator]) -> FinancialHealth:
    risk_load = sum(_SEVERITY_WEIGHT[r.severity] for r in risks if r.code != "positive_order_book")
    points = 0.0
    evaluated = False
    if years:
        y = years[0]
        if y.revenue and y.ebitda is not None:
            evaluated = True
            margin = y.ebitda / y.revenue
            points += 2 if margin >= 0.14 else 1 if margin >= 0.08 else -1 if margin < 0.04 else 0
        if y.total_debt is not None and y.ebitda:
            evaluated = True
            lev = y.total_debt / y.ebitda if y.ebitda > 0 else 99
            points += 2 if lev <= 2.5 else 0 if lev <= 4 else -2
        elif y.total_debt is not None and y.revenue:
            evaluated = True
            points += 1 if y.total_debt / y.revenue < 0.35 else -1 if y.total_debt / y.revenue > 0.7 else 0
        if y.current_assets and y.current_liabilities:
            evaluated = True
            cr = y.current_assets / y.current_liabilities
            points += 1 if cr >= 1.33 else -1 if cr < 1.0 else 0
    points -= risk_load * 0.6
    if not evaluated and risk_load == 0:
        return "UNKNOWN"
    if points >= 2.5:
        return "STRONG"
    if points >= -1:
        return "MODERATE"
    return "STRESSED"
