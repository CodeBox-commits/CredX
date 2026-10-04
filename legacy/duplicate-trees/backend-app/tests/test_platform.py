from __future__ import annotations

from app.fraud.detection.service import build_fraud_analysis
from app.research.summarization.service import build_research_intelligence
from app.schemas.platform import (
    FraudAnalysisRequest,
    ResearchIntelligenceRequest,
)
from app.schemas.uploads import StructuredExtraction
from app.scoring.decision_logic.engine import build_credit_decision


def test_research_intelligence_handles_indian_context() -> None:
    response = build_research_intelligence(
        ResearchIntelligenceRequest(
            company_name="ABC Textiles Pvt Ltd",
            sector="Textiles",
            analyst_note="Field visit showed weak inventory movement.",
            extracted=StructuredExtraction(
                company_name="ABC Textiles Pvt Ltd",
                risk_indicators=["GST mismatch"],
            ),
        )
    )
    assert response.sector_outlook == "WEAK"
    assert response.promoter_sentiment == "NEGATIVE"


def test_fraud_analysis_flags_gst_mismatch() -> None:
    response = build_fraud_analysis(
        FraudAnalysisRequest(
            company_name="ABC Textiles Pvt Ltd",
            gstr_2a_amount=120.0,
            gstr_3b_amount=75.0,
            declared_turnover=1_000_000.0,
            bank_credits=1_600_000.0,
            supplier_gstins=["27ABCDE1234F1Z5", "29ABCDE1234F1Z5"],
            customer_gstins=["27ABCDE1234F1Z5"],
        )
    )
    assert response.fraud_risk_score >= 20
    assert response.suspicious_cycle_alerts


def test_credit_decision_returns_traceable_output() -> None:
    extracted = StructuredExtraction(
        company_name="ABC Textiles Pvt Ltd",
        revenue=120_000_000.0,
        ebitda=9_000_000.0,
        debt=68_000_000.0,
        financial_health="MODERATE",
        confidence_score=0.86,
    )
    research = build_research_intelligence(
        ResearchIntelligenceRequest(
            company_name="ABC Textiles Pvt Ltd",
            sector="Textiles",
            analyst_note="Factory operating at 40% capacity.",
            extracted=extracted,
        )
    )
    fraud = build_fraud_analysis(
        FraudAnalysisRequest(
            company_name="ABC Textiles Pvt Ltd",
            extracted=extracted,
            declared_turnover=120_000_000.0,
            bank_credits=128_000_000.0,
        )
    )
    response = build_credit_decision(
        company_name="ABC Textiles Pvt Ltd",
        sector="Textiles",
        requested_amount=25_000_000.0,
        extracted=extracted,
        research=research,
        fraud=fraud,
        analyst_note="Factory operating at 40% capacity.",
    )
    assert 300 <= response.credit_score <= 900
    assert response.factors
    assert response.top_risk_factors
