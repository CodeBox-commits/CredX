"""Finance-domain sentiment (Loughran–McDonald inspired, tuned for Indian credit news).

Deterministic and auditable: every score can be traced to the matched terms, which the UI shows.
"""

from __future__ import annotations

import re

NEGATIVE: dict[str, float] = {
    "fraud": 3, "scam": 3, "siphon": 3, "diversion of funds": 3, "money laundering": 3, "wilful defaulter": 3,
    "arrested": 3, "chargesheet": 2.5, "raid": 2.5, "searched": 1.5, "enforcement directorate": 2.5, "cbi": 2, "sfio": 2.5,
    "insolvency": 2.5, "nclt": 2, "bankruptcy": 2.5, "liquidation": 3, "winding up": 3, "default": 2.5, "defaulted": 2.5,
    "npa": 2.5, "restructuring": 1.5, "one-time settlement": 2, "downgrade": 2, "downgraded": 2, "negative outlook": 1.5,
    "outlook to negative": 1.5, "watch with negative": 1.5, "penalty": 1.5, "penalised": 1.5, "show cause": 1.5,
    "evasion": 2.5, "fake invoices": 3, "circular": 1.5, "probe": 1.5, "investigation": 1.5, "lawsuit": 1.2,
    "dishonour": 1.5, "dishonor": 1.5, "demand notice": 1.5, "dues": 0.8, "loss": 1, "losses": 1, "decline": 0.8,
    "slowdown": 1, "delays": 0.8, "delayed": 0.8, "stretched": 1, "stress": 1, "strike": 1.2, "shutdown": 1.5,
    "resigns": 1, "steps down": 0.8, "warning letter": 2, "import alert": 2.5, "form 483": 1.5, "recall": 1.5,
    "loses": 1.2, "lost": 1, "quality concerns": 1.2, "below 50% capacity": 1.2, "soften": 0.6, "headwinds": 0.8,
}
POSITIVE: dict[str, float] = {
    "upgraded": 2, "upgrade": 1.5, "reaffirmed": 1, "stable outlook": 1, "/stable": 0.8, "wins": 1.5, "bags": 1.5,
    "order": 0.6, "contract": 0.6, "expansion": 1, "commissions": 1, "invest": 0.8, "record": 1, "growth": 1,
    "profit": 1, "approval": 1, "eir": 1.5, "no form 483": 2, "no adverse": 1.5, "awards": 1, "awarded": 1,
    "renews": 0.8, "healthy": 1, "improving": 1, "improved": 1, "strong": 1, "pli": 0.8, "export order": 1.2,
    "adds": 0.6, "cut power costs": 0.8, "welcomed": 0.6, "extended": 0.4,
}
_NEG_RE = re.compile(r"\b(?:no|not|without|denies|denied|cleared of|dismissed)\b", re.I)


def _terms(text: str, lexicon: dict[str, float]) -> list[tuple[str, float]]:
    low = text.lower()
    hits = []
    for term, w in lexicon.items():
        for m in re.finditer(r"(?<![a-z])" + re.escape(term) + r"(?![a-z])", low):
            window = low[max(0, m.start() - 25): m.start()]
            hits.append((term, -w if _NEG_RE.search(window) and term not in ("no form 483", "no adverse") else w))
    return hits


def score_text(text: str) -> dict:
    """-> {'score': -1..1, 'label', 'negative_terms', 'positive_terms'}"""
    neg = _terms(text, NEGATIVE)
    pos = _terms(text, POSITIVE)
    neg_w = sum(w for _, w in neg if w > 0) + sum(-w for _, w in pos if w < 0)
    pos_w = sum(w for _, w in pos if w > 0) + sum(-w for _, w in neg if w < 0)
    score = (pos_w - neg_w) / (pos_w + neg_w + 1.5)
    label = "POSITIVE" if score > 0.15 else "NEGATIVE" if score < -0.15 else "NEUTRAL"
    return {"score": round(score, 3), "label": label,
            "negative_terms": sorted({t for t, w in neg if w > 0}), "positive_terms": sorted({t for t, w in pos if w > 0})}


def severity_from_score(score: float, category: str) -> str:
    if category in ("litigation", "fraud", "regulatory") and score < -0.5:
        return "CRITICAL" if score < -0.7 else "HIGH"
    if score < -0.45:
        return "HIGH"
    if score < -0.15:
        return "MEDIUM"
    return "LOW"
