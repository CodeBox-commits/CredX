"""Deterministic research synthesis with inline source attribution.

Produces an analyst-style paragraph plus key points, each referencing the
finding it came from ([1], [2]…). The AI layer may later polish the prose, but
the facts and citations always come from here.
"""

from __future__ import annotations

from ..types import Finding, Level, Outlook, Sentiment

_SEV = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


def summarise(
    company: str,
    findings: list[Finding],
    *,
    litigation: Level,
    sentiment: Sentiment,
    outlook: Outlook,
    regulatory: Level,
    sector_label: str,
) -> tuple[str, list[str]]:
    ranked = sorted(findings, key=lambda f: (-_SEV[f.severity], -f.relevance))
    index = {id(f): i + 1 for i, f in enumerate(ranked)}
    adverse = [f for f in ranked if f.sentiment == "NEGATIVE" and _SEV[f.severity] >= 2]
    positive = [f for f in ranked if f.sentiment == "POSITIVE"]

    parts = [
        f"External intelligence on {company} indicates {sentiment.lower()} promoter/company sentiment, "
        f"{litigation.lower()} litigation risk and a {outlook.lower()} outlook for the {sector_label} sector."
    ]
    if adverse:
        cites = ", ".join(f"[{index[id(f)]}]" for f in adverse[:3])
        parts.append(f"Material adverse items include {adverse[0].title.rstrip('.')} {cites}.")
    if positive:
        parts.append(f"Mitigating signals: {positive[0].title.rstrip('.')} [{index[id(positive[0])]}].")
    if regulatory in {"HIGH", "CRITICAL"}:
        parts.append("Regulatory exposure is elevated and should be addressed in sanction conditions.")
    if not findings:
        parts.append("No company-specific adverse media was found in configured sources.")

    key_points = [
        f"[{index[id(f)]}] {f.title} — {f.source_name}" for f in ranked[:6]
    ]
    return " ".join(parts), key_points
