"""Secondary research orchestration.

queries -> providers (live or demo) + document-derived evidence -> categorise -> sentiment ->
litigation scoring -> MCA intelligence -> sector view -> cited summary.
Every finding keeps its source, URL and provider for attribution in the UI and CAM.
"""

from __future__ import annotations

import math
import re
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from core.logging import get_logger
from research.litigation.analyzer import categorize, litigation_score
from research.mca.analyzer import analyze_mca
from research.news.demo_intel import demo_articles, has_demo_intel
from research.news.providers import Article, live_providers
from research.sector_analysis.knowledge_base import sector_view
from research.sentiment.lexicon import score_text, severity_from_score
from research.summarization.summarizer import draft_summary

log = get_logger("credx.research")
ProgressFn = Callable[[int, str, str], None]

REGULATORY_RE = re.compile(r"\brbi\b|sebi|gst (?:intelligence|council|department)|usfda|fssai|cci\b|ministry|regulator|dgft|pollution", re.I)
FRAUD_RE = re.compile(r"fraud|circular|fake invoice|siphon|money laundering|shell compan|round[- ]trip", re.I)


def build_queries(company: dict[str, Any], sector_name: str) -> list[str]:
    name = company["name"]
    short = re.sub(r"\b(private|pvt\.?|limited|ltd\.?|llp)\b", "", name, flags=re.I).strip()
    queries = [
        f'"{short}"',
        f'"{short}" (fraud OR NCLT OR insolvency OR default OR raid OR "GST evasion")',
        f'"{short}" (rating OR CRISIL OR ICRA OR CARE)',
        f"{sector_name} India RBI outlook",
    ]
    for promoter in (company.get("promoters") or [])[:3]:
        if promoter.get("name"):
            queries.append(f'"{promoter["name"]}" (fraud OR ED OR arrested OR default OR SEBI)')
    return queries


def _recency_weight(published: str | None) -> float:
    if not published:
        return 0.6
    try:
        age_days = (datetime.now(UTC) - datetime.fromisoformat(published)).days
    except ValueError:
        return 0.6
    return math.exp(-max(0, age_days) / 365)  # one-year e-folding


def _document_findings(facts: dict[str, Any], company_name: str) -> list[dict[str, Any]]:
    from research.litigation.analyzer import _is_borrower

    out = []
    for legal in facts.get("legal") or []:
        types = ", ".join(legal.get("case_types") or ["Legal notice"])
        claim = legal.get("claim_amount")
        initiated = _is_borrower(legal.get("claimant_name"), company_name)
        title = ("Borrower-initiated: " if initiated else "") + f"{types} — {legal.get('status', 'pending')}" \
            + (f" (claim ₹{claim / 1e7:.2f} Cr)" if claim else "")
        out.append({
            "category": "litigation", "title": title,
            "snippet": f"Forum: {legal.get('forum') or 'n/a'}; claimant: {legal.get('claimant_name') or legal.get('claimant_type') or 'n/a'}.",
            "source": f"Uploaded document: {legal.get('filename')}", "url": None, "published_at": None,
            "sentiment": 0.1 if initiated else (-0.8 if legal.get("severity") in ("CRITICAL", "HIGH") else -0.4),
            "severity": "LOW" if initiated else legal.get("severity", "MEDIUM"),
            "tags": ["document", *legal.get("case_types", [])], "provider": "documents",
        })
    return out


def run_research(
    company: dict[str, Any],
    facts: dict[str, Any],
    revenue: float | None,
    use_demo_intel: bool,
    progress: ProgressFn | None = None,
    case_id: str | None = None,
) -> dict[str, Any]:
    report = progress or (lambda p, s, m: None)
    sector = sector_view(company.get("sector"), f"{company['name']} {company.get('sub_sector') or ''}")
    queries = build_queries(company, sector["name"])
    report(10, "queries", f"Prepared {len(queries)} research queries")

    raw: list[tuple[Article, str | None]] = []
    providers_used: list[str] = []
    if use_demo_intel and has_demo_intel(company["name"]):
        raw += [(a, hint) for a, hint in demo_articles(company["name"])]
        providers_used.append("demo_intel")
    else:
        providers = live_providers()
        for i, provider in enumerate(providers):
            report(15 + int(45 * i / max(1, len(providers))), "crawling", f"Searching {provider.name}")
            for q in queries:
                try:
                    raw += [(a, None) for a in provider.search(q, limit=8)]
                except Exception as exc:
                    log.warning("research provider failed", extra={"provider": provider.name, "error": str(exc)[:200]})
            providers_used.append(provider.name)
    report(60, "analysis", f"Analysing {len(raw)} articles")

    findings: list[dict[str, Any]] = []
    seen: set[str] = set()
    for article, hint in raw:
        key = re.sub(r"\W+", " ", article.title.lower()).strip()[:90]
        if not key or key in seen:
            continue
        seen.add(key)
        text = f"{article.title}. {article.snippet}"
        sent = score_text(text)
        if hint:
            category = hint
        elif FRAUD_RE.search(text):
            category = "fraud"
        elif categorize(text) not in ("civil",) and re.search(r"court|tribunal|nclt|notice|petition|suit|case|arbitra|complaint", text, re.I):
            category = "litigation"
        elif REGULATORY_RE.search(text):
            category = "regulatory"
        else:
            category = "news"
        findings.append({
            "category": category, "title": article.title[:500], "snippet": article.snippet, "source": article.source,
            "url": article.url, "published_at": article.published_at, "sentiment": sent["score"],
            "severity": severity_from_score(sent["score"], category),
            "tags": sent["negative_terms"][:4] + sent["positive_terms"][:2], "provider": article.provider,
        })
    findings += _document_findings(facts, company["name"])

    report(75, "scoring", "Scoring litigation and sentiment")
    lit = litigation_score(facts.get("legal") or [], findings, revenue, company["name"])
    weights = [(f["sentiment"], _recency_weight(f["published_at"]) * (1.5 if f["severity"] in ("HIGH", "CRITICAL") else 1.0))
               for f in findings if f["category"] in ("news", "litigation", "fraud", "regulatory")]
    sentiment = sum(s * w for s, w in weights) / sum(w for _, w in weights) if weights else 0.0
    sentiment_label = "POSITIVE" if sentiment > 0.15 else "NEGATIVE" if sentiment < -0.15 else "NEUTRAL"

    mca = analyze_mca(company, facts.get("mca"), facts.get("directors") or [])
    outlook = sector["outlook"]
    risk_points = {"HIGH": 2, "MEDIUM": 1, "LOW": 0}[lit["level"]] + {"NEGATIVE": 2, "NEUTRAL": 0, "POSITIVE": -1}[sentiment_label] \
        + {"WEAK": 1, "STABLE": 0, "STRONG": -1}[outlook] + sum(1 for f in findings if f["category"] == "fraud" and f["severity"] in ("HIGH", "CRITICAL"))
    overall = "HIGH" if risk_points >= 3 else "MEDIUM" if risk_points >= 1 else "LOW"

    report(85, "summarizing", "Writing cited summary")
    findings.sort(key=lambda f: (f["published_at"] or ""), reverse=True)
    draft = draft_summary(company["name"], findings, lit, sentiment_label, sector)
    from ai.summarizers.services import research_summary  # local import: ai depends on DB models

    summary, summary_provider = research_summary(findings, draft, case_id)
    report(100, "complete", "Research complete")
    return {
        "litigation_risk": lit["level"],
        "litigation_score": lit["score"],
        "litigation_cases": lit["cases"],
        "promoter_sentiment": sentiment_label,
        "sentiment_score": round(sentiment, 3),
        "sector_outlook": outlook,
        "sector_risk": sector["risk"],
        "sector": sector,
        "overall_risk": overall,
        "summary": summary,
        "summary_provider": summary_provider,
        "findings": findings,
        "mca": mca,
        "providers": providers_used or ["documents"],
        "queries": queries,
    }
