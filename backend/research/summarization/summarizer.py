"""Deterministic, cited research summary ([n] references index into the findings list)."""

from __future__ import annotations

from typing import Any

_RANK = {"CRITICAL": 3, "HIGH": 2, "MEDIUM": 1, "LOW": 0}


def _lower_first(text: str) -> str:
    """Sentence-case a clause without breaking acronyms ("EV transition" stays "EV transition")."""
    return text if len(text) > 1 and text[1].isupper() else text[:1].lower() + text[1:]


def draft_summary(company_name: str, findings: list[dict[str, Any]], lit: dict[str, Any], sentiment: str,
                  sector: dict[str, Any]) -> str:
    ref = {id(f): i + 1 for i, f in enumerate(findings)}

    def cite(items: list[dict[str, Any]], limit: int) -> str:
        top = sorted(items, key=lambda f: -_RANK.get(f["severity"], 0))[:limit]
        return "; ".join(f"{f['title'].rstrip('.')} [{ref[id(f)]}]" for f in top)

    parts = []
    legal = [f for f in findings if f["category"] == "litigation"]
    fraud = [f for f in findings if f["category"] in ("fraud", "regulatory")]
    news = [f for f in findings if f["category"] == "news"]
    parts.append(f"Litigation risk for {company_name} is {lit['level']} (score {lit['score']:.0f}/100)"
                 + (f": {cite(legal, 2)}." if legal else "; no litigation was found in documents or the public domain."))
    if fraud:
        parts.append(f"Regulatory / fraud signals: {cite(fraud, 2)}.")
    parts.append(f"Media and promoter sentiment is {sentiment.lower()}" + (f" — {cite(news, 2)}." if news else "."))
    headwind = (sector.get("headwinds") or ["no specific headwinds recorded"])[0]
    parts.append(f"{sector['name']} outlook is {sector['outlook'].lower()} (sector risk {sector['risk']}/100); key headwind: "
                 f"{_lower_first(headwind)}.")
    if not findings:
        parts.append("No adverse public-domain findings were identified; enable live research providers for broader coverage.")
    return " ".join(parts)
