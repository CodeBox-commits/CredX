from __future__ import annotations

import re
from typing import Any

SignalRule = dict[str, Any]
PageText = dict[str, Any]

SIGNAL_RULES: list[SignalRule] = [
    {
        "label": "GST reconciliation or circular-trading cue",
        "severity": "high",
        "penalty": 17,
        "detail": "GST mismatch, round-tripping, or circular-trading language was detected in the document.",
        "patterns": [
            re.compile(r"\bgstr[- ]?2a\b", re.I),
            re.compile(r"\bgstr[- ]?3b\b", re.I),
            re.compile(r"\bmismatch\b.*\bgst\b", re.I),
            re.compile(r"\bcircular trading\b", re.I),
            re.compile(r"\bround tripping\b", re.I),
            re.compile(r"\brevenue inflation\b", re.I),
        ],
    },
    {
        "label": "Default or overdue obligations",
        "severity": "high",
        "penalty": 18,
        "detail": "Payment default, overdue balances, or delayed servicing language was detected.",
        "patterns": [
            re.compile(r"\bdefault(?:ed|s)?\b", re.I),
            re.compile(r"\boverdue\b", re.I),
            re.compile(r"\bdelay(?:ed)? payment\b", re.I),
            re.compile(r"\bnon[- ]performing\b", re.I),
            re.compile(r"\bmissed installment\b", re.I),
        ],
    },
    {
        "label": "Litigation or insolvency exposure",
        "severity": "high",
        "penalty": 16,
        "detail": "The document references litigation, insolvency, or legal proceedings.",
        "patterns": [
            re.compile(r"\blitigation\b", re.I),
            re.compile(r"\binsolvency\b", re.I),
            re.compile(r"\bnclt\b", re.I),
            re.compile(r"\barbitration\b", re.I),
            re.compile(r"\blegal proceedings?\b", re.I),
        ],
    },
    {
        "label": "Related-party or promoter-linked exposure",
        "severity": "medium",
        "penalty": 10,
        "detail": "Transactions involving promoters, related parties, or group entities were flagged.",
        "patterns": [
            re.compile(r"\brelated party\b", re.I),
            re.compile(r"\bpromoter(?:s)?\b", re.I),
            re.compile(r"\bgroup compan(?:y|ies)\b", re.I),
            re.compile(r"\bassociate compan(?:y|ies)\b", re.I),
        ],
    },
    {
        "label": "Negative cash flow or liquidity pressure",
        "severity": "medium",
        "penalty": 9,
        "detail": "Liquidity stress indicators or negative operating cash flows were found.",
        "patterns": [
            re.compile(r"\bnegative cash flow\b", re.I),
            re.compile(r"\bcash loss\b", re.I),
            re.compile(r"\bliquidity\b", re.I),
            re.compile(r"\bworking capital\b", re.I),
            re.compile(r"\bstressed cash\b", re.I),
        ],
    },
    {
        "label": "Qualified audit or disclosure concern",
        "severity": "medium",
        "penalty": 8,
        "detail": "Audit qualifications, emphasis of matter, or disclosure concerns were identified.",
        "patterns": [
            re.compile(r"\bqualified opinion\b", re.I),
            re.compile(r"\bemphasis of matter\b", re.I),
            re.compile(r"\bmaterial weakness\b", re.I),
            re.compile(r"\bgoing concern\b", re.I),
            re.compile(r"\badverse opinion\b", re.I),
        ],
    },
    {
        "label": "Rating downgrade or watch-negative action",
        "severity": "medium",
        "penalty": 8,
        "detail": "External rating commentary suggests weakening credit comfort or tighter lender monitoring.",
        "patterns": [
            re.compile(r"\brating downgrad(?:e|ed)\b", re.I),
            re.compile(r"\bwatch negative\b", re.I),
            re.compile(r"\boutlook revised to negative\b", re.I),
            re.compile(r"\bcredit rating\b", re.I),
        ],
    },
    {
        "label": "Cheque returns or covenant references",
        "severity": "low",
        "penalty": 4,
        "detail": "The document mentions cheque returns, covenants, or compliance triggers worth reviewing.",
        "patterns": [
            re.compile(r"\bcheque return(?:ed)?\b", re.I),
            re.compile(r"\bcovenant\b", re.I),
            re.compile(r"\bbreach\b", re.I),
            re.compile(r"\bnon[- ]compliance\b", re.I),
        ],
    },
]

DOCUMENT_TYPE_RULES: list[dict[str, Any]] = [
    {
        "type": "Annual Report",
        "patterns": [
            re.compile(r"\bannual report\b", re.I),
            re.compile(r"\bboard of directors\b", re.I),
            re.compile(r"\bbalance sheet\b", re.I),
            re.compile(r"\bstatement of profit and loss\b", re.I),
        ],
    },
    {
        "type": "Bank Statement",
        "patterns": [
            re.compile(r"\bbank statement\b", re.I),
            re.compile(r"\baccount number\b", re.I),
            re.compile(r"\bopening balance\b", re.I),
            re.compile(r"\bclosing balance\b", re.I),
        ],
    },
    {
        "type": "GST Return",
        "patterns": [
            re.compile(r"\bgstr[- ]?[1239]\b", re.I),
            re.compile(r"\bgoods and services tax\b", re.I),
            re.compile(r"\binput tax credit\b", re.I),
            re.compile(r"\bgst\b", re.I),
        ],
    },
    {
        "type": "Auditor Report",
        "patterns": [
            re.compile(r"\bauditor'?s report\b", re.I),
            re.compile(r"\bindependent auditor'?s report\b", re.I),
            re.compile(r"\btrue and fair view\b", re.I),
        ],
    },
    {
        "type": "Income Tax Return",
        "patterns": [
            re.compile(r"\bincome tax return\b", re.I),
            re.compile(r"\bitr[- ]?[456]\b", re.I),
            re.compile(r"\btotal taxable income\b", re.I),
            re.compile(r"\bform 3cd\b", re.I),
        ],
    },
    {
        "type": "Rating Agency Report",
        "patterns": [
            re.compile(r"\bcredit rating\b", re.I),
            re.compile(r"\brating rationale\b", re.I),
            re.compile(r"\bcrisil\b", re.I),
            re.compile(r"\bicra\b", re.I),
            re.compile(r"\bcare ratings\b", re.I),
        ],
    },
    {
        "type": "Board Minutes",
        "patterns": [
            re.compile(r"\bboard meeting minutes\b", re.I),
            re.compile(r"\bminutes of the board\b", re.I),
            re.compile(r"\bboard resolution\b", re.I),
        ],
    },
    {
        "type": "Shareholding Pattern",
        "patterns": [
            re.compile(r"\bshareholding pattern\b", re.I),
            re.compile(r"\bpromoter holding\b", re.I),
            re.compile(r"\bpublic shareholding\b", re.I),
        ],
    },
    {
        "type": "Legal Notice",
        "patterns": [
            re.compile(r"\blegal notice\b", re.I),
            re.compile(r"\bdemand notice\b", re.I),
            re.compile(r"\barbitration\b", re.I),
        ],
    },
    {
        "type": "Sanction Letter",
        "patterns": [
            re.compile(r"\bsanction letter\b", re.I),
            re.compile(r"\bcredit facility\b", re.I),
            re.compile(r"\bterms and conditions\b", re.I),
        ],
    },
]

AMOUNT_PATTERN = re.compile(
    r"\b(?:rs\.?|inr|usd|eur|gbp|aed|sgd|jpy|cny)\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:crore|cr|lakh|lac|million|billion|mn|bn))?",
    re.I,
)
PERCENT_PATTERN = re.compile(r"\b\d{1,3}(?:\.\d+)?\s?%", re.I)
DATE_PATTERN = re.compile(
    r"\b(?:\d{1,2}[/-]){2}\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\b",
    re.I,
)


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def detect_document_type(text: str, filename: str) -> str:
    searchable = f"{filename} {text}"
    for rule in DOCUMENT_TYPE_RULES:
        if any(pattern.search(searchable) for pattern in rule["patterns"]):
            return str(rule["type"])
    return "Financial Document"


def build_excerpt(text: str, start: int, end: int) -> str:
    left = max(0, start - 90)
    right = min(len(text), end + 90)
    return normalize_space(text[left:right])


def unique_matches(pattern: re.Pattern[str], text: str, limit: int) -> list[str]:
    seen: list[str] = []
    for match in pattern.findall(text):
        normalized = normalize_space(match)
        if not normalized or normalized in seen:
            continue
        seen.append(normalized)
        if len(seen) >= limit:
            break
    return seen


def page_number_for_patterns(
    pages: list[PageText],
    patterns: list[re.Pattern[str]],
) -> int | None:
    for page in pages:
        page_text = str(page.get("text") or "")
        if any(pattern.search(page_text) for pattern in patterns):
            page_number = page.get("page_number")
            return int(page_number) if isinstance(page_number, int) else None
    return None


def collect_signals(text: str, pages: list[PageText]) -> tuple[list[dict[str, Any]], int]:
    signals: list[dict[str, Any]] = []
    penalty = 0

    for rule in SIGNAL_RULES:
        match_result: re.Match[str] | None = None
        for pattern in rule["patterns"]:
            match_result = pattern.search(text)
            if match_result:
                break

        if not match_result:
            continue

        page_number = page_number_for_patterns(pages, rule["patterns"])
        signals.append(
            {
                "label": rule["label"],
                "severity": rule["severity"],
                "detail": rule["detail"],
                "page_number": page_number,
                "excerpt": build_excerpt(text, match_result.start(), match_result.end()),
            }
        )
        penalty += int(rule["penalty"])

    if len(text) < 500:
        signals.append(
            {
                "label": "Low extraction coverage",
                "severity": "medium",
                "detail": "Very little text was extracted, so richer OCR or parser review may still be needed.",
                "page_number": None,
                "excerpt": "Limited text was available from the parsed document.",
            }
        )
        penalty += 6

    if not signals:
        signals.append(
            {
                "label": "No obvious distress keywords found",
                "severity": "low",
                "detail": "Automated screening did not detect common distress language, but manual review is still recommended.",
                "page_number": None,
                "excerpt": "No high-risk phrases were matched in the extracted text.",
            }
        )

    return signals[:5], penalty


def build_highlights(
    document_type: str,
    page_count: int,
    text: str,
    signals: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    highlights: list[dict[str, Any]] = [
        {
            "title": "Detected document type",
            "detail": document_type,
            "page_number": None,
        },
        {
            "title": "Pages analyzed",
            "detail": f"{page_count} page(s) parsed in the backend pipeline.",
            "page_number": None,
        },
    ]

    amounts = unique_matches(AMOUNT_PATTERN, text, 3)
    if amounts:
        highlights.append(
            {
                "title": "Monetary values spotted",
                "detail": ", ".join(amounts),
                "page_number": None,
            }
        )

    percentages = unique_matches(PERCENT_PATTERN, text, 3)
    if percentages:
        highlights.append(
            {
                "title": "Ratios or percentages mentioned",
                "detail": ", ".join(percentages),
                "page_number": None,
            }
        )

    dates = unique_matches(DATE_PATTERN, text, 2)
    if dates:
        highlights.append(
            {
                "title": "Reporting periods detected",
                "detail": ", ".join(dates),
                "page_number": None,
            }
        )

    if signals:
        highlights.append(
            {
                "title": "Primary review cue",
                "detail": signals[0]["label"],
                "page_number": signals[0].get("page_number"),
            }
        )

    return highlights[:5]


def risk_level_from_score(score: int) -> str:
    if score >= 720:
        return "low"
    if score >= 620:
        return "medium"
    return "high"


def analyze_parsed_text(
    *,
    text: str,
    filename: str,
    page_count: int,
    pages: list[PageText],
) -> dict[str, Any]:
    normalized_text = normalize_space(text)
    document_type = detect_document_type(normalized_text, filename)
    signals, penalty = collect_signals(normalized_text, pages)
    score = max(300, min(900, 790 - penalty * 6))
    risk_level = risk_level_from_score(score)
    highlights = build_highlights(document_type, page_count, normalized_text, signals)
    primary_signal = signals[0]["label"] if signals else "No obvious distress keywords found"

    return {
        "parsed": True,
        "status": "parsed",
        "detected_document_type": document_type,
        "summary": f"{document_type} analyzed in backend mode. {risk_level.upper()} review priority based on: {primary_signal}.",
        "score": score,
        "risk_level": risk_level,
        "signals": signals,
        "highlights": highlights,
    }
