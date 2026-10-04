from __future__ import annotations

import re

AMOUNT_PATTERN = re.compile(
    r"(?P<currency>rs\.?|inr|usd|eur|gbp|aed|sgd|jpy|cny|₹)?\s*"
    r"(?P<value>-?\d[\d,]*(?:\.\d+)?)\s*"
    r"(?P<unit>crore|cr|lakh|lac|million|mn|billion|bn)?",
    re.I,
)

UNIT_MULTIPLIERS = {
    "crore": 10_000_000,
    "cr": 10_000_000,
    "lakh": 100_000,
    "lac": 100_000,
    "million": 1_000_000,
    "mn": 1_000_000,
    "billion": 1_000_000_000,
    "bn": 1_000_000_000,
}


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_amount(raw_amount: str) -> float | None:
    match = AMOUNT_PATTERN.search(raw_amount)
    if not match:
        return None

    value = float(match.group("value").replace(",", ""))
    unit = (match.group("unit") or "").lower()
    return value * UNIT_MULTIPLIERS.get(unit, 1)


def extract_first_amount(text: str, patterns: list[re.Pattern[str]]) -> float | None:
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            amount = parse_amount(match.group(1))
            if amount is not None:
                return amount
    return None
