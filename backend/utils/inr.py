"""Indian currency formatting helpers (lakh/crore grouping)."""

from __future__ import annotations

CRORE = 10_000_000
LAKH = 100_000


def group_indian(value: float, decimals: int = 0) -> str:
    """Format ``value`` with Indian digit grouping: 12,34,56,789."""
    negative = value < 0
    value = abs(value)
    whole = int(round(value, decimals)) if decimals == 0 else int(value)
    frac = f"{value - int(value):.{decimals}f}"[1:] if decimals else ""
    digits = str(whole)
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        digits = ",".join(parts + [tail])
    return f"{'-' if negative else ''}{digits}{frac}"


def format_inr(value: float | None, *, decimals: int = 0, symbol: bool = True) -> str:
    if value is None:
        return "—"
    return f"{'₹' if symbol else ''}{group_indian(value, decimals)}"


def format_inr_compact(value: float | None, *, symbol: bool = True, decimals: int = 2) -> str:
    """₹12.40 Cr / ₹45.0 L / ₹9,500."""
    if value is None:
        return "—"
    prefix = "₹" if symbol else ""
    sign = "-" if value < 0 else ""
    v = abs(value)
    if v >= CRORE:
        return f"{sign}{prefix}{v / CRORE:,.{decimals}f} Cr"
    if v >= LAKH:
        return f"{sign}{prefix}{v / LAKH:,.{max(decimals - 1, 0)}f} L"
    return f"{sign}{prefix}{group_indian(v)}"


def to_crore(value: float | None) -> float | None:
    return None if value is None else round(value / CRORE, 2)
