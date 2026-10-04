"""News/web research providers behind one interface, with caching and retries.

Live:     NewsAPI (key), SerpAPI Google News (key), Google News RSS (no key).
Offline:  DemoIntelProvider — curated *fictional* intelligence for the seeded demo companies so
          the demo is deterministic and works without internet. Never used for real borrowers.
"""

from __future__ import annotations

import urllib.parse
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Protocol

import httpx

from config import get_settings
from core.cache import get_cache
from core.logging import get_logger
from core.retry import retry

log = get_logger("credx.research.providers")


@dataclass
class Article:
    title: str
    snippet: str
    url: str | None
    source: str
    published_at: str | None  # ISO
    provider: str
    query: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


class ResearchProvider(Protocol):
    name: str

    def available(self) -> bool: ...
    def search(self, query: str, limit: int = 10) -> list[Article]: ...


def _iso(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC).isoformat()
    except ValueError:
        try:
            return parsedate_to_datetime(value).astimezone(UTC).isoformat()
        except (TypeError, ValueError):
            return None


class _HttpProvider:
    name = "http"

    def __init__(self) -> None:
        self.settings = get_settings()

    def _cached(self, query: str, limit: int, fetch) -> list[Article]:
        cache = get_cache()
        key = cache.make_key(f"research:{self.name}", query, limit)
        if (hit := cache.get_json(key)) is not None:
            return [Article(**a) for a in hit]
        articles = fetch()
        cache.set_json(key, [a.to_dict() for a in articles], self.settings.research_cache_ttl_s)
        return articles


class NewsApiProvider(_HttpProvider):
    name = "newsapi"

    def available(self) -> bool:
        return bool(self.settings.newsapi_key)

    @retry(attempts=3, retry_on=(httpx.HTTPError,))
    def _fetch(self, query: str, limit: int) -> list[Article]:
        resp = httpx.get(
            "https://newsapi.org/v2/everything",
            params={"q": query, "language": "en", "sortBy": "relevancy", "pageSize": limit},
            headers={"X-Api-Key": self.settings.newsapi_key or ""},
            timeout=self.settings.research_timeout_s,
        )
        resp.raise_for_status()
        return [
            Article(a.get("title") or "", a.get("description") or "", a.get("url"), (a.get("source") or {}).get("name") or "NewsAPI",
                    _iso(a.get("publishedAt")), self.name, query)
            for a in resp.json().get("articles", [])
        ]

    def search(self, query: str, limit: int = 10) -> list[Article]:
        return self._cached(query, limit, lambda: self._fetch(query, limit))


class SerpApiProvider(_HttpProvider):
    name = "serpapi"

    def available(self) -> bool:
        return bool(self.settings.serpapi_key)

    @retry(attempts=3, retry_on=(httpx.HTTPError,))
    def _fetch(self, query: str, limit: int) -> list[Article]:
        resp = httpx.get(
            "https://serpapi.com/search.json",
            params={"engine": "google_news", "q": query, "gl": "in", "hl": "en", "api_key": self.settings.serpapi_key},
            timeout=self.settings.research_timeout_s,
        )
        resp.raise_for_status()
        out = []
        for r in resp.json().get("news_results", [])[:limit]:
            out.append(Article(r.get("title") or "", r.get("snippet") or "", r.get("link"),
                               (r.get("source") or {}).get("name") if isinstance(r.get("source"), dict) else str(r.get("source") or "Google News"),
                               _iso(r.get("iso_date") or r.get("date")), self.name, query))
        return out

    def search(self, query: str, limit: int = 10) -> list[Article]:
        return self._cached(query, limit, lambda: self._fetch(query, limit))


class GoogleNewsRssProvider(_HttpProvider):
    name = "google_news_rss"

    def available(self) -> bool:
        return self.settings.research_live

    @retry(attempts=2, retry_on=(httpx.HTTPError,))
    def _fetch(self, query: str, limit: int) -> list[Article]:
        import feedparser

        url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": query, "hl": "en-IN", "gl": "IN", "ceid": "IN:en"})
        resp = httpx.get(url, timeout=self.settings.research_timeout_s, follow_redirects=True)
        resp.raise_for_status()
        feed = feedparser.parse(resp.text)
        out = []
        for e in feed.entries[:limit]:
            source = getattr(getattr(e, "source", None), "title", None) or "Google News"
            out.append(Article(e.get("title", ""), "", e.get("link"), source, _iso(e.get("published")), self.name, query))
        return out

    def search(self, query: str, limit: int = 10) -> list[Article]:
        return self._cached(query, limit, lambda: self._fetch(query, limit))


def live_providers() -> list[ResearchProvider]:
    return [p for p in (NewsApiProvider(), SerpApiProvider(), GoogleNewsRssProvider()) if p.available()]
