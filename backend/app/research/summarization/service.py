from __future__ import annotations

from ...schemas.platform import (
    ResearchFinding,
    ResearchIntelligenceRequest,
    ResearchIntelligenceResponse,
    ResearchSource,
)
from ..litigation.service import assess_litigation_risk
from ..news.service import build_news_briefs
from ..sector_analysis.service import assess_sector_outlook
from ..sentiment.service import assess_promoter_sentiment


def build_research_intelligence(
    request: ResearchIntelligenceRequest,
) -> ResearchIntelligenceResponse:
    litigation_risk = assess_litigation_risk(request.extracted, request.analyst_note)
    promoter_sentiment = assess_promoter_sentiment(request.extracted, request.analyst_note)
    sector_outlook = assess_sector_outlook(request.sector)

    findings = [
        ResearchFinding(
            category="litigation",
            severity="high" if litigation_risk == "HIGH" else "medium" if litigation_risk == "MEDIUM" else "low",
            title="Litigation watch",
            detail="Litigation risk was inferred from uploaded evidence, analyst notes, and the India-specific legal watch layer.",
        ),
        ResearchFinding(
            category="promoter",
            severity="high" if promoter_sentiment == "NEGATIVE" else "low",
            title="Promoter intelligence",
            detail="Promoter sentiment currently reflects governance cues, related-party language, and field notes.",
        ),
        ResearchFinding(
            category="sector",
            severity="high" if sector_outlook == "WEAK" else "medium",
            title="Sector context",
            detail=f"{request.sector} has been mapped into a lending outlook aligned to RBI-sensitive underwriting posture.",
        ),
        ResearchFinding(
            category="regulatory",
            severity="medium",
            title="Regulatory overlay",
            detail="MCA filings, RBI circular sensitivity, and compliance context should remain attached to sanction review.",
        ),
    ]

    sources = [
        ResearchSource(source=item["source"], detail=item["detail"])
        for item in build_news_briefs(
            request.company_name,
            request.sector,
            request.promoter_names,
        )
    ]
    sources.extend(
        [
            ResearchSource(
                source="MCA Watch",
                detail="Corporate filing, directorship, and charge registration context.",
            ),
            ResearchSource(
                source="RBI Sector Lens",
                detail="Sector and lender policy sensitivity relevant to Indian corporate underwriting.",
            ),
        ]
    )

    summary = (
        f"{request.company_name} research synthesis indicates {litigation_risk.lower()} litigation risk, "
        f"{promoter_sentiment.lower()} promoter sentiment, and a {sector_outlook.lower()} sector outlook."
    )

    return ResearchIntelligenceResponse(
        litigation_risk=litigation_risk,
        promoter_sentiment=promoter_sentiment,
        sector_outlook=sector_outlook,
        summary=summary,
        findings=findings,
        sources=sources,
    )
