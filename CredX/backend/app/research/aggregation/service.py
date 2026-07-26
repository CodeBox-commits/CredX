from __future__ import annotations

from collections import Counter
from typing import Iterable

from ..providers.base import ProviderArticle, ResearchProvider


class ResearchAggregator:
    def __init__(self, providers: Iterable[ResearchProvider] | None = None) -> None:
        self.providers = list(providers or [])

    def collect(self, *, company_name: str, sector: str, promoter_names: Iterable[str], analyst_note: str | None = None) -> list[ProviderArticle]:
        articles: list[ProviderArticle] = []
        for provider in self.providers:
            articles.extend(provider.fetch(company_name=company_name, sector=sector, promoter_names=promoter_names, analyst_note=analyst_note))
        return sorted(articles, key=lambda article: article.relevance_score, reverse=True)[:8]

    def rank(self, articles: Iterable[ProviderArticle]) -> list[ProviderArticle]:
        ranked = sorted(list(articles), key=lambda article: (article.relevance_score, article.confidence), reverse=True)
        return ranked

    def summarize(self, articles: Iterable[ProviderArticle]) -> dict[str, object]:
        articles_list = list(articles)
        counts = Counter(article.sentiment for article in articles_list)
        return {
            "article_count": len(articles_list),
            "sentiment_counts": dict(counts),
            "top_sources": [article.provider for article in articles_list[:3]],
        }
