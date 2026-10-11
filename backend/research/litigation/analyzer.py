"""Litigation intelligence: weight legal exposure from uploaded legal documents and public-domain findings.

Weights reflect how Indian credit committees read legal risk: IBC/NCLT and investigative-agency action
dominate; arbitration where the *borrower* is the claimant is a receivable, not a liability, and is
heavily discounted. Large claims relative to revenue scale the weight up.
"""

from __future__ import annotations

import re
from typing import Any

CATEGORIES: list[tuple[str, str, float]] = [  # (category, pattern, base weight)
    ("wilful_defaulter", r"wilful defaulter", 50),
    ("criminal", r"enforcement directorate|\bpmla\b|money laundering|\bsfio\b|\bcbi\b|\bed\b raid|arrested|chargesheet", 40),
    ("insolvency", r"\bnclt\b|insolvency|\bibc\b|cirp|bankruptcy|winding[- ]up", 35),
    ("recovery", r"sarfaesi|\bdrt\b|debts? recovery", 30),
    ("cheque_dishonour", r"section 138|negotiable instruments|cheque (?:bounce|dishono)|dishono", 15),
    ("tax", r"gst (?:evasion|demand|fraud)|show[- ]cause|income[- ]tax (?:demand|search)|dggi", 15),
    ("arbitration", r"arbitra", 12),
    ("labour", r"labou?r court|industrial dispute|\bpf\b dues|esic|workers'? union", 6),
]
_COMPILED = [(cat, re.compile(p, re.I), w) for cat, p, w in CATEGORIES]
WEIGHT = {cat: w for cat, _, w in CATEGORIES} | {"civil": 8}
_STATUS = {"threatened": 0.8, "pending": 1.0, "adjudicated": 1.25, "closed": 0.2}
_SUFFIX = re.compile(r"\b(?:private|pvt|limited|ltd|llp|the|co|company)\b\.?|\(.*?\)|[^a-z0-9 ]", re.I)


def categorize(text: str) -> str:
    for cat, pattern, _ in _COMPILED:
        if pattern.search(text):
            return cat
    return "civil"


def _norm(name: str | None) -> str:
    return " ".join(_SUFFIX.sub(" ", (name or "").lower()).split())


def _is_borrower(party: str | None, company_name: str) -> bool:
    a, b = _norm(party), _norm(company_name)
    return bool(a and b and (a == b or a in b or b in a))


def litigation_score(legal: list[dict[str, Any]], findings: list[dict[str, Any]], revenue: float | None,
                     company_name: str) -> dict[str, Any]:
    cases: list[dict[str, Any]] = []
    for doc in legal:
        types = doc.get("case_types") or []
        cat = max((categorize(t) for t in types), key=lambda c: WEIGHT[c], default="civil")
        weight = WEIGHT[cat] * _STATUS.get(doc.get("status") or "pending", 1.0)
        claim = doc.get("claim_amount")
        if claim and revenue:
            weight *= 1 + min(1.0, 4 * claim / revenue)
        claimant = _is_borrower(doc.get("claimant_name"), company_name)
        if claimant:
            weight *= 0.25
        cases.append({"source": doc.get("filename") or "Uploaded document", "title": doc.get("title"), "types": types,
                      "forum": doc.get("forum"), "claim_amount": claim, "status": doc.get("status"),
                      "weight": round(weight, 1), "borrower_is_claimant": claimant})
    for f in findings:
        if f.get("category") != "litigation" or f.get("provider") == "documents":
            continue  # document-derived findings are already counted above
        cat = categorize(f"{f.get('title', '')} {f.get('snippet') or ''}")
        favourable = (f.get("sentiment") or 0) > 0.2  # e.g. an award in the borrower's favour
        cases.append({"source": f.get("source"), "title": f.get("title"), "types": [cat.replace("_", " ").title()],
                      "forum": None, "claim_amount": None, "status": "reported",
                      "weight": float(WEIGHT[cat]) * (0.25 if favourable else 1.0), "borrower_is_claimant": favourable})
    score = round(min(100.0, sum(c["weight"] for c in cases)), 1)
    severe = any(categorize(" ".join(c["types"])) in ("criminal", "wilful_defaulter") for c in cases)
    level = "HIGH" if score >= 45 or severe else "MEDIUM" if score >= 15 else "LOW"
    return {"level": level, "score": score, "cases": sorted(cases, key=lambda c: -c["weight"])}
