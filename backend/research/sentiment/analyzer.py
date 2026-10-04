"""Finance-domain lexicon sentiment with negation handling.

Inspired by the Loughran–McDonald approach: generic sentiment models misread
words like "liability" or "charge"; a credit-specific lexicon does not.
"""

from __future__ import annotations

import re

NEGATIVE = {
    "default": 3, "defaults": 3, "defaulted": 3, "fraud": 4, "fraudulent": 4, "scam": 4, "insolvency": 3,
    "bankruptcy": 3, "nclt": 2.5, "raid": 3, "raided": 3, "probe": 2, "investigation": 2, "arrested": 4,
    "penalty": 2, "penalised": 2, "fined": 2, "downgrade": 2.5, "downgraded": 2.5, "loss": 1.5, "losses": 1.5,
    "decline": 1, "declined": 1, "slump": 1.5, "stress": 1.5, "stressed": 1.5, "delay": 1, "delayed": 1,
    "overdue": 2, "npa": 3, "wilful": 3, "litigation": 1.5, "lawsuit": 1.5, "dispute": 1, "resigns": 1.5,
    "resigned": 1.5, "shutdown": 2.5, "closure": 2, "strike": 1, "layoffs": 1.5, "weak": 1, "headwinds": 1,
    "pledge": 1, "pledged": 1, "evasion": 3, "circular": 2, "fake": 3, "bogus": 3, "attachment": 2,
    "show-cause": 2, "notice": 0.5, "winding": 2.5, "liquidation": 3, "restructuring": 1.5, "sebi": 0.5,
    "ed": 0.5, "cbi": 2, "sfio": 3, "mismatch": 1.5, "slowdown": 1, "volatility": 0.5, "contraction": 1,
}
POSITIVE = {
    "growth": 1.5, "grew": 1.5, "expansion": 1.5, "expands": 1.5, "record": 1, "profit": 1, "profitable": 1.5,
    "upgrade": 2, "upgraded": 2, "award": 1, "wins": 1.5, "won": 1, "order": 0.5, "orders": 0.8,
    "contract": 0.8, "strong": 1, "robust": 1.5, "improved": 1.2, "improvement": 1.2, "stable": 0.8,
    "approval": 1, "approved": 1, "launch": 0.8, "launches": 0.8, "export": 0.5, "investment": 0.8,
    "capex": 0.5, "partnership": 0.8, "acquires": 0.5, "debt-free": 2, "deleveraging": 1.5, "reaffirmed": 1,
    "tailwinds": 1, "pli": 0.8, "recovery": 1,
}
NEGATORS = {"no", "not", "never", "without", "denies", "denied", "dismissed", "cleared", "acquitted", "withdrawn"}
_TOKEN = re.compile(r"[a-z][a-z\-]+")


def score_text(text: str) -> tuple[float, str]:
    """Return (score in [-1, 1], label)."""
    tokens = _TOKEN.findall(text.lower())
    pos = neg = 0.0
    for i, token in enumerate(tokens):
        window = tokens[max(0, i - 3) : i]
        negated = any(t in NEGATORS for t in window)
        if token in NEGATIVE:
            (pos := pos + NEGATIVE[token] * 0.6) if negated else (neg := neg + NEGATIVE[token])
        elif token in POSITIVE:
            (neg := neg + POSITIVE[token] * 0.6) if negated else (pos := pos + POSITIVE[token])
    total = pos + neg
    if total == 0:
        return 0.0, "NEUTRAL"
    score = round((pos - neg) / (total + 2.0), 3)
    label = "POSITIVE" if score > 0.15 else "NEGATIVE" if score < -0.15 else "NEUTRAL"
    return score, label
