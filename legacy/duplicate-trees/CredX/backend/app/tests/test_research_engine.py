from __future__ import annotations

from app.research.caching.service import ResearchCache
from app.research.summarization.service import build_research_intelligence
from app.schemas.platform import ResearchIntelligenceRequest
from app.schemas.uploads import StructuredExtraction


def test_research_intelligence_generates_structured_articles_and_timeline() -> None:
    response = build_research_intelligence(
        ResearchIntelligenceRequest(
            company_name="NorthStar Renewables Pvt Ltd",
            sector="Renewable Energy",
            promoter_names=["Asha Rao", "Kiran Mehta"],
            analyst_note="Order book remains healthy but policy changes require monitoring.",
            extracted=StructuredExtraction(
                company_name="NorthStar Renewables Pvt Ltd",
                risk_indicators=["policy change", "litigation watch"],
            ),
        )
    )

    assert response.articles
    assert response.timeline
    assert response.risk_summary
    assert response.research_score >= 0
    assert 0.0 <= response.confidence <= 1.0


def test_research_cache_reuses_computed_results() -> None:
    cache = ResearchCache(ttl_seconds=60)
    calls = 0

    def expensive_lookup() -> dict[str, int]:
        nonlocal calls
        calls += 1
        return {"value": 7}

    first = cache.get_or_compute("demo-key", expensive_lookup)
    second = cache.get_or_compute("demo-key", expensive_lookup)

    assert first == {"value": 7}
    assert second == {"value": 7}
    assert calls == 1
