"""Research intelligence engine façade."""

from __future__ import annotations

import re
from collections import defaultdict

from extraction.normalization.schema import Director, LegalMatter, MCAProfile

from .litigation.analyzer import classify_litigation, litigation_findings, litigation_risk
from .mca.analyzer import mca_findings
from .news.collector import collect_articles
from .providers.base import NewsProvider, active_providers
from .sector_analysis.knowledge_base import sector_profile
from .sentiment.analyzer import score_text
from .summarization.summarizer import summarise
from .types import Article, Finding, Level, Outlook, ResearchQuery, ResearchResult, Sentiment

_REGULATORY = re.compile(r"\brbi\b|\bsebi\b|regulator|penalt|licen[cs]e (?:cancel|suspend)|ministry|pollution control|dggi", re.I)
_FRAUD = re.compile(r"fraud|scam|circular trading|fake invoice|bogus|round[- ]tripping|siphon|diversion of funds", re.I)
_SEV_RANK = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


def _article_to_finding(article: Article, company: str) -> Finding:
    text = f"{article.title}. {article.summary}"
    score, label = score_text(text)
    lit = classify_litigation(text)
    if article.category_hint in {"news", "litigation", "regulatory", "mca", "sector", "promoter", "fraud"}:
        category = article.category_hint
    elif lit:
        category = "litigation"
    elif _FRAUD.search(text):
        category = "fraud"
    elif _REGULATORY.search(text):
        category = "regulatory"
    elif (article.subject or "").startswith("promoter:"):
        category = "promoter"
    else:
        category = "news"

    severity: Level = "LOW"
    if lit:
        severity = lit[1]
    elif category == "fraud":
        severity = "HIGH" if score < -0.2 else "MEDIUM"
    elif score < -0.45:
        severity = "HIGH"
    elif score < -0.15:
        severity = "MEDIUM"

    short = re.sub(r"\b(private|pvt\.?|limited|ltd\.?)\b", "", company, flags=re.I).strip().lower()
    relevance = 1.0 if short and short in article.title.lower() else 0.75 if article.subject != "company" else 0.55
    entities = [company] + ([article.subject.split(":", 1)[1]] if article.subject and ":" in article.subject else [])
    return Finding(
        category=category,  # type: ignore[arg-type]
        title=article.title,
        summary=article.summary or article.title,
        source_name=article.source,
        url=article.url,
        published_at=article.published_at,
        sentiment=label,  # type: ignore[arg-type]
        sentiment_score=score,
        severity=severity,
        relevance=relevance,
        entities=entities,
        tags=[lit[0]] if lit else [],
        provider=article.provider,
    )


def _aggregate_sentiment(findings: list[Finding]) -> Sentiment:
    scored = [(f.sentiment_score, f.relevance) for f in findings if f.category not in {"sector", "mca"}]
    if not scored:
        return "NEUTRAL"
    weighted = sum(s * w for s, w in scored) / sum(w for _, w in scored)
    negatives = sum(1 for f in findings if f.sentiment == "NEGATIVE" and _SEV_RANK[f.severity] >= 3)
    if weighted < -0.12 or negatives >= 2:
        return "NEGATIVE"
    if weighted > 0.12:
        return "POSITIVE"
    return "NEUTRAL"


def _sentiment_timeline(findings: list[Finding]) -> list[dict]:
    buckets: dict[str, list[float]] = defaultdict(list)
    for f in findings:
        if f.published_at and f.category != "sector":
            buckets[f.published_at.strftime("%Y-%m")].append(f.sentiment_score)
    return [
        {"month": month, "score": round(sum(v) / len(v), 3), "count": len(v)}
        for month, v in sorted(buckets.items())
    ]


def run_research(
    query: ResearchQuery,
    *,
    legal_matters: list[LegalMatter] | None = None,
    mca: MCAProfile | None = None,
    directors: list[Director] | None = None,
    incorporation_year: int | None = None,
    providers: list[NewsProvider] | None = None,
) -> ResearchResult:
    providers = providers if providers is not None else active_providers()
    articles = collect_articles(query, providers)
    findings = [_article_to_finding(a, query.company_name) for a in articles]
    findings.extend(litigation_findings(legal_matters or []))
    mca_items, mca_level = mca_findings(mca, directors or [], incorporation_year)
    findings.extend(mca_items)

    sector = sector_profile(query.sector)
    sector_news = [f for f in findings if f.category == "sector"]
    outlook: Outlook = sector["outlook"]
    if sum(1 for f in sector_news if f.sentiment == "NEGATIVE") >= 2 and outlook == "STABLE":
        outlook = "WEAK"
    findings.append(
        Finding(
            category="sector",
            title=f"{sector['label']} sector outlook: {outlook.title()}",
            summary="Headwinds: " + "; ".join(sector["headwinds"][:2]) + ". Tailwinds: " + "; ".join(sector["tailwinds"][:2]) + ".",
            source_name="CredX sector knowledge base",
            sentiment="NEGATIVE" if outlook == "WEAK" else "POSITIVE" if outlook == "FAVORABLE" else "NEUTRAL",
            sentiment_score=-0.3 if outlook == "WEAK" else 0.3 if outlook == "FAVORABLE" else 0.0,
            severity="MEDIUM" if outlook == "WEAK" else "LOW",
            relevance=0.8,
            tags=sector["rbi_references"][:2],
            provider="knowledge_base",
        )
    )

    lit_level = litigation_risk(findings)
    sentiment = _aggregate_sentiment(findings)
    regulatory_items = [f for f in findings if f.category == "regulatory"]
    regulatory: Level = max((f.severity for f in regulatory_items), key=lambda s: _SEV_RANK[s], default="LOW")

    score = (
        {"LOW": 0, "MEDIUM": 15, "HIGH": 30, "CRITICAL": 40}[lit_level]
        + {"NEGATIVE": 20, "NEUTRAL": 6, "POSITIVE": 0}[sentiment]
        + {"WEAK": 15, "STABLE": 7, "FAVORABLE": 0}[outlook]
        + {"LOW": 0, "MEDIUM": 8, "HIGH": 15, "CRITICAL": 20}[regulatory]
        + {"LOW": 0, "MEDIUM": 6, "HIGH": 12, "CRITICAL": 15}[mca_level]
        + min(10, 4 * sum(1 for f in findings if f.category == "fraud"))
    )
    summary, key_points = summarise(
        query.company_name, findings, litigation=lit_level, sentiment=sentiment, outlook=outlook,
        regulatory=regulatory, sector_label=sector["label"],
    )
    findings.sort(key=lambda f: (-_SEV_RANK[f.severity], -(f.published_at.timestamp() if f.published_at else 0)))
    return ResearchResult(
        findings=findings,
        litigation_risk=lit_level,
        promoter_sentiment=sentiment,
        sector_outlook=outlook,
        regulatory_risk=regulatory,
        mca_risk=mca_level,
        external_risk_score=float(min(100, score)),
        summary=summary,
        key_points=key_points,
        sector_context=sector,
        sentiment_timeline=_sentiment_timeline(findings),
        providers=sorted({p.name for p in providers} | {"documents", "knowledge_base"}),
    )
