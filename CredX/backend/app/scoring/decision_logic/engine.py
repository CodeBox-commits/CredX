from __future__ import annotations

from ...schemas.platform import CreditDecisionResponse, DecisionFactor
from ...schemas.uploads import StructuredExtraction
from ..explainability.service import build_factor_trace
from ..feature_engineering.service import build_credit_features


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def build_credit_decision(
    *,
    company_name: str,
    sector: str,
    requested_amount: float,
    extracted: StructuredExtraction | None,
    research,
    fraud,
    analyst_note: str | None,
) -> CreditDecisionResponse:
    features = build_credit_features(extracted, research, fraud, analyst_note)
    revenue = extracted.revenue if extracted and extracted.revenue is not None else requested_amount * 5
    if revenue <= 0:
        revenue = requested_amount * 5 if requested_amount > 0 else 1.0

    raw_score = 620.0
    raw_score += 32.0 if features.leverage_band == "low" else -8.0 if features.leverage_band == "medium" else -44.0
    raw_score += 24.0 if features.profitability_band == "strong" else 8.0 if features.profitability_band == "moderate" else -30.0
    raw_score += 14.0 if features.liquidity_band == "strong" else 4.0 if features.liquidity_band == "moderate" else -24.0
    raw_score += 14.0 if features.interest_coverage >= 4.0 else 6.0 if features.interest_coverage >= 2.0 else -20.0
    raw_score += max(-12.0, min(14.0, (features.evidence_score - 0.5) * 24.0))
    raw_score += features.readiness_boost * 0.6
    raw_score -= max(0.0, features.fraud_penalty * 0.18)
    raw_score -= max(0.0, features.litigation_penalty * 0.2)
    raw_score -= max(0.0, features.sentiment_penalty * 0.18)
    raw_score -= max(0.0, features.analyst_penalty * 0.3)

    five_cs = {
        "character": round(_clamp(80 - features.litigation_penalty * 0.16 - features.sentiment_penalty * 0.14 - max(0.0, features.analyst_penalty * 0.08) + features.readiness_boost * 0.3, 25, 92), 1),
        "capacity": round(_clamp(76 + features.current_ratio * 4.0 + max(0.0, features.interest_coverage * 2.4) - max(0.0, features.debt_to_revenue * 16.0) - features.fraud_penalty * 0.08, 20, 92), 1),
        "capital": round(_clamp(74 + (16 if features.leverage_band == "low" else 4 if features.leverage_band == "medium" else -24) + features.financial_health_score * 8.0, 18, 92), 1),
        "collateral": round(_clamp(70 + min(8.0, features.cash_ratio * 6.0) - max(0.0, features.debt_to_assets * 18.0) - features.fraud_penalty * 0.11, 25, 88), 1),
        "conditions": round(_clamp(74 + features.readiness_boost * 0.8 + (6 if features.profitability_band == "strong" else 2 if features.profitability_band == "moderate" else -6) - features.analyst_penalty * 0.12, 24, 90), 1),
    }

    factor_trace = [
        DecisionFactor(
            label="Leverage profile",
            impact="positive" if features.leverage_band == "low" else "negative",
            contribution=32.0 if features.leverage_band == "low" else -8.0 if features.leverage_band == "medium" else -44.0,
            detail=(
                f"Debt-to-revenue is {features.debt_to_revenue:.2f}x and debt-to-assets is {features.debt_to_assets:.2f}; "
                f"this drives the balance-sheet risk posture."
            ),
        ),
        DecisionFactor(
            label="Profitability resilience",
            impact="positive" if features.profitability_band == "strong" else "negative",
            contribution=24.0 if features.profitability_band == "strong" else 8.0 if features.profitability_band == "moderate" else -30.0,
            detail=(
                f"EBITDA margin is {features.ebitda_margin:.1%} and net margin is {features.net_margin:.1%}; "
                f"these determine operating durability."
            ),
        ),
        DecisionFactor(
            label="Liquidity headroom",
            impact="positive" if features.liquidity_band == "strong" else "negative",
            contribution=14.0 if features.liquidity_band == "strong" else 4.0 if features.liquidity_band == "moderate" else -24.0,
            detail=(
                f"Current ratio is {features.current_ratio:.2f} and quick ratio is {features.quick_ratio:.2f}; "
                f"cash conversion is therefore {features.liquidity_band}."
            ),
        ),
        DecisionFactor(
            label="Debt service coverage",
            impact="positive" if features.interest_coverage >= 2.0 else "negative",
            contribution=14.0 if features.interest_coverage >= 4.0 else 6.0 if features.interest_coverage >= 2.0 else -20.0,
            detail=f"Interest coverage is {features.interest_coverage:.2f}x, which shapes servicing capacity.",
        ),
        DecisionFactor(
            label="External intelligence",
            impact="negative" if features.litigation_penalty + features.sentiment_penalty > 10 else "positive",
            contribution=-(features.litigation_penalty * 0.2 + features.sentiment_penalty * 0.18),
            detail=f"Sector {sector} signals, litigation and promoter sentiment were incorporated into the risk view.",
        ),
        DecisionFactor(
            label="Fraud watch",
            impact="negative" if features.fraud_penalty > 0 else "positive",
            contribution=-features.fraud_penalty * 0.18,
            detail="GST consistency, cycle alerts, and linked-party signals strengthen the fraud posture.",
        ),
        DecisionFactor(
            label="Analyst override",
            impact="negative" if features.analyst_penalty > 0 else "positive",
            contribution=-features.analyst_penalty * 0.3,
            detail="Field observations and analyst notes directly adjust the recommendation trace.",
        ),
        DecisionFactor(
            label="Evidence confidence",
            impact="positive",
            contribution=max(-8.0, min(12.0, features.readiness_boost * 0.6)),
            detail="Higher extraction confidence and stronger evidence coverage improve score confidence bands.",
        ),
    ]

    raw_score += sum(factor.contribution for factor in factor_trace)
    credit_score = int(round(_clamp(raw_score, 300, 900)))
    approval_probability = round(_clamp((credit_score - 300) / 600, 0.08, 0.97), 2)

    risk_level = "LOW"
    if credit_score < 670:
        risk_level = "HIGH"
    elif credit_score < 760:
        risk_level = "MEDIUM"

    decision = "APPROVE"
    if credit_score < 660:
        decision = "REJECT"
    elif credit_score < 740:
        decision = "CONDITIONAL APPROVAL"

    revenue_cap = max(revenue * 0.25, requested_amount * 0.55)
    if score_band := "strong" if credit_score >= 740 else "conditional" if credit_score >= 660 else "weak":
        recommendation_multiplier = 0.90 if score_band == "strong" else 0.70 if score_band == "conditional" else 0.24
    else:
        recommendation_multiplier = 0.24
    recommended_loan_amount = round(
        min(requested_amount or revenue_cap, revenue_cap) * recommendation_multiplier,
        2,
    )

    base_rate = 8.8
    risk_premium = 0.0 if risk_level == "LOW" else 1.4 if risk_level == "MEDIUM" else 3.8
    suggested_interest_rate = round(
        base_rate + risk_premium + max(0.0, min(1.2, features.debt_to_revenue * 0.8)) + min(features.fraud_penalty * 0.02, 1.2),
        2,
    )

    sorted_factors = build_factor_trace(factor_trace)
    top_risk_factors = [
        factor.label for factor in sorted_factors if factor.impact == "negative"
    ][:4]

    pricing_rationale = (
        f"CredX priced {company_name} at {suggested_interest_rate}% by combining leverage, "
        f"profitability, liquidity, debt service, and fraud signals into a transparent committee-ready view."
    )

    return CreditDecisionResponse(
        credit_score=credit_score,
        risk_level=risk_level,
        approval_probability=approval_probability,
        recommended_loan_amount=recommended_loan_amount,
        suggested_interest_rate=suggested_interest_rate,
        decision=decision,
        top_risk_factors=top_risk_factors,
        factors=sorted_factors,
        five_cs=five_cs,
        pricing_rationale=pricing_rationale,
    )
