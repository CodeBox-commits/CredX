from __future__ import annotations


def build_news_briefs(company_name: str, sector: str, promoter_names: list[str]) -> list[dict[str, object]]:
    promoter_phrase = promoter_names[0] if promoter_names else f"{company_name} promoters"
    return [
        {
            "source": "News Watch",
            "detail": f"{company_name} remains exposed to sector sentiment shifts in {sector.lower()}.",
            "headline": f"{company_name} under sector sentiment watch",
            "url": "https://example.com/news-watch",
            "published_at": "2026-06-30",
            "publisher": "CredX Research",
            "sentiment": "NEUTRAL",
            "relevance_score": 0.82,
            "confidence": 0.74,
            "key_reasons": ["sector sentiment", "policy sensitivity"],
        },
        {
            "source": "Promoter Watch",
            "detail": f"{promoter_phrase} should be checked for governance, dilution, and related-party headlines.",
            "headline": f"Promoter watch for {company_name}",
            "url": "https://example.com/promoter-watch",
            "published_at": "2026-06-28",
            "publisher": "CredX Research",
            "sentiment": "NEUTRAL",
            "relevance_score": 0.79,
            "confidence": 0.72,
            "key_reasons": ["governance", "dilution risk"],
        },
    ]
