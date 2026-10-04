from __future__ import annotations


def format_inr(value: float | None) -> str:
    if value is None:
        return "Unavailable"
    if value >= 10_000_000:
        return f"Rs {value / 10_000_000:.2f} Cr"
    if value >= 100_000:
        return f"Rs {value / 100_000:.2f} Lakh"
    return f"Rs {value:,.0f}"
