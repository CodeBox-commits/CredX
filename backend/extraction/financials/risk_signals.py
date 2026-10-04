"""Red-flag phrase detection with severities (auditor remarks, defaults, SMA, pledges…)."""

from __future__ import annotations

import re

from utils.text import snippet_around

from ..normalization.schema import RiskIndicator

RISK_RULES: list[tuple[str, str, str, str]] = [
    ("going_concern", "Going-concern uncertainty flagged by auditor", "CRITICAL", r"going concern"),
    ("qualified_opinion", "Qualified / adverse audit opinion", "HIGH", r"qualified opinion|adverse opinion|disclaimer of opinion"),
    ("emphasis_of_matter", "Emphasis of matter in audit report", "MEDIUM", r"emphasis of matter"),
    ("auditor_resignation", "Auditor resignation", "HIGH", r"auditor(?:s)? (?:has |have )?resign"),
    ("npa_sma", "SMA / NPA classification", "CRITICAL", r"\bsma[- ]?[012]\b|\bnpa\b|non[- ]performing asset"),
    ("default", "Default / delayed debt servicing", "HIGH", r"\bdefault(?:ed)?\b|delay(?:ed)? in (?:repayment|servicing)|overdue (?:interest|instal)"),
    ("restructuring", "Debt restructuring / OTS", "HIGH", r"restructur|one[- ]time settlement|\bots\b|\bcdr\b"),
    ("wilful_defaulter", "Wilful defaulter reference", "CRITICAL", r"wilful defaulter"),
    ("insolvency", "Insolvency / NCLT reference", "HIGH", r"\bnclt\b|insolvency|\bibc\b"),
    ("litigation", "Litigation / arbitration exposure", "MEDIUM", r"litigation|arbitration|legal proceedings"),
    ("liquidity_stress", "Liquidity / working-capital stress", "MEDIUM", r"liquidity (?:pressure|stress|crunch)|working capital (?:remained )?stretched|negative cash flow"),
    ("receivable_stress", "Ageing / overdue receivables", "MEDIUM", r"receivables? (?:remained )?overdue|debtors? (?:more|older) than (?:90|180) days"),
    ("limit_overdrawal", "Overdrawal beyond sanctioned limits", "HIGH", r"above sanctioned|overdrawn|overdrawal|limit breach"),
    ("cheque_bounce", "Cheque / ECS returns", "MEDIUM", r"cheque (?:returned|bounced?|dishonou?red)|insufficient funds|ecs return|nach return"),
    ("related_party", "Material related-party transactions", "MEDIUM", r"related[- ]party (?:purchases|sales|transactions|loans)|promoter[- ]linked"),
    ("promoter_pledge", "Promoter share pledge", "MEDIUM", r"pledge(?:d)? (?:of )?(?:promoter )?shares|increase in pledge|shares pledged"),
    ("gst_mismatch", "GSTR-2A / 3B mismatch", "HIGH", r"mismatch (?:observed )?between gstr|gstr[- ]?2a[^.\n]{0,40}gstr[- ]?3b[^.\n]{0,40}mismatch|itc mismatch"),
    ("circular_trading", "Circular trading suspicion", "CRITICAL", r"circular trading|round[- ]tripping|accommodation entries"),
    ("revenue_inflation", "Possible revenue inflation", "HIGH", r"revenue inflation|inflated (?:sales|revenue)|fictitious (?:sales|invoices)"),
    ("rating_downgrade", "Credit rating downgrade / negative outlook", "MEDIUM", r"downgrad|outlook (?:was )?revised to negative|rating watch"),
    ("margin_compression", "Margin compression", "LOW", r"margin compression|margins? (?:declined|contracted)"),
    ("regulatory_action", "Regulatory / investigative action", "CRITICAL", r"enforcement directorate|\bsfio\b|\bcbi\b|\bsebi order|penalty imposed"),
    ("capacity_underutilisation", "Capacity underutilisation", "MEDIUM", r"capacity utili[sz]ation (?:of|at) (?:[1-4]\d|50)%|operating at (?:[1-4]\d)% capacity|underutili[sz]"),
    ("positive_order_book", "Strong order book", "LOW", r"strong order book"),
]

_COMPILED = [(code, label, sev, re.compile(pat, re.I)) for code, label, sev, pat in RISK_RULES]

POSITIVE_CODES = {"positive_order_book"}


def detect_risk_indicators(pages: list[str]) -> list[RiskIndicator]:
    found: dict[str, RiskIndicator] = {}
    for page_no, text in enumerate(pages, start=1):
        for code, label, severity, pattern in _COMPILED:
            if code in found:
                continue
            m = pattern.search(text)
            if not m:
                continue
            context = text[max(0, m.start() - 60) : m.end() + 60].lower()
            if re.search(r"\bno (?:adverse|material|qualification|default)|\bnil\b|not (?:been )?(?:classified|reported)", context):
                continue
            found[code] = RiskIndicator(
                code=code, label=label, severity=severity,  # type: ignore[arg-type]
                snippet=snippet_around(text, m.start(), m.end(), 70), page=page_no,
            )
    return list(found.values())
