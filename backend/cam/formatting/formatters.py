from __future__ import annotations

from datetime import datetime

from utils.inr import format_inr, format_inr_compact


def money(value: float | None) -> str:
    return format_inr_compact(value)


def money_full(value: float | None) -> str:
    return format_inr(value)


def pct(value: float | None, digits: int = 1) -> str:
    return "—" if value is None else f"{value * 100:.{digits}f}%"


def times(value: float | None) -> str:
    return "—" if value is None else f"{value:.2f}x"


def date(value: datetime | str | None) -> str:
    if value is None:
        return "—"
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            return value
    return value.strftime("%d %b %Y")


def ratio(a: float | None, b: float | None) -> float | None:
    if a is None or b in (None, 0):
        return None
    return a / b  # type: ignore[operator]
