from __future__ import annotations

from collections import Counter

from ...schemas.platform import (
    ResearchArticle,
    ResearchFinding,
    ResearchIntelligenceRequest,
    ResearchIntelligenceResponse,
    ResearchRiskSummary,
    ResearchSource,
    ResearchTimelineEntry,
)
from ..aggregation.service import ResearchAggregator
from ..caching.service import ResearchCache
from ..litigation.service import assess_litigation_risk
from ..news.service import build_news_briefs
from ..providers.base import GoogleNewsProvider, MCAProvider, NewsAPIProvider, RBIProvider, SerpAPIProvider
from ..ranking.service import rank_articles
from ..sector_analysis.service import assess_sector_outlook
from ..sentiment.service import assess_promoter_sentiment


_cache = ResearchCache(ttl_seconds=300)
_default_aggregator = ResearchAggregator(
    providers=[
        NewsAPIProvider(),
        GoogleNewsProvider(),
        SerpAPIProvider(),
        MCAProvider(),
        RBIProvider(),
    ]
)


def _build_signal_summary(request: ResearchIntelligenceRequest) -> dict[str, object]:
    litigation_risk = assess_litigation_risk(request.extracted, request.analyst_note)
    promoter_sentiment = assess_promoter_sentiment(request.extracted, request.analyst_note)
    sector_outlook = assess_sector_outlook(request.sector)

    findings = [
        ResearchFinding(
            category="litigation",
            severity="high" if litigation_risk == "HIGH" else "medium" if litigation_risk == "MEDIUM" else "low",
            title="Litigation watch",
            detail="Recent legal and governance indicators suggest the need for an active litigation monitor.",
        ),
        ResearchFinding(
            category="promoter",
            severity="high" if promoter_sentiment == "NEGATIVE" else "low",
            title="Promoter intelligence",
            detail="Promoter and leadership commentary should be monitored for governance and dilution signals.",
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
            detail="MCA and RBI intelligence should remain attached to sanction review.",
        ),
    ]

    return {
        "litigation_risk": litigation_risk,
        "promoter_sentiment": promoter_sentiment,
        "sector_outlook": sector_outlook,
        "findings": findings,
    }


def build_research_intelligence(request: ResearchIntelligenceRequest) -> ResearchIntelligenceResponse:
    signal_summary = _cache.get_or_compute(
        f"research:{request.company_name.lower()}:{request.sector.lower()}",
        lambda: _build_signal_summary(request),
    )

    articles = _default_aggregator.collect(
        company_name=request.company_name,
        sector=request.sector,
        promoter_names=request.promoter_names,
        analyst_note=request.analyst_note,
    )
    ranked_articles = rank_articles(articles)
    article_count = len(ranked_articles)
    sentiment_counts = Counter(article.sentiment for article in ranked_articles)

    positive_signals = [article.title for article in ranked_articles if article.sentiment == "POSITIVE"][:3]
    negative_signals = [article.title for article in ranked_articles if article.sentiment == "NEGATIVE"][:3]

    summary = (
        f"{request.company_name} research synthesis indicates {signal_summary['litigation_risk'].lower()} litigation risk, "
        f"{signal_summary['promoter_sentiment'].lower()} promoter sentiment, and a {signal_summary['sector_outlook'].lower()} sector outlook."
    )

    source_items = [
        {"source": item.provider, "detail": f"{item.title} | {item.summary}"}
        for item in ranked_articles[:4]
    ]
    source_items.extend(
        [
            {"source": "MCA Watch", "detail": "Corporate filing, directorship, and charge registration context."},
            {"source": "RBI Sector Lens", "detail": "Sector and lender policy sensitivity relevant to Indian corporate underwriting."},
        ]
    )

    sources = [ResearchSource(source=item["source"], detail=item["detail"]) for item in source_items]

    research_articles = [
        ResearchArticle(
            headline=article.title,
            summary=article.summary,
            url=article.url,
            published_at=article.published_at,
            publisher=article.publisher,
            provider=article.provider,
            source_type=article.source_type,
            sentiment=article.sentiment,
            relevance_score=article.relevance_score,
            confidence=article.confidence,
            key_reasons=article.key_reasons,
        )
        for article in ranked_articles
    ]

    timeline = [
        ResearchTimelineEntry(
            title=article.title,
            date=article.published_at,
            detail=article.summary,
            severity="high" if article.sentiment == "NEGATIVE" else "medium" if article.sentiment == "NEUTRAL" else "low",
        )
        for article in ranked_articles[:4]
    ]

    risk_summary = ResearchRiskSummary(
        top_positive_signals=positive_signals,
        top_negative_signals=negative_signals,
        regulatory_risks=["policy sensitivity", "compliance monitoring"],
        sector_risks=["demand volatility", "margin pressure"],
        promoter_risks=["governance watch", "capital allocation monitoring"],
        legal_risks=["litigation watch"],
        sector_overview=f"{request.sector or 'General'} is being monitored for demand, pricing and funding conditions.",
        market_outlook="Moderate demand with select pockets of strength and elevated policy sensitivity.",
        industry_growth="Growth remains selective, with policy support and order-book visibility driving the most stable segments.",
        industry_risks=["input cost pressure", "regulatory change", "working-capital strain"],
        rbi_policy_impact="RBI liquidity and rate posture remain relevant to near-term funding conditions.",
        government_policy_impact="Government incentives and compliance mandates continue to influence sector sentiment.",
        news_summary=f"{article_count} research articles synthesized with {sentiment_counts.get('NEGATIVE', 0)} negative and {sentiment_counts.get('POSITIVE', 0)} positive signals.",
        overall_research_risk="MEDIUM" if article_count else "LOW",
    )

    return ResearchIntelligenceResponse(
        litigation_risk=signal_summary["litigation_risk"],
        promoter_sentiment=signal_summary["promoter_sentiment"],
        sector_outlook=signal_summary["sector_outlook"],
        summary=summary,
        findings=signal_summary["findings"],
        sources=sources,
        articles=research_articles,
        timeline=timeline,
        risk_summary=risk_summary,
        research_score=round(min(100.0, 60 + article_count * 7 + (sentiment_counts.get("NEGATIVE", 0) * 3)), 2),
        confidence=round(min(1.0, 0.65 + article_count * 0.04), 3),
    )
