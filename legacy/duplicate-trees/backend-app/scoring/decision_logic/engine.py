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
    revenue = extracted.revenue if extracted and extracted.revenue else requested_amount * 5
    debt = extracted.debt if extracted and extracted.debt else revenue * 0.48

    five_cs = {
        "character": round(_clamp(82 - features.litigation_penalty - features.sentiment_penalty * 0.4, 25, 92), 1),
        "capacity": round(_clamp(80 - features.analyst_penalty * 0.6 - (22 if features.ebitda_margin < 0.08 else 8), 20, 92), 1),
        "capital": round(_clamp(78 - (26 if features.leverage_band == "high" else 12 if features.leverage_band == "medium" else 0), 18, 92), 1),
        "collateral": round(_clamp(70 - features.fraud_penalty * 0.12, 25, 88), 1),
        "conditions": round(_clamp(74 + features.readiness_boost - features.sentiment_penalty * 0.35, 24, 90), 1),
    }

    factor_trace = [
        DecisionFactor(
            label="Leverage profile",
            impact="negative" if features.leverage_band != "low" else "positive",
            contribution=-58.0 if features.leverage_band == "high" else -28.0 if features.leverage_band == "medium" else 16.0,
            detail=f"Debt-to-revenue ratio currently sits at {features.debt_to_revenue:.2f}x.",
        ),
        DecisionFactor(
            label="Profitability resilience",
            impact="negative" if features.ebitda_margin < 0.1 else "positive",
            contribution=-34.0 if features.ebitda_margin < 0.08 else -16.0 if features.ebitda_margin < 0.12 else 14.0,
            detail=f"EBITDA margin inferred at {features.ebitda_margin:.1%}.",
        ),
        DecisionFactor(
            label="External intelligence",
            impact="negative" if features.litigation_penalty + features.sentiment_penalty > 10 else "positive",
            contribution=-(features.litigation_penalty + features.sentiment_penalty),
            detail=f"Sector {sector} and promoter/litigation cues were layered into the score.",
        ),
        DecisionFactor(
            label="Fraud watch",
            impact="negative" if features.fraud_penalty > 0 else "positive",
            contribution=-features.fraud_penalty,
            detail="GST consistency and relationship graph alerts were incorporated into the risk posture.",
        ),
        DecisionFactor(
            label="Analyst override",
            impact="negative" if features.analyst_penalty > 0 else "positive",
            contribution=-features.analyst_penalty,
            detail="Field and analyst observations directly adjust the recommendation trace.",
        ),
        DecisionFactor(
            label="Evidence confidence",
            impact="positive",
            contribution=features.readiness_boost,
            detail="Higher extraction confidence and broader evidence coverage improve confidence bands.",
        ),
    ]

    raw_score = 760 + sum(factor.contribution for factor in factor_trace)
    credit_score = int(round(_clamp(raw_score, 300, 900)))
    approval_probability = round(_clamp((credit_score - 300) / 600, 0.08, 0.97), 2)

    risk_level = "LOW"
    if credit_score < 680:
        risk_level = "HIGH"
    elif credit_score < 750:
        risk_level = "MEDIUM"

    decision = "APPROVE"
    if credit_score < 660:
        decision = "REJECT"
    elif credit_score < 735:
        decision = "CONDITIONAL APPROVAL"

    revenue_cap = max(revenue * 0.22, requested_amount * 0.55)
    recommendation_multiplier = 0.92 if decision == "APPROVE" else 0.68 if decision == "CONDITIONAL APPROVAL" else 0.0
    recommended_loan_amount = round(
        min(requested_amount or revenue_cap, revenue_cap) * recommendation_multiplier,
        2,
    )

    base_rate = 9.4
    risk_premium = 0.0 if risk_level == "LOW" else 1.8 if risk_level == "MEDIUM" else 3.4
    suggested_interest_rate = round(base_rate + risk_premium + min(features.fraud_penalty * 0.03, 1.1), 2)

    sorted_factors = build_factor_trace(factor_trace)
    top_risk_factors = [
        factor.label for factor in sorted_factors if factor.impact == "negative"
    ][:4]

    pricing_rationale = (
        f"CredX priced {company_name} at {suggested_interest_rate}% by combining leverage, "
        f"profitability, external intelligence, and fraud watch outputs into one committee-ready trace."
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
