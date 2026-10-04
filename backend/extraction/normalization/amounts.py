"""Parse Indian-format monetary amounts into absolute INR."""

from __future__ import annotations

import re

UNIT_MULTIPLIERS: dict[str, float] = {
    "crore": 1e7,
    "crores": 1e7,
    "cr": 1e7,
    "cr.": 1e7,
    "crs": 1e7,
    "lakh": 1e5,
    "lakhs": 1e5,
    "lac": 1e5,
    "lacs": 1e5,
    "lkh": 1e5,
    "l": 1e5,
    "million": 1e6,
    "mn": 1e6,
    "mio": 1e6,
    "billion": 1e9,
    "bn": 1e9,
    "thousand": 1e3,
    "thousands": 1e3,
    "k": 1e3,
    "'000": 1e3,
    "000s": 1e3,
}

# A number with optional currency prefix, Indian/Western grouping, decimals,
# accounting-style negatives "(1,234)" and an optional unit suffix.
AMOUNT_RE = re.compile(
    r"(?P<neg>\()?\s*(?:(?:rs\.?|inr|₹)\s*)?(?P<minus>-)?\s*"
    r"(?P<num>\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*\)?\s*"
    r"(?P<unit>crores?|cr\.?|crs|lakhs?|lacs?|million|mn|billion|bn|thousands?)?\b",
    re.I,
)

STATEMENT_UNIT_RE = re.compile(
    r"(?:amount|figures|all amounts|rs\.?|inr|₹)[^\n]{0,30}?\bin\s+(crores?|cr|lakhs?|lacs?|millions?|mn|thousands?|'000)",
    re.I,
)

_NULLISH = {"", "-", "—", "–", "nil", "na", "n/a", "--"}


def detect_statement_unit(text: str) -> tuple[str | None, float]:
    """Find a header such as '(₹ in Lakhs)' and return (unit, multiplier)."""
    match = STATEMENT_UNIT_RE.search(text[:6000])
    if not match:
        return None, 1.0
    unit = match.group(1).lower().rstrip("s") if match.group(1) != "'000" else "'000"
    key = {"crore": "crore", "cr": "crore", "lakh": "lakh", "lac": "lakh", "million": "million", "mn": "million",
           "thousand": "thousand", "'000": "thousand"}.get(unit, unit)
    return key, UNIT_MULTIPLIERS.get(key, 1.0)


def parse_amount(raw: str | None, *, default_multiplier: float = 1.0) -> float | None:
    """Parse '₹ 12,34,567.50', '(1,234)', '45.6 Cr', '12 lakh' → absolute INR float."""
    if raw is None:
        return None
    text = raw.strip().replace("−", "-")
    if text.lower() in _NULLISH:
        return None
    match = AMOUNT_RE.search(text)
    if not match:
        return None
    number = float(match.group("num").replace(",", ""))
    unit = (match.group("unit") or "").lower().rstrip(".")
    multiplier = UNIT_MULTIPLIERS.get(unit, default_multiplier) if unit else default_multiplier
    value = number * multiplier
    if match.group("neg") and text.rstrip().endswith(")") or match.group("minus"):
        value = -value
    return round(value, 2)


def find_amounts(line: str, *, default_multiplier: float = 1.0) -> list[float]:
    """All amounts on a line (used for multi-column statement rows)."""
    values: list[float] = []
    for match in AMOUNT_RE.finditer(line):
        token = match.group(0)
        # Skip 4-digit years masquerading as amounts (e.g. "FY2024", "2023-24").
        num = match.group("num")
        if re.fullmatch(r"(19|20)\d{2}", num) and not match.group("unit"):
            continue
        parsed = parse_amount(token, default_multiplier=default_multiplier)
        if parsed is not None:
            values.append(parsed)
    return values


def parse_percent(raw: str | None) -> float | None:
    if not raw:
        return None
    match = re.search(r"(-?\d+(?:\.\d+)?)\s*%", raw)
    return float(match.group(1)) if match else None
