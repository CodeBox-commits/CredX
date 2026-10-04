"""Formatting helpers shared by all CAM renderers."""

from __future__ import annotations

from typing import Any

from utils.india import format_inr, format_inr_short


def inr(v: Any) -> str:
    return format_inr_short(v) if isinstance(v, int | float) else "—"


def inr_full(v: Any) -> str:
    return format_inr(v) if isinstance(v, int | float) else "—"


def pct(v: Any, digits: int = 1) -> str:
    return f"{v * 100:.{digits}f}%" if isinstance(v, int | float) else "—"


def times(v: Any) -> str:
    return f"{v:.2f}x" if isinstance(v, int | float) else "—"


def days(v: Any) -> str:
    return f"{v:.0f}" if isinstance(v, int | float) else "—"


def label(s: str | None) -> str:
    return (s or "—").replace("_", " ").title()


DECISION_TEXT = {
    "APPROVE": "Approve",
    "APPROVE_WITH_CONDITIONS": "Approve with conditions",
    "REFER": "Refer to credit committee",
    "DECLINE": "Decline",
}
