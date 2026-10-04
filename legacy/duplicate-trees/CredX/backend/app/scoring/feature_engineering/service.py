from __future__ import annotations

from dataclasses import dataclass

from ...schemas.platform import FraudAnalysisResponse, ResearchIntelligenceResponse
from ...schemas.uploads import StructuredExtraction


@dataclass(slots=True)
class CreditFeatures:
    debt_to_revenue: float
    debt_to_assets: float
    debt_to_equity: float
    current_ratio: float
    quick_ratio: float
    cash_ratio: float
    interest_coverage: float
    ebitda_margin: float
    operating_margin: float
    net_margin: float
    working_capital: float
    asset_turnover: float
    leverage_band: str
    liquidity_band: str
    profitability_band: str
    litigation_penalty: float
    sentiment_penalty: float
    fraud_penalty: float
    analyst_penalty: float
    readiness_boost: float
    evidence_score: float
    financial_health_score: float


def _safe_ratio(numerator: float, denominator: float, *, default: float = 0.0) -> float:
    if denominator <= 0:
        if numerator <= 0:
            return default
        return 999.0
    return round(numerator / denominator, 3)


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
    revenue = float(extracted.revenue or 0.0) if extracted and extracted.revenue is not None else 0.0
    debt = float(extracted.debt or 0.0) if extracted and extracted.debt is not None else 0.0
    ebitda = float(extracted.ebitda or 0.0) if extracted and extracted.ebitda is not None else 0.0
    operating_profit = float(extracted.operating_profit or 0.0) if extracted and extracted.operating_profit is not None else 0.0
    net_profit = float(extracted.net_profit or 0.0) if extracted and extracted.net_profit is not None else 0.0
    liabilities = float(extracted.liabilities or 0.0) if extracted and extracted.liabilities is not None else 0.0
    current_assets = float(extracted.current_assets or 0.0) if extracted and extracted.current_assets is not None else 0.0
    current_liabilities = float(extracted.current_liabilities or 0.0) if extracted and extracted.current_liabilities is not None else 0.0
    fixed_assets = float(extracted.fixed_assets or 0.0) if extracted and extracted.fixed_assets is not None else 0.0
    inventory = float(extracted.inventory or 0.0) if extracted and extracted.inventory is not None else 0.0
    cash = float(extracted.cash or 0.0) if extracted and extracted.cash is not None else 0.0
    net_worth = float(extracted.net_worth or 0.0) if extracted and extracted.net_worth is not None else 0.0
    total_assets = float(extracted.total_assets or 0.0) if extracted and extracted.total_assets is not None else 0.0
    interest_expense = float(extracted.interest_expense or 0.0) if extracted and extracted.interest_expense is not None else 0.0

    debt_to_revenue = _safe_ratio(debt, revenue, default=0.55 if revenue or debt else 0.0)
    debt_to_assets = _safe_ratio(debt, total_assets or fixed_assets or max(revenue, 1.0), default=0.0 if not debt else 0.7)
    debt_to_equity = _safe_ratio(debt, net_worth or max(revenue, 1.0), default=0.0 if not debt else 1.2)
    current_ratio = _safe_ratio(current_assets, current_liabilities, default=1.0)
    quick_ratio = _safe_ratio(current_assets - inventory, current_liabilities, default=0.7)
    cash_ratio = _safe_ratio(cash, current_liabilities, default=0.2)
    interest_coverage = _safe_ratio(ebitda, interest_expense, default=999.0 if ebitda else 0.0)
    ebitda_margin = _safe_ratio(ebitda, revenue, default=0.1 if revenue else 0.0)
    operating_margin = _safe_ratio(operating_profit, revenue, default=0.0)
    net_margin = _safe_ratio(net_profit, revenue, default=0.0)
    working_capital = current_assets - current_liabilities
    asset_turnover = _safe_ratio(revenue, total_assets or max(revenue, 1.0), default=0.0)

    leverage_band = "low"
    if debt_to_revenue > 0.9 or debt_to_assets > 0.6:
        leverage_band = "high"
    elif debt_to_revenue > 0.45 or debt_to_assets > 0.35:
        leverage_band = "medium"

    liquidity_band = "strong"
    if current_ratio < 1.0 or quick_ratio < 0.7:
        liquidity_band = "weak"
    elif current_ratio < 1.5 or quick_ratio < 1.0:
        liquidity_band = "moderate"

    profitability_band = "strong"
    if ebitda_margin < 0.06 or net_margin < 0.0:
        profitability_band = "weak"
    elif ebitda_margin < 0.1 or net_margin < 0.03:
        profitability_band = "moderate"

    litigation_penalty = 0.0
    sentiment_penalty = 0.0
    readiness_boost = 3.0
    evidence_score = 0.5

    if extracted is not None:
        evidence_score = min(1.0, max(0.0, extracted.confidence_score))
        if extracted.financial_health == "STRONG":
            readiness_boost += 8
            evidence_score += 0.15
        elif extracted.financial_health == "MODERATE":
            readiness_boost += 4
        elif extracted.financial_health == "STRESSED":
            readiness_boost -= 8
            evidence_score -= 0.2
        if evidence_score < 0.0:
            evidence_score = 0.0
        if evidence_score > 1.0:
            evidence_score = 1.0

    if research is not None:
        if research.litigation_risk == "HIGH":
            litigation_penalty = 24.0
        elif research.litigation_risk == "MEDIUM":
            litigation_penalty = 12.0
        if research.promoter_sentiment == "NEGATIVE":
            sentiment_penalty = 18.0
        elif research.promoter_sentiment == "NEUTRAL":
            sentiment_penalty = 6.0
        if research.sector_outlook == "FAVORABLE":
            readiness_boost += 6
        elif research.sector_outlook == "WEAK":
            sentiment_penalty += 8

    fraud_penalty = 0.0
    if fraud is not None:
        fraud_penalty = max(fraud.fraud_risk_score * 0.3, len(fraud.suspicious_cycle_alerts) * 6.0)

    analyst_penalty = _analyst_penalty(analyst_note)

    if liabilities and current_liabilities and liabilities > current_liabilities * 1.3:
        readiness_boost -= 3

    return CreditFeatures(
        debt_to_revenue=round(debt_to_revenue, 3),
        debt_to_assets=round(debt_to_assets, 3),
        debt_to_equity=round(debt_to_equity, 3),
        current_ratio=round(current_ratio, 3),
        quick_ratio=round(quick_ratio, 3),
        cash_ratio=round(cash_ratio, 3),
        interest_coverage=round(interest_coverage, 3),
        ebitda_margin=round(ebitda_margin, 3),
        operating_margin=round(operating_margin, 3),
        net_margin=round(net_margin, 3),
        working_capital=round(working_capital, 3),
        asset_turnover=round(asset_turnover, 3),
        leverage_band=leverage_band,
        liquidity_band=liquidity_band,
        profitability_band=profitability_band,
        litigation_penalty=litigation_penalty,
        sentiment_penalty=sentiment_penalty,
        fraud_penalty=fraud_penalty,
        analyst_penalty=analyst_penalty,
        readiness_boost=readiness_boost,
        evidence_score=round(evidence_score, 3),
        financial_health_score=round(0.45 + (0.2 if extracted and extracted.financial_health == "STRONG" else 0.1 if extracted and extracted.financial_health == "MODERATE" else 0.0) + evidence_score * 0.35, 3),
    )
