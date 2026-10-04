from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Iterable


@dataclass(slots=True)
class ProviderArticle:
    title: str
    summary: str
    url: str
    published_at: str
    publisher: str
    provider: str
    source_type: str
    relevance_score: float = 0.0
    sentiment: str = "NEUTRAL"
    sentiment_score: float = 0.0
    confidence: float = 0.0
    key_reasons: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)


class ResearchProvider(ABC):
    name: str = "base"

    @abstractmethod
    def fetch(
        self,
        *,
        company_name: str,
        sector: str,
        promoter_names: Iterable[str],
        analyst_note: str | None = None,
    ) -> list[ProviderArticle]:
        raise NotImplementedError


class NewsAPIProvider(ResearchProvider):
    name = "NewsAPI"

    def fetch(self, *, company_name: str, sector: str, promoter_names: Iterable[str], analyst_note: str | None = None) -> list[ProviderArticle]:
        prompts = [company_name, *list(promoter_names), sector]
        return [
            ProviderArticle(
                title=f"{company_name} remains under close watch after sector and policy updates",
                summary=f"{company_name} is being monitored for operating performance, customer concentration, and policy-sensitive demand changes in {sector}.",
                url="https://example.com/newsapi",
                published_at="2026-06-30",
                publisher="NewsAPI",
                provider=self.name,
                source_type="news",
                relevance_score=0.91,
                sentiment="NEUTRAL",
                sentiment_score=0.0,
                confidence=0.78,
                key_reasons=["policy updates", "demand shift", "funding conditions"],
                tags=[sector.lower(), "company-news"],
            ),
            ProviderArticle(
                title=f"{company_name} leadership commentary highlights expansion plans",
                summary="Promoter commentary and management guidance suggest a measured but constructive outlook for execution capacity.",
                url="https://example.com/newsapi-2",
                published_at="2026-06-28",
                publisher="NewsAPI",
                provider=self.name,
                source_type="news",
                relevance_score=0.84,
                sentiment="POSITIVE",
                sentiment_score=0.42,
                confidence=0.81,
                key_reasons=["expansion plans", "order book visibility"],
                tags=[sector.lower(), "leadership"],
            ),
        ]


class GoogleNewsProvider(ResearchProvider):
    name = "Google News"

    def fetch(self, *, company_name: str, sector: str, promoter_names: Iterable[str], analyst_note: str | None = None) -> list[ProviderArticle]:
        return [
            ProviderArticle(
                title=f"Sector analysts discuss {sector} outlook following regulatory commentary",
                summary=f"Analysts are focusing on demand visibility and import cost pressure in the {sector} segment.",
                url="https://example.com/google-news",
                published_at="2026-06-25",
                publisher="Google News",
                provider=self.name,
                source_type="news",
                relevance_score=0.79,
                sentiment="NEGATIVE",
                sentiment_score=-0.31,
                confidence=0.74,
                key_reasons=["input costs", "margin pressure"],
                tags=[sector.lower(), "sector"],
            )
        ]


class SerpAPIProvider(ResearchProvider):
    name = "SerpAPI"

    def fetch(self, *, company_name: str, sector: str, promoter_names: Iterable[str], analyst_note: str | None = None) -> list[ProviderArticle]:
        return [
            ProviderArticle(
                title=f"{company_name} cited in executive updates and merchant disclosures",
                summary="Search results indicate recent commentary around order execution and promoter-led capital allocation decisions.",
                url="https://example.com/serpapi",
                published_at="2026-06-22",
                publisher="SerpAPI",
                provider=self.name,
                source_type="news",
                relevance_score=0.76,
                sentiment="NEUTRAL",
                sentiment_score=0.08,
                confidence=0.7,
                key_reasons=["capital allocation", "governance"],
                tags=["governance"],
            )
        ]


class MCAProvider(ResearchProvider):
    name = "MCA"

    def fetch(self, *, company_name: str, sector: str, promoter_names: Iterable[str], analyst_note: str | None = None) -> list[ProviderArticle]:
        return [
            ProviderArticle(
                title="MCA filing watch: director changes and charge-related disclosures",
                summary="Corporate filings indicate ongoing governance and compliance activity that should be reviewed alongside the credit case.",
                url="https://example.com/mca",
                published_at="2026-06-20",
                publisher="Ministry of Corporate Affairs",
                provider=self.name,
                source_type="filing",
                relevance_score=0.73,
                sentiment="NEUTRAL",
                sentiment_score=0.0,
                confidence=0.83,
                key_reasons=["director changes", "charge disclosures"],
                tags=["regulatory"],
            )
        ]


class RBIProvider(ResearchProvider):
    name = "RBI"

    def fetch(self, *, company_name: str, sector: str, promoter_names: Iterable[str], analyst_note: str | None = None) -> list[ProviderArticle]:
        return [
            ProviderArticle(
                title="RBI policy note relevant to borrowing conditions in the sector",
                summary="RBI policy stance and liquidity conditions remain relevant to the sector's funding costs and borrower risk perception.",
                url="https://example.com/rbi",
                published_at="2026-06-18",
                publisher="Reserve Bank of India",
                provider=self.name,
                source_type="regulatory",
                relevance_score=0.69,
                sentiment="NEUTRAL",
                sentiment_score=0.0,
                confidence=0.8,
                key_reasons=["policy rates", "liquidity"],
                tags=["policy"],
            )
        ]
