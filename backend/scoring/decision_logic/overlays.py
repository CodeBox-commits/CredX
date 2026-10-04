"""Qualitative overlays applied on top of the model score — each one visible, bounded and cited.

1. Analyst notes: "Factory operating at 40% capacity" -> -20 pts. Analysts may pin an explicit
   impact; otherwise it is inferred from a transparent lexicon (never a hidden model).
2. Unmodelled red flags: document evidence the ML features don't already capture (e.g. a
   going-concern emphasis). Flags whose signal *is* a model feature are skipped to avoid
   double counting.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass

NOTE_CAP = 40
NOTES_TOTAL_CAP = 80
FLAGS_TOTAL_CAP = 90


@dataclass
class Overlay:
    source: str  # analyst_note | red_flag
    label: str
    points: int
    rationale: str
    five_c: str
    reference_id: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


# (pattern, points, five_c, rationale)
NOTE_RULES: list[tuple[str, int, str, str]] = [
    (r"(?:plant|factory|unit|operations?)[^.]{0,25}(?:shut ?down|closed|non[- ]operational|idle)", -35, "capacity", "Operations halted"),
    (r"(?:labou?r )?strike|lock[- ]?out", -20, "capacity", "Labour disruption"),
    (r"(?:inventory|stock)[^.]{0,30}(?:mismatch|not (?:found|available|traceable)|shortfall)", -30, "character", "Stock verification failed"),
    (r"(?:promoter|management)[^.]{0,30}(?:evasive|non[- ]?cooperative|unavailable|not available|unresponsive)", -20, "character", "Management cooperation concern"),
    (r"(?:books|accounts) (?:not maintained|incomplete)|no proper records", -20, "character", "Weak record keeping"),
    (r"(?:lost|loss of)[^.]{0,20}(?:key|major|anchor|largest) (?:customer|client|buyer)|customer concentration", -15, "conditions", "Customer concentration / loss"),
    (r"(?:title|property)[^.]{0,30}(?:defect|dispute|encumbered|not clear)|encumbrance", -20, "collateral", "Collateral title issue"),
    (r"pollution control[^.]{0,30}(?:notice|closure)|environmental (?:violation|notice)", -15, "conditions", "Environmental compliance issue"),
    (r"diversion of funds|fund diversion|siphon", -40, "character", "Possible diversion of funds"),
    (r"(?:order book|orders?)[^.]{0,25}(?:strong|healthy|robust|visibility)|new (?:export )?(?:contracts?|orders?)", 10, "capacity", "Order-book visibility"),
    (r"(?:promoter|equity)[^.]{0,20}(?:infusion|infused|brought in)", 12, "capital", "Fresh promoter equity"),
    (r"(?:collateral|property|security)[^.]{0,25}(?:verified|clear (?:and marketable )?title|adequate)", 8, "collateral", "Collateral verified"),
    (r"site visit[^.]{0,40}(?:satisfactory|good|positive)|well[- ]maintained|good housekeeping", 8, "capacity", "Satisfactory site visit"),
    (r"(?:experienced|seasoned|strong) (?:promoter|management)|second[- ]generation", 6, "character", "Experienced management"),
    (r"(?:government|psu|blue[- ]chip) (?:customers?|clients?)|reputed (?:customers?|clients?)", 6, "conditions", "Quality counterparties"),
    (r"(?:delay|delayed)[^.]{0,20}(?:stock statements?|submission)", -8, "character", "Delayed stock statements"),
]
_CAPACITY_RE = re.compile(r"(?:operating|running|utili[sz]ation|utili[sz]ed)[^.%]{0,30}?(\d{1,3})\s?%|(\d{1,3})\s?%\s*(?:capacity|utili[sz]ation)", re.I)


def infer_note_impact(body: str) -> tuple[int, str, str]:
    """Return (points, five_c, rationale) inferred from note text."""
    text = body.lower()
    points, reasons, five_c = 0, [], "capacity"
    m = _CAPACITY_RE.search(text)
    if m and "capacit" in text or (m and "utili" in text):
        pct = int(m.group(1) or m.group(2))
        if pct < 75:
            delta = -min(30, round((75 - pct) * 0.6))
            reasons.append(f"Capacity utilisation {pct}% vs 75% benchmark ({delta} pts)")
        else:
            delta = 6
            reasons.append(f"Healthy capacity utilisation {pct}% (+6 pts)")
        points += delta
    for pattern, pts, c, rationale in NOTE_RULES:
        if re.search(pattern, text):
            points += pts
            five_c = c if abs(pts) >= abs(points - pts) else five_c
            reasons.append(f"{rationale} ({pts:+d} pts)")
    points = max(-NOTE_CAP, min(NOTE_CAP, points))
    return points, five_c, "; ".join(reasons) if reasons else "No score-relevant signal detected"


# label -> (points, covered_by_model_feature or None)
RED_FLAG_POINTS: dict[str, tuple[int, str | None]] = {
    "Going-concern uncertainty flagged by auditor": (-40, None),
    "Qualified/adverse audit opinion": (-35, None),
    "Auditor emphasis of matter": (-12, None),
    "Wilful defaulter reference": (-80, None),
    "NPA / SMA classification mentioned": (-50, None),
    "Debt restructuring": (-20, None),
    "One-time settlement": (-25, None),
    "Cheque/ECS bounces": (0, "bank_bounce_count"),
    "Overdue / delayed payments": (-10, None),
    "Liquidity stress": (-12, None),
    "Limit overdrawals": (-15, None),
    "Margin compression": (-6, None),
    "Material related-party transactions": (-8, None),
    "Promoter share pledge": (0, "promoter_pledge_pct"),
    "Credit rating downgrade / negative outlook": (-18, None),
    "Circular trading / round-tripping suspicion": (0, "fraud_score"),
    "Possible revenue inflation": (-20, None),
    "Insolvency proceedings (NCLT/IBC)": (0, "litigation_score"),
    "Recovery proceedings (SARFAESI/DRT)": (0, "litigation_score"),
    "Investigative agency action": (-40, None),
    "GST evasion / show-cause notice": (-15, None),
    "GSTR-2A vs 3B mismatch": (0, "gst_mismatch_pct"),
    "ITC claim under question": (-5, None),
    "Reliance on unsecured promoter funding": (-3, None),
    "Contingent liabilities disclosed": (-3, None),
    "Auditor resignation": (-25, None),
    "KMP resignation": (-8, None),
    "Low capacity utilisation": (-10, None),
}


def note_overlays(notes: list[dict]) -> list[Overlay]:
    out: list[Overlay] = []
    for note in notes:
        if note.get("kind", "note") != "note":
            continue
        if note.get("impact_points") is not None:
            pts = max(-NOTE_CAP, min(NOTE_CAP, int(note["impact_points"])))
            rationale = f"Analyst-assigned impact. {note.get('impact_rationale') or ''}".strip()
            five_c = note.get("five_c") or "capacity"
        else:
            pts, five_c, rationale = infer_note_impact(note["body"])
            five_c = note.get("five_c") or five_c
        if pts:
            out.append(Overlay("analyst_note", note["body"][:140], pts, rationale, five_c, note.get("id")))
    total = sum(o.points for o in out)
    if abs(total) > NOTES_TOTAL_CAP:
        scale = NOTES_TOTAL_CAP / abs(total)
        for o in out:
            o.points = round(o.points * scale)
    return out


def red_flag_overlays(red_flags: list[dict], features_present: set[str]) -> list[Overlay]:
    out: list[Overlay] = []
    for flag in red_flags:
        pts, covered_by = RED_FLAG_POINTS.get(flag["label"], (-5, None))
        if covered_by and covered_by in features_present:
            continue  # the ML feature already prices this signal
        if covered_by and not pts:
            pts = -12  # feature missing (e.g. no bank statement) -> fall back to a modest overlay
        if pts:
            out.append(Overlay("red_flag", flag["label"], pts, f"Evidence: {flag.get('evidence', '')[:180]}",
                               flag.get("five_c", "character"), flag.get("document_id")))
    total = sum(o.points for o in out)
    if total < -FLAGS_TOTAL_CAP:
        scale = FLAGS_TOTAL_CAP / abs(total)
        for o in out:
            o.points = round(o.points * scale)
    return out
