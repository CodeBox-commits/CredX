"""Indian fiscal years (April–March) and statement periods, normalised to labels like ``FY25``."""

from __future__ import annotations

import re

_FY_PATTERNS: list[tuple[re.Pattern[str], callable]] = [
    # FY2024-25, F.Y. 2024-2025
    (re.compile(r"\bF\.?Y\.?\s*'?(20\d{2})\s*[-/–]\s*(\d{2}|20\d{2})\b", re.I), lambda m: int(m.group(1)) + 1),
    # 2024-25 / 2024-2025
    (re.compile(r"(?<![\d-])(20\d{2})\s*[-/–]\s*(\d{2}|20\d{2})(?![\d-])"), lambda m: _span_end(m)),
    # FY25, FY'25, FY 2025
    (re.compile(r"\bF\.?Y\.?\s*'?(\d{2}|20\d{2})\b", re.I),
     lambda m: int(m.group(1)) if len(m.group(1)) == 4 else 2000 + int(m.group(1))),
    # 31.03.2025 / 31-03-2025 / 31st March 2025 / March 31, 2025
    (re.compile(r"\b31(?:st)?[\s./-]*(?:03|mar(?:ch)?)[\s./,-]*(20\d{2})\b", re.I), lambda m: int(m.group(1))),
    (re.compile(r"\bmar(?:ch)?\s+31,?\s*(20\d{2})\b", re.I), lambda m: int(m.group(1))),
]


def _span_end(m: re.Match[str]) -> int | None:
    start, end = int(m.group(1)), m.group(2)
    end_year = int(end) if len(end) == 4 else (start // 100) * 100 + int(end)
    return end_year if end_year == start + 1 else None


def fy_label(end_year: int) -> str:
    """2025 -> 'FY25' (April 2024 – March 2025)."""
    return f"FY{end_year % 100:02d}"


def fy_end_year(label: str) -> int:
    return 2000 + int(label[2:])


def find_fiscal_years(text: str) -> list[str]:
    """Distinct FY labels in order of appearance: 'Particulars FY25 FY24' -> ['FY25', 'FY24']."""
    hits: list[tuple[int, str]] = []
    taken: list[tuple[int, int]] = []
    for pattern, resolver in _FY_PATTERNS:
        for match in pattern.finditer(text):
            if any(s <= match.start() < e for s, e in taken):
                continue
            year = resolver(match)
            if year is None or not 2000 <= year <= 2100:
                continue
            taken.append((match.start(), match.end()))
            label = fy_label(year)
            if label not in [lab for _, lab in hits]:
                hits.append((match.start(), label))
    return [label for _, label in sorted(hits)]
