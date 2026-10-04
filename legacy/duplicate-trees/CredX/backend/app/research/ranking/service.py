from __future__ import annotations

from ..providers.base import ProviderArticle


def score_article(article: ProviderArticle) -> float:
    sentiment_weight = {
        "POSITIVE": 0.2,
        "NEUTRAL": 0.0,
        "NEGATIVE": -0.35,
    }.get(article.sentiment, 0.0)
    return round(article.relevance_score + sentiment_weight + article.confidence * 0.15, 3)


def rank_articles(articles: list[ProviderArticle]) -> list[ProviderArticle]:
    ranked = sorted(articles, key=lambda article: score_article(article), reverse=True)
    for article in ranked:
        article.relevance_score = score_article(article)
    return ranked
