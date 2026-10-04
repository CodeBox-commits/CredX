from __future__ import annotations

from ...schemas.platform import DecisionFactor


def build_factor_trace(raw_factors: list[DecisionFactor]) -> list[DecisionFactor]:
    return sorted(
        raw_factors,
        key=lambda factor: abs(factor.contribution),
        reverse=True,
    )
