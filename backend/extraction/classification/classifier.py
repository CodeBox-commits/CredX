"""Weighted-keyword document classifier with explainable signals.

Each document type has weighted phrase patterns; scores are normalised into a
softmax-style confidence. Filename hints and the uploader's declared type act
as priors. Deterministic, fast and auditable — the matched signals are stored
and shown in the UI.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

from ..normalization.schema import DocType

_RULES: dict[str, list[tuple[str, float]]] = {
    "annual_report": [
        (r"annual report", 4), (r"board'?s report|directors'? report", 3), (r"management discussion", 2.5),
        (r"corporate governance", 2), (r"notice of (?:the )?annual general meeting", 2), (r"chairman'?s (?:message|statement)", 2),
        (r"independent auditor'?s report", 1.5), (r"statement of profit and loss", 1),
    ],
    "financial_statement": [
        (r"balance sheet as at", 3.5), (r"statement of profit and loss", 3), (r"cash flow statement", 2.5),
        (r"notes to (?:the )?financial statements", 2), (r"revenue from operations", 1.5),
        (r"total (?:current )?assets", 1), (r"finance costs?", 1), (r"profit (?:before|after) tax", 1),
    ],
    "gst_return": [
        (r"gstr[- ]?3b", 4), (r"gstr[- ]?2[ab]", 4), (r"gstr[- ]?1\b", 3), (r"input tax credit|\bitc\b", 2),
        (r"\bgstin\b", 1.5), (r"outward (?:taxable )?supplies", 2), (r"igst|cgst|sgst", 1.5), (r"reconciliation", 0.5),
    ],
    "bank_statement": [
        (r"bank statement|statement of account", 4), (r"opening balance", 2), (r"closing balance", 2),
        (r"\bifsc\b", 2), (r"cheque (?:returned|bounce|return)", 2), (r"withdrawal|deposit", 1),
        (r"account (?:number|no\.?)", 1.5), (r"\bneft\b|\brtgs\b|\bimps\b|\bupi\b", 1.5),
    ],
    "sanction_letter": [
        (r"sanction letter|letter of sanction", 5), (r"sanctioned limit|sanctioned amount", 3),
        (r"terms and conditions of sanction", 3), (r"rate of interest|\broi\b", 1.5), (r"primary security", 2),
        (r"collateral security", 1.5), (r"repayment schedule|moratorium", 1.5), (r"\bcovenants?\b", 1),
    ],
    "legal_notice": [
        (r"legal notice", 5), (r"demand notice", 3), (r"\bnclt\b|national company law tribunal", 3),
        (r"insolvency and bankruptcy code|\bibc\b", 3), (r"section 138|negotiable instruments act", 3),
        (r"\bdrt\b|debt recovery tribunal", 3), (r"sarfaesi|section 13\(2\)", 3), (r"petition(?:er)?|respondent", 1.5),
        (r"arbitration", 1.5), (r"without prejudice", 1),
    ],
    "mca_filing": [
        (r"ministry of corporate affairs|\bmca\b", 4), (r"form (?:mgt|aoc|dir|chg|inc)[- ]?\d+", 4),
        (r"\bcin\b", 1.5), (r"registrar of companies|\broc\b", 2.5), (r"\bdin\b", 1.5), (r"charge (?:id|holder)", 2.5),
        (r"authori[sz]ed capital|paid[- ]up capital", 2), (r"company status", 2),
    ],
    "shareholding_pattern": [
        (r"shareholding pattern", 5), (r"promoter (?:and promoter )?group", 3), (r"public shareholding", 3),
        (r"shares pledged|encumbered", 3), (r"% of (?:total )?shares?", 2), (r"category of shareholder", 2.5),
    ],
    "rating_report": [
        (r"rating rationale", 5), (r"\b(?:crisil|icra|care ratings|india ratings|brickwork|acuite)\b", 3),
        (r"rating action|reaffirmed|outlook", 2), (r"\b(?:aaa|aa|bbb|bb)[+-]?\s*\((?:stable|negative|positive)\)", 3),
    ],
}

_COMPILED = {doc: [(re.compile(p, re.I), w) for p, w in rules] for doc, rules in _RULES.items()}

_FILENAME_HINTS = {
    "annual_report": ("annual", "ar_", "ar-"),
    "financial_statement": ("balance", "p&l", "pl_", "profit", "financial", "audited"),
    "gst_return": ("gst", "gstr"),
    "bank_statement": ("bank", "statement_of_account", "boa"),
    "sanction_letter": ("sanction",),
    "legal_notice": ("legal", "notice", "nclt", "court"),
    "mca_filing": ("mca", "roc", "mgt", "aoc"),
    "shareholding_pattern": ("shareholding", "share_holding"),
    "rating_report": ("rating", "crisil", "icra"),
}


@dataclass(slots=True)
class Classification:
    doc_type: DocType
    confidence: float
    signals: list[str]
    scores: dict[str, float]


def classify_document(text: str, filename: str = "", declared_type: str | None = None) -> Classification:
    sample = text[:20000]
    scores: dict[str, float] = {}
    signals: dict[str, list[str]] = {}
    for doc_type, rules in _COMPILED.items():
        score = 0.0
        for pattern, weight in rules:
            hits = len(pattern.findall(sample))
            if hits:
                score += weight * (1 + math.log(hits))
                signals.setdefault(doc_type, []).append(pattern.pattern.split("|")[0].replace("\\b", ""))
        lowered = filename.lower()
        if any(hint in lowered for hint in _FILENAME_HINTS.get(doc_type, ())):
            score += 2.5
            signals.setdefault(doc_type, []).append(f"filename:{filename}")
        if declared_type == doc_type:
            score += 3.0
            signals.setdefault(doc_type, []).append("declared by uploader")
        scores[doc_type] = round(score, 2)

    best = max(scores, key=scores.get) if scores else "unknown"
    if scores.get(best, 0) < 2.5:
        return Classification("unknown", 0.2, [], scores)

    # Softmax over a temperature-scaled score gives a calibrated-looking confidence.
    exps = {k: math.exp(v / 3.0) for k, v in scores.items()}
    confidence = exps[best] / sum(exps.values())
    return Classification(best, round(min(0.99, confidence), 3), signals.get(best, [])[:8], scores)  # type: ignore[arg-type]
