"""News/web search providers behind one interface with caching + retries.

Live providers (NewsAPI, SerpAPI, Google News RSS) are enabled with
``CREDX_LIVE_RESEARCH=true``. The offline provider serves curated intelligence
for the fictional demo portfolio so the product works without API keys — it
never fabricates news for real-world companies.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Protocol
from urllib.parse import quote_plus
from xml.etree import ElementTree

import httpx

from config import get_settings
from core.cache import get_cache
from core.logging import get_logger
from core.retry import retry_call

from ..types import Article

logger = get_logger("credx.research.providers")

_DEMO_INTEL = Path(__file__).resolve().parents[1] / "data" / "demo_intel.json"


class NewsProvider(Protocol):
    name: str

    def search(self, query: str, *, limit: int = 10) -> list[Article]: ...


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            return parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None


class NewsApiProvider:
    name = "newsapi"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def search(self, query: str, *, limit: int = 10) -> list[Article]:
        def call() -> list[Article]:
            resp = httpx.get(
                "https://newsapi.org/v2/everything",
                params={"q": query, "language": "en", "sortBy": "relevancy", "pageSize": limit},
                headers={"X-Api-Key": self.api_key},
                timeout=8,
            )
            resp.raise_for_status()
            return [
                Article(
                    title=a.get("title") or "",
                    summary=a.get("description") or "",
                    url=a.get("url"),
                    source=(a.get("source") or {}).get("name") or "NewsAPI",
                    published_at=_parse_dt(a.get("publishedAt")),
                    provider=self.name,
                )
                for a in resp.json().get("articles", [])
                if a.get("title")
            ]

        return retry_call(call, attempts=3, retry_on=(httpx.HTTPError,), label="newsapi")


class SerpApiProvider:
    name = "serpapi"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def search(self, query: str, *, limit: int = 10) -> list[Article]:
        def call() -> list[Article]:
            resp = httpx.get(
                "https://serpapi.com/search.json",
                params={"engine": "google_news", "q": query, "gl": "in", "hl": "en", "api_key": self.api_key},
                timeout=10,
            )
            resp.raise_for_status()
            return [
                Article(
                    title=r.get("title") or "",
                    summary=r.get("snippet") or "",
                    url=r.get("link"),
                    source=(r.get("source") or {}).get("name") if isinstance(r.get("source"), dict) else r.get("source") or "Google News",
                    published_at=_parse_dt(r.get("iso_date") or r.get("date")),
                    provider=self.name,
                )
                for r in resp.json().get("news_results", [])[:limit]
                if r.get("title")
            ]

        return retry_call(call, attempts=3, retry_on=(httpx.HTTPError,), label="serpapi")


class GoogleNewsRssProvider:
    """Keyless fallback (CreditMind-style): Google News RSS for India/English."""

    name = "google_news_rss"

    def search(self, query: str, *, limit: int = 10) -> list[Article]:
        def call() -> list[Article]:
            url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-IN&gl=IN&ceid=IN:en"
            resp = httpx.get(url, timeout=8, follow_redirects=True)
            resp.raise_for_status()
            root = ElementTree.fromstring(resp.content)
            items = []
            for item in root.iter("item"):
                title = (item.findtext("title") or "").strip()
                if not title:
                    continue
                source_el = item.find("source")
                items.append(
                    Article(
                        title=title,
                        summary="",
                        url=item.findtext("link"),
                        source=source_el.text if source_el is not None and source_el.text else "Google News",
                        published_at=_parse_dt(item.findtext("pubDate")),
                        provider=self.name,
                    )
                )
                if len(items) >= limit:
                    break
            return items

        return retry_call(call, attempts=2, retry_on=(httpx.HTTPError, ElementTree.ParseError), label="gnews_rss")


class OfflineIntelProvider:
    """Curated intelligence for the fictional demo portfolio (see research/data/demo_intel.json)."""

    name = "offline"

    def __init__(self) -> None:
        try:
            self._data: dict[str, list[dict]] = json.loads(_DEMO_INTEL.read_text(encoding="utf-8"))
        except FileNotFoundError:
            self._data = {}

    def search(self, query: str, *, limit: int = 10) -> list[Article]:
        q = query.lower()
        out: list[Article] = []
        for company, articles in self._data.items():
            if company.lower() not in q:
                continue
            for a in articles:
                out.append(
                    Article(
                        title=a["title"],
                        summary=a.get("summary", ""),
                        url=a.get("url"),
                        source=a.get("source", "CredX Demo Intelligence"),
                        published_at=_parse_dt(a.get("published_at")),
                        provider=self.name,
                        category_hint=a.get("category"),
                    )
                )
        return out[: max(limit, len(out))]


class CachedProvider:
    def __init__(self, inner: NewsProvider) -> None:
        self.inner = inner
        self.name = inner.name

    def search(self, query: str, *, limit: int = 10) -> list[Article]:
        cache = get_cache()
        key = "research:" + hashlib.sha1(f"{self.name}|{query}|{limit}".encode()).hexdigest()
        cached = cache.get(key)
        if cached is not None:
            return [Article.model_validate(a) for a in cached]
        try:
            articles = self.inner.search(query, limit=limit)
        except Exception as exc:  # noqa: BLE001 - research must never break the pipeline
            logger.warning("provider_failed", extra={"provider": self.name, "error": str(exc)})
            return []
        cache.set(key, [a.model_dump(mode="json") for a in articles], get_settings().research_cache_ttl_seconds)
        return articles


def active_providers() -> list[NewsProvider]:
    settings = get_settings()
    providers: list[NewsProvider] = [OfflineIntelProvider()]
    if settings.enable_live_research:
        if settings.newsapi_key:
            providers.append(CachedProvider(NewsApiProvider(settings.newsapi_key)))
        if settings.serpapi_key:
            providers.append(CachedProvider(SerpApiProvider(settings.serpapi_key)))
        providers.append(CachedProvider(GoogleNewsRssProvider()))
    return providers


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
