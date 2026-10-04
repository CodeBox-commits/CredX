"""Loan sizing with multiple, explainable methods (the most conservative binds)."""

from __future__ import annotations

from typing import Any

from extraction.normalization.schema import FinancialYearData

_WC_FACILITIES = ("working capital", "cash credit", "overdraft", "wcdl", "od")
_LEVERAGE_MULTIPLE = {"LOW": 3.75, "MEDIUM": 3.25, "HIGH": 2.25}
_SCORE_HAIRCUT = [(760, 1.0), (700, 0.9), (650, 0.75), (600, 0.55), (0, 0.3)]


def annuity_principal(annual_payment: float, rate_pct: float, years: float) -> float:
    r = rate_pct / 100
    if r <= 0:
        return annual_payment * years
    return annual_payment * (1 - (1 + r) ** -years) / r


def size_loan(
    *,
    requested: float,
    facility_type: str,
    tenure_months: int,
    year: FinancialYearData | None,
    collateral_value: float | None,
    risk_level: str,
    score: int,
    rate_pct: float,
) -> dict[str, Any]:
    methods: list[dict[str, Any]] = [{"method": "Requested amount", "amount": requested, "basis": "Applicant request"}]
    is_wc = any(k in facility_type.lower() for k in _WC_FACILITIES)
    years = max(1.0, tenure_months / 12)

    if year and year.ebitda and year.ebitda > 0:
        multiple = _LEVERAGE_MULTIPLE.get(risk_level, 2.5)
        capacity = year.ebitda * multiple - (year.total_debt or 0)
        methods.append({
            "method": "Leverage headroom",
            "amount": max(0.0, capacity),
            "basis": f"{multiple}x EBITDA less existing debt",
        })
        cads = (year.pat + (year.depreciation or 0) + (year.interest_expense or 0)) if year.pat is not None else year.ebitda * 0.75
        existing_service = (year.interest_expense or 0) + (year.long_term_debt or (year.total_debt or 0) * 0.6) / 5
        free = cads / 1.25 - existing_service
        if not is_wc:
            methods.append({
                "method": "DSCR capacity (1.25x)",
                "amount": max(0.0, annuity_principal(free, rate_pct, years)),
                "basis": f"Annuity of surplus cash accruals over {years:.0f} years at {rate_pct:.2f}%",
            })
    if is_wc and year and year.revenue:
        # Nayak Committee turnover method: 25% of projected turnover, 5% promoter margin ⇒ 20% bank finance.
        projected = year.revenue * 1.1
        methods.append({
            "method": "Turnover method (Nayak Committee)",
            "amount": max(0.0, projected * 0.20 - (year.short_term_debt or 0)),
            "basis": "20% of projected turnover less existing working-capital borrowings",
        })
    if collateral_value:
        methods.append({"method": "Collateral cover (1.25x)", "amount": collateral_value / 1.25, "basis": "Security value ÷ 1.25"})

    binding = min(methods, key=lambda m: m["amount"])
    haircut = next(h for threshold, h in _SCORE_HAIRCUT if score >= threshold)
    recommended = binding["amount"] * haircut
    recommended = round(recommended / 500_000) * 500_000  # nearest ₹5 lakh
    return {
        "methods": [{**m, "amount": round(m["amount"], 0)} for m in methods],
        "binding_method": binding["method"],
        "score_haircut": haircut,
        "recommended_amount": float(max(0, recommended)),
        "requested_amount": requested,
        "coverage_of_request": round(recommended / requested, 3) if requested else None,
    }
