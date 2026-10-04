"""Parse analyst field notes into explicit, bounded score overlays.

e.g. "Factory operating at 40% capacity." → capacity_underutilisation, −25 pts.
Every signal records the matched phrase so the overlay is fully auditable.
"""

from __future__ import annotations

import re
from typing import Any

_RULES: list[tuple[str, str, str, float]] = [
    ("strong_order_book", "Strong / growing order book", r"strong order book|order book (?:of|at) [^.]{0,20}(?:x|times)|healthy (?:order|pipeline)", 10),
    ("new_orders", "New orders / contracts won", r"(?:new|fresh|large) (?:orders?|contracts?)|won (?:a |an )?(?:order|contract)", 6),
    ("cooperative_mgmt", "Transparent, cooperative management", r"(?:management|promoters?) (?:was |were |is |are )?(?:cooperative|transparent|forthcoming|professional)", 6),
    ("evasive_mgmt", "Evasive / uncooperative management", r"evasive|uncooperative|not forthcoming|refused to share|reluctant to (?:share|provide)", -15),
    ("inventory_buildup", "Inventory pile-up / slow-moving stock", r"inventory (?:pile|build)|slow[- ]moving|obsolete (?:stock|inventory)|stock (?:piled|lying)", -10),
    ("idle_machinery", "Idle / ageing machinery", r"machines? (?:idle|lying idle|not operational)|idle (?:machines?|capacity|lines?)|old (?:machinery|plant)", -8),
    ("labour_issues", "Labour unrest / wage delays", r"labou?r (?:unrest|strike|dispute)|delay(?:ed)? (?:salar|wage)|salaries (?:not paid|pending)", -14),
    ("customer_loss", "Loss of key customer", r"lost (?:a |its |the )?(?:key|major|largest) (?:customer|client)|customer (?:exit|loss)", -15),
    ("fund_diversion", "Suspected diversion of funds", r"divers?ion of funds|funds (?:diverted|siphoned)|siphon", -30),
    ("title_issue", "Collateral title / encumbrance issue", r"title (?:dispute|defect|issue)|encumbrance|not clear title", -15),
    ("collateral_ok", "Collateral verified with clear title", r"(?:collateral|property|security) (?:verified|inspected)|clear (?:and marketable )?title", 5),
    ("well_maintained", "Well-maintained, active facility", r"well[- ]maintained|clean (?:and|&) organi[sz]ed|fully operational|three shifts", 4),
    ("succession", "Second-line management / succession in place", r"second[- ]line management|succession plan", 4),
    ("related_party_concern", "Related-party dealings observed", r"related[- ]party|group (?:company|concern) (?:purchases|sales)", -8),
    ("receivable_concern", "Collection / receivable concerns", r"collections? (?:delayed|slow|weak)|receivables? (?:stuck|overdue)", -8),
    ("regulatory_concern", "Pollution / regulatory non-compliance", r"pollution (?:board )?notice|closure notice|non[- ]complian", -12),
]
_COMPILED = [(code, label, re.compile(pattern, re.I), impact) for code, label, pattern, impact in _RULES]
_CAPACITY = re.compile(r"(?:operating|running|utili[sz](?:ation|ed|ing)?)[^.%\d]{0,25}(\d{1,3})\s*%|(\d{1,3})\s*%\s*(?:capacity|utili[sz]ation)", re.I)
_NEGATION = re.compile(r"\b(?:no|not|never|without)\b[^.]{0,25}$", re.I)

MAX_TOTAL_OVERLAY = 40.0


def parse_note(text: str) -> list[dict[str, Any]]:
    signals: list[dict[str, Any]] = []
    m = _CAPACITY.search(text)
    if m:
        pct = int(m.group(1) or m.group(2))
        if 0 < pct <= 100:
            impact = -25 if pct < 50 else -12 if pct < 70 else 0 if pct < 85 else 8
            if impact:
                signals.append({
                    "code": "capacity_utilisation", "label": f"Capacity utilisation at {pct}%",
                    "impact": float(impact), "matched": m.group(0),
                })
    for code, label, pattern, impact in _COMPILED:
        hit = pattern.search(text)
        if not hit:
            continue
        prefix = text[max(0, hit.start() - 30) : hit.start()]
        if _NEGATION.search(prefix):
            impact = -impact * 0.5 if impact < 0 else 0
            if not impact:
                continue
            label = f"No {label.lower()}"
        signals.append({"code": code, "label": label, "impact": float(impact), "matched": hit.group(0)})
    return signals


def note_impact(signals: list[dict[str, Any]]) -> float:
    return max(-MAX_TOTAL_OVERLAY, min(MAX_TOTAL_OVERLAY, sum(s["impact"] for s in signals)))
