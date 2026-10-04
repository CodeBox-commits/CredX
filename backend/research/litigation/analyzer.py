"""Litigation intelligence: classify legal exposure from news + ingested legal documents."""

from __future__ import annotations

import re

from extraction.normalization.schema import LegalMatter

from ..types import Finding, Level

_PATTERNS: list[tuple[re.Pattern[str], str, Level]] = [
    (re.compile(r"\bnclt\b|insolvency|\bibc\b|cirp|resolution professional", re.I), "Insolvency (IBC/NCLT)", "HIGH"),
    (re.compile(r"\bdrt\b|debt recovery tribunal|sarfaesi", re.I), "Debt recovery", "HIGH"),
    (re.compile(r"wilful defaulter", re.I), "Wilful defaulter", "CRITICAL"),
    (re.compile(r"\bed\b raid|enforcement directorate|money laundering|\bpmla\b|\bsfio\b|\bcbi\b", re.I), "Criminal / investigative", "CRITICAL"),
    (re.compile(r"section 138|cheque bounce|dishonou?r", re.I), "Cheque dishonour (NI Act)", "MEDIUM"),
    (re.compile(r"gst (?:evasion|fraud|demand)|dggi|show[- ]cause", re.I), "Tax dispute", "MEDIUM"),
    (re.compile(r"arbitration|high court|lawsuit|suit filed|petition", re.I), "Commercial litigation", "MEDIUM"),
]
_SEV = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


def classify_litigation(text: str) -> tuple[str, Level] | None:
    for pattern, label, level in _PATTERNS:
        if pattern.search(text):
            return label, level
    return None


def litigation_findings(matters: list[LegalMatter]) -> list[Finding]:
    return [
        Finding(
            category="litigation",
            title=f"{m.case_type} — {m.forum}" + (f" ({m.reference})" if m.reference else ""),
            summary=(m.summary or f"{m.case_type} before {m.forum}.")[:400]
            + (f" Claim amount: ₹{m.amount:,.0f}." if m.amount else ""),
            source_name="Uploaded legal documents",
            sentiment="NEGATIVE" if m.status != "CLOSED" else "NEUTRAL",
            sentiment_score=-0.6 if m.status != "CLOSED" else 0.0,
            severity=m.severity,
            relevance=0.95,
            tags=["document", m.status.lower()],
            provider="documents",
        )
        for m in matters
    ]


def litigation_risk(findings: list[Finding]) -> Level:
    legal = [f for f in findings if f.category == "litigation"]
    if not legal:
        return "LOW"
    worst = max(_SEV[f.severity] for f in legal)
    open_high = sum(1 for f in legal if _SEV[f.severity] >= 3 and "closed" not in f.tags)
    if worst >= 4 or open_high >= 2:
        return "CRITICAL" if worst >= 4 else "HIGH"
    if worst == 3:
        return "HIGH"
    return "MEDIUM" if len(legal) >= 1 else "LOW"
