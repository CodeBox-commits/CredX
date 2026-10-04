"""Risk-based pricing: base rate + transparent premium stack."""

from __future__ import annotations

from typing import Any

GRADES = [  # (min score, grade, credit spread %)
    (800, "CX1", 0.75),
    (760, "CX2", 1.15),
    (720, "CX3", 1.65),
    (680, "CX4", 2.25),
    (640, "CX5", 3.00),
    (600, "CX6", 3.90),
    (550, "CX7", 5.00),
    (0, "CX8", 6.50),
]


def grade_for(score: int) -> tuple[str, float]:
    for threshold, grade, spread in GRADES:
        if score >= threshold:
            return grade, spread
    return "CX8", 6.5


def price_loan(
    *,
    score: int,
    base_rate: float,
    tenure_months: int,
    fraud_level: str,
    collateral_cover: float | None,
    sector_outlook: str,
) -> dict[str, Any]:
    grade, spread = grade_for(score)
    components = [
        {"component": "Base rate (EBLR/MCLR proxy)", "bps": round(base_rate * 100)},
        {"component": f"Credit spread — grade {grade}", "bps": round(spread * 100)},
    ]
    if tenure_months > 60:
        components.append({"component": "Tenor premium (> 5 years)", "bps": 25})
    if fraud_level in {"MEDIUM", "HIGH"}:
        components.append({"component": "Governance / fraud-risk premium", "bps": 50 if fraud_level == "MEDIUM" else 100})
    if sector_outlook == "WEAK":
        components.append({"component": "Sector headwind premium", "bps": 25})
    if collateral_cover and collateral_cover >= 1.5:
        components.append({"component": "Collateral comfort discount", "bps": -25})
    total = sum(c["bps"] for c in components) / 100
    return {
        "grade": grade,
        "suggested_rate": round(total, 2),
        "components": components,
        "risk_premium": round(total - base_rate, 2),
    }
