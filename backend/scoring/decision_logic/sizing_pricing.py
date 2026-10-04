"""Loan sizing (min of independent methods) and risk-based pricing with an itemised build-up."""

from __future__ import annotations

from typing import Any

from config import get_settings
from scoring.feature_engineering.features import annual_debt_service, flat_financials, sorted_years

GRADES = [  # (min score, grade, risk level, credit spread %, max debt/EBITDA)
    (800, "CX1", "LOW", 0.50, 5.0),
    (760, "CX2", "LOW", 0.90, 4.75),
    (720, "CX3", "MEDIUM", 1.40, 4.5),
    (680, "CX4", "MEDIUM", 2.00, 4.25),
    (640, "CX5", "HIGH", 2.75, 4.0),
    (600, "CX6", "HIGH", 3.50, 3.5),
    (550, "CX7", "CRITICAL", 4.50, 3.0),
    (0, "CX8", "CRITICAL", 6.00, 2.0),
]
WORKING_CAPITAL_FACILITIES = {"cash credit", "working capital", "overdraft", "wcdl", "working capital demand loan"}


def grade_for(score: int) -> tuple[str, str, float, float]:
    for floor, grade, risk, spread, max_lev in GRADES:
        if score >= floor:
            return grade, risk, spread, max_lev
    return GRADES[-1][1:]  # pragma: no cover


def annuity_principal(annual_payment: float, rate_pct: float, years: float) -> float:
    r = rate_pct / 100
    if r <= 0:
        return annual_payment * years
    return annual_payment * (1 - (1 + r) ** -years) / r


def _round_lakh(value: float, step: float = 5e5) -> float:
    return max(0.0, round(value / step) * step)


def size_loan(
    financials: dict[str, Any],
    application: dict[str, Any],
    score: int,
    rate_pct: float,
    decision: str,
) -> dict[str, Any]:
    fin = flat_financials(financials)
    years = sorted_years(fin)
    cur = fin[years[0]] if years else {}
    requested = float(application.get("requested_amount") or 0)
    tenure_years = max(1.0, (application.get("tenure_months") or 60) / 12)
    facility = (application.get("facility_type") or "").lower()
    _, _, _, max_lev = grade_for(score)
    methods: list[dict[str, Any]] = [{"method": "Requested amount", "limit": requested, "basis": "Applicant request"}]

    ebitda = cur.get("ebitda")
    debt = cur.get("total_debt") or 0.0
    is_working_capital = any(k in facility for k in WORKING_CAPITAL_FACILITIES)
    if ebitda and ebitda > 0 and not is_working_capital:
        existing_ds = annual_debt_service(cur) or 0.0
        headroom = ebitda / 1.35 - existing_ds
        dscr_limit = annuity_principal(max(0.0, headroom), rate_pct, tenure_years)
        methods.append({"method": "DSCR capacity", "limit": dscr_limit,
                        "basis": f"EBITDA / 1.35x target DSCR less existing debt service, {tenure_years:.0f}-yr annuity @ {rate_pct:.2f}%"})
        methods.append({"method": "Leverage ceiling", "limit": max(0.0, max_lev * ebitda - debt),
                        "basis": f"{max_lev:.2f}x Debt/EBITDA for grade less existing debt"})
    if is_working_capital and cur.get("revenue"):
        methods.append({"method": "Turnover method (Nayak Committee)", "limit": 0.20 * cur["revenue"],
                        "basis": "20% of projected annual turnover (25% WC need less 5% promoter margin)"})
        if ebitda and ebitda > 0:
            methods.append({"method": "Leverage ceiling", "limit": max(0.0, max_lev * ebitda - debt + (cur.get("short_term_debt") or 0)),
                            "basis": f"{max_lev:.2f}x Debt/EBITDA for grade; existing WC lines assumed refinanced"})
    if application.get("collateral_value"):
        methods.append({"method": "Security cover", "limit": application["collateral_value"] / 1.25,
                        "basis": "Collateral value / 1.25x minimum security cover"})

    binding = min(methods, key=lambda m: m["limit"])
    recommended = 0.0 if decision == "DECLINE" else _round_lakh(binding["limit"])
    for m in methods:
        m["limit"] = round(m["limit"], 0)
        m["binding"] = m is binding
    return {
        "requested_amount": requested,
        "recommended_amount": recommended,
        "binding_constraint": binding["method"],
        "methods": methods,
        "tenure_months": int(tenure_years * 12),
        "utilisation_of_request": round(recommended / requested, 3) if requested else None,
    }


def price_loan(score: int, features: dict[str, float | None], application: dict[str, Any], deviations: int) -> dict[str, Any]:
    settings = get_settings()
    grade, _, spread, _ = grade_for(score)
    components = [
        {"component": "Benchmark (EBLR/MCLR)", "bps": round(settings.base_lending_rate * 100),
         "rationale": f"Bank's external benchmark lending rate (RBI repo {settings.repo_rate:.2f}%)"},
        {"component": f"Credit risk premium ({grade})", "bps": round(spread * 100), "rationale": "Grade-linked spread"},
    ]
    tenure = application.get("tenure_months") or 60
    if tenure > 84:
        components.append({"component": "Tenor premium", "bps": 35, "rationale": "Tenor beyond 7 years"})
    elif tenure > 60:
        components.append({"component": "Tenor premium", "bps": 20, "rationale": "Tenor beyond 5 years"})
    coverage = features.get("collateral_coverage")
    if coverage is not None:
        if coverage >= 1.5:
            components.append({"component": "Collateral discount", "bps": -25, "rationale": f"Security cover {coverage:.2f}x"})
        elif coverage < 1.0:
            components.append({"component": "Unsecured exposure premium", "bps": 50, "rationale": f"Security cover {coverage:.2f}x"})
    if deviations:
        components.append({"component": "Policy deviation premium", "bps": min(75, 25 * deviations),
                           "rationale": f"{deviations} policy deviation(s) approved at sanction"})
    if (features.get("fraud_score") or 0) > 40:
        components.append({"component": "Forensic risk premium", "bps": 40, "rationale": "Elevated fraud-risk score"})
    total_bps = sum(c["bps"] for c in components)
    rate = round(total_bps / 100, 2)
    return {"suggested_rate": rate, "spread_over_benchmark": round(rate - settings.base_lending_rate, 2),
            "components": components, "grade": grade}
