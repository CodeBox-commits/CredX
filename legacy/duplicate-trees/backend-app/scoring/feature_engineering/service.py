from __future__ import annotations

from dataclasses import dataclass

from ...schemas.platform import FraudAnalysisResponse, ResearchIntelligenceResponse
from ...schemas.uploads import StructuredExtraction


@dataclass(slots=True)
class CreditFeatures:
    debt_to_revenue: float
    ebitda_margin: float
    leverage_band: str
    litigation_penalty: float
    sentiment_penalty: float
    fraud_penalty: float
    analyst_penalty: float
    readiness_boost: float


def _analyst_penalty(note: str | None) -> float:
    if not note:
        return 0.0
    lowered = note.lower()
    penalty = 0.0
    if "40%" in lowered or "underutil" in lowered:
        penalty += 18
    if "inventory" in lowered:
        penalty += 8
    if "delay" in lowered or "overdue" in lowered:
        penalty += 12
    if "improved" in lowered or "strong order book" in lowered:
        penalty -= 6
    return penalty


def build_credit_features(
    extracted: StructuredExtraction | None,
    research: ResearchIntelligenceResponse | None,
    fraud: FraudAnalysisResponse | None,
    analyst_note: str | None,
) -> CreditFeatures:
    revenue = extracted.revenue if extracted and extracted.revenue else 0.0
    debt = extracted.debt if extracted and extracted.debt else 0.0
    ebitda = extracted.ebitda if extracted and extracted.ebitda else 0.0
    debt_to_revenue = debt / max(revenue, 1.0) if revenue or debt else 0.55
    ebitda_margin = ebitda / max(revenue, 1.0) if revenue and ebitda else 0.11

    leverage_band = "low"
    if debt_to_revenue > 0.8:
        leverage_band = "high"
    elif debt_to_revenue > 0.45:
        leverage_band = "medium"

    litigation_penalty = 0.0
    sentiment_penalty = 0.0
    readiness_boost = 8.0 if extracted and extracted.confidence_score >= 0.75 else 2.0

    if research is not None:
        if research.litigation_risk == "HIGH":
            litigation_penalty = 26
        elif research.litigation_risk == "MEDIUM":
            litigation_penalty = 14
        if research.promoter_sentiment == "NEGATIVE":
            sentiment_penalty = 18
        elif research.promoter_sentiment == "NEUTRAL":
            sentiment_penalty = 6
        if research.sector_outlook == "FAVORABLE":
            readiness_boost += 6
        elif research.sector_outlook == "WEAK":
            sentiment_penalty += 10

    fraud_penalty = 0.0
    if fraud is not None:
        fraud_penalty = max(fraud.fraud_risk_score * 0.28, len(fraud.suspicious_cycle_alerts) * 6)

    return CreditFeatures(
        debt_to_revenue=round(debt_to_revenue, 3),
        ebitda_margin=round(ebitda_margin, 3),
        leverage_band=leverage_band,
        litigation_penalty=litigation_penalty,
        sentiment_penalty=sentiment_penalty,
        fraud_penalty=fraud_penalty,
        analyst_penalty=_analyst_penalty(analyst_note),
        readiness_boost=readiness_boost,
    )
