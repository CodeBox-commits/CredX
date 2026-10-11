"""Parse Indian-format monetary amounts (₹ / Rs / INR, lakh / crore grouping) into absolute rupees."""

from __future__ import annotations

import re

from extraction.normalization.fiscal import find_fiscal_years  # noqa: F401 - re-exported for callers parsing statements

UNITS: dict[str, float] = {
    "crore": 1e7, "crores": 1e7, "cr": 1e7, "crs": 1e7,
    "lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "lacs": 1e5,
    "million": 1e6, "mn": 1e6, "billion": 1e9, "bn": 1e9,
    "thousand": 1e3, "thousands": 1e3,
}

AMOUNT_RE = re.compile(
    r"(?P<open>\()?\s*(?:(?:rs\.?|inr|₹|usd|\$)\s*)?(?P<minus>-)?\s*"
    r"(?P<num>\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)"
    r"(?P<close>\))?\s*(?P<unit>crores?|cr\b\.?|crs\b|lakhs?|lacs?|million|mn\b|billion|bn\b|thousands?)?",
    re.I,
)
_CURRENCY_RE = re.compile(r"(?:rs\.?|inr|₹|usd|\$)\s*$", re.I)
_SCALE_RE = re.compile(
    r"(?:₹|rs\.?|inr|amounts?|figures)[^\n]{0,25}?\bin\s+(crores?|cr\b|lakhs?|lacs?|millions?|mn\b|thousands?|'000)", re.I)
_NULLISH = {"", "-", "—", "–", "nil", "na", "n/a", "--"}


def _unit_multiplier(unit: str | None) -> float | None:
    if not unit:
        return None
    unit = unit.lower().rstrip(".")
    if unit.endswith("s") and unit not in UNITS:
        unit = unit[:-1]
    return UNITS.get(unit)


def detect_scale(text: str) -> float:
    """Statement-level unit such as '(₹ in lakhs)' -> 1e5; defaults to 1 (absolute rupees)."""
    match = _SCALE_RE.search(text[:20000])
    if not match:
        return 1.0
    unit = match.group(1).lower()
    return 1e3 if unit == "'000" else (_unit_multiplier(unit) or 1.0)


def _value(match: re.Match[str], default_multiplier: float) -> float:
    number = float(match.group("num").replace(",", ""))
    mult = _unit_multiplier(match.group("unit"))
    value = number * (mult if mult is not None else default_multiplier)
    if match.group("minus") or (match.group("open") and match.group("close")):
        value = -value
    return round(value, 2)


def parse_amount(raw: str | None, *, default_multiplier: float = 1.0) -> float | None:
    """'INR 186 crore' -> 1.86e9, '₹ 1,20,00,000' -> 1.2e7, '(1,234.50) crore' -> -1.2345e10."""
    if raw is None or raw.strip().lower() in _NULLISH:
        return None
    for match in AMOUNT_RE.finditer(raw.replace("−", "-")):
        num = match.group("num")
        if re.fullmatch(r"(19|20)\d{2}", num) and not match.group("unit") and not _CURRENCY_RE.search(raw[: match.start("num")]):
            continue  # a bare year is not an amount
        return _value(match, default_multiplier)
    return None


def find_amounts(text: str, *, default_multiplier: float = 1.0, money_only: bool = False) -> list[tuple[float, str]]:
    """All amounts in ``text`` as (value, matched text). ``money_only`` keeps only those with a currency or unit."""
    out: list[tuple[float, str]] = []
    for match in AMOUNT_RE.finditer(text.replace("−", "-")):
        num = match.group("num")
        has_currency = bool(re.search(r"rs|inr|₹|usd|\$", match.group(0), re.I))
        if re.fullmatch(r"(19|20)\d{2}", num) and not match.group("unit") and not has_currency:
            continue
        if money_only and not (has_currency or match.group("unit")):
            continue
        tail = text[match.end(): match.end() + 1]
        if tail == "%":
            continue
        out.append((_value(match, default_multiplier), match.group(0).strip()))
    return out
