"""Query planning, provider fan-out and de-duplication for secondary research."""

from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor

from ..providers.base import NewsProvider
from ..types import Article, ResearchQuery

RISK_TERMS = "(fraud OR default OR NCLT OR insolvency OR raid OR probe OR penalty OR lawsuit OR GST)"


def plan_queries(query: ResearchQuery) -> list[tuple[str, str]]:
    """Return (subject, query) pairs: company news, company risk, promoter risk."""
    name = query.company_name
    short = re.sub(r"\b(private|pvt\.?|limited|ltd\.?|llp)\b", "", name, flags=re.I).strip()
    plans = [("company", f'"{name}"'), ("company_risk", f'"{short}" {RISK_TERMS}')]
    for promoter in query.promoters[:3]:
        plans.append((f"promoter:{promoter}", f'"{promoter}" {RISK_TERMS}'))
    return plans


def _norm_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()[:90]


def collect_articles(query: ResearchQuery, providers: list[NewsProvider], *, per_query: int = 8) -> list[Article]:
    plans = plan_queries(query)
    jobs = [(p, subject, q) for p in providers for subject, q in plans]
    with ThreadPoolExecutor(max_workers=min(8, max(1, len(jobs)))) as pool:
        results = list(pool.map(lambda job: (job[1], job[0].search(job[2], limit=per_query)), jobs))

    seen: set[str] = set()
    articles: list[Article] = []
    for subject, batch in results:
        for article in batch:
            key = _norm_title(article.title)
            if key in seen:
                continue
            seen.add(key)
            article.subject = subject
            articles.append(article)
    return articles
