"""Normalise Indian fiscal-year and month expressions."""

from __future__ import annotations

import re

_FY_PATTERNS = [
    # FY2024-25, FY 2024-2025, F.Y. 2024-25
    (re.compile(r"\bF\.?Y\.?\s*'?(20\d{2})\s*[-/–]\s*(\d{2,4})\b", re.I), lambda m: int(m.group(1)) + 1),
    # 2024-25, 2024-2025
    (re.compile(r"\b(20\d{2})\s*[-/–]\s*(\d{2}|20\d{2})\b"), lambda m: int(m.group(1)) + 1),
    # FY25, FY'25, FY 2025
    (re.compile(r"\bF\.?Y\.?\s*'?(\d{2}|20\d{2})\b", re.I),
     lambda m: int(m.group(1)) if len(m.group(1)) == 4 else 2000 + int(m.group(1))),
    # 31.03.2025, 31-03-2025, 31st March 2025, March 31, 2025
    (re.compile(r"\b31(?:st)?[\s./-]*(?:03|mar(?:ch)?)[\s./,-]*(20\d{2})\b", re.I), lambda m: int(m.group(1))),
    (re.compile(r"\bmar(?:ch)?\s+31,?\s*(20\d{2})\b", re.I), lambda m: int(m.group(1))),
]

_MONTHS = {
    m: i + 1
    for i, names in enumerate(
        [("jan", "january"), ("feb", "february"), ("mar", "march"), ("apr", "april"), ("may",), ("jun", "june"),
         ("jul", "july"), ("aug", "august"), ("sep", "sept", "september"), ("oct", "october"),
         ("nov", "november"), ("dec", "december")]
    )
    for m in names
}

_MONTH_RE = re.compile(
    r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|"
    r"sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s'-]*(\d{2}|20\d{2})\b",
    re.I,
)
_ISO_MONTH_RE = re.compile(r"\b(20\d{2})[-/](0[1-9]|1[0-2])\b")


def fiscal_year_label(end_year: int) -> str:
    return f"FY{end_year}"


def parse_fiscal_year(text: str) -> str | None:
    """Return a canonical 'FY2025' label (FY ending March 2025) or None."""
    for pattern, resolver in _FY_PATTERNS:
        match = pattern.search(text)
        if match:
            year = resolver(match)
            if 2000 <= year <= 2100:
                return fiscal_year_label(year)
    return None


def find_fiscal_years(text: str) -> list[str]:
    """All distinct FY labels in order of appearance (used for table headers)."""
    found: list[tuple[int, str]] = []
    for pattern, resolver in _FY_PATTERNS:
        for match in pattern.finditer(text):
            year = resolver(match)
            label = fiscal_year_label(year)
            if 2000 <= year <= 2100 and label not in [f for _, f in found]:
                found.append((match.start(), label))
    return [label for _, label in sorted(found)]


def parse_month(text: str) -> str | None:
    """'Apr-24', 'April 2024', '2024-04' → '2024-04'."""
    iso = _ISO_MONTH_RE.search(text)
    if iso:
        return f"{iso.group(1)}-{iso.group(2)}"
    match = _MONTH_RE.search(text)
    if not match:
        return None
    month = _MONTHS[match.group(1).lower()[:3] if match.group(1).lower()[:4] != "sept" else "sep"]
    year = int(match.group(2))
    year = year if year > 100 else 2000 + year
    return f"{year}-{month:02d}"


def fiscal_year_of_month(period: str) -> str:
    year, month = (int(p) for p in period.split("-"))
    return fiscal_year_label(year + 1 if month >= 4 else year)
