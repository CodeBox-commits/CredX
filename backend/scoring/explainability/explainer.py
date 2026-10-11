"""Exact TreeSHAP explanations (XGBoost ``pred_contribs``) mapped to integer score points.

The integer points are allocated with the largest-remainder method so that
``base_points + Σ points == model_score`` holds exactly for the UI waterfall.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from scoring.feature_engineering.features import FEATURE_NAMES, SPEC, describe, format_value
from scoring.inference.scale import clamp_score, logit_to_points, margin_to_score, pd_to_score, score_to_pd

__all__ = ["clamp_score", "explain", "pd_to_score", "predict_margin", "score_to_pd", "what_if"]


def _matrix(features: dict[str, float | None]):
    import xgboost as xgb

    row = np.array([[np.nan if features.get(n) is None else features[n] for n in FEATURE_NAMES]], dtype=float)
    return xgb.DMatrix(row, feature_names=FEATURE_NAMES, missing=np.nan)


def predict_margin(booster: Any, features: dict[str, float | None]) -> float:
    return float(booster.predict(_matrix(features), output_margin=True)[0])


def _allocate(exact: list[float], target: int) -> list[int]:
    ints = [math.floor(x) for x in exact]
    remainder = target - sum(ints)
    order = sorted(range(len(exact)), key=lambda i: exact[i] - ints[i], reverse=remainder > 0)
    step = 1 if remainder > 0 else -1
    i = 0
    while remainder and order:
        ints[order[i % len(order)]] += step
        remainder -= step
        i += 1
    return ints


def explain(booster: Any, features: dict[str, float | None]) -> dict[str, Any]:
    dm = _matrix(features)
    contribs = booster.predict(dm, pred_contribs=True)[0]
    margin = float(booster.predict(dm, output_margin=True)[0])
    bias, phi = float(contribs[-1]), [float(x) for x in contribs[:-1]]
    base_exact = margin_to_score(bias)
    exact = [logit_to_points(x) for x in phi]
    raw = base_exact + sum(exact)
    model_score = clamp_score(raw)
    base_points = int(round(base_exact))
    points = _allocate(exact, model_score - base_points)

    contributions = []
    for name, pts, pts_exact in zip(FEATURE_NAMES, points, exact):
        value = features.get(name)
        spec = SPEC[name]
        contributions.append({
            "feature": name, "label": spec.label, "value": value, "display_value": format_value(name, value),
            "points": pts, "points_exact": round(pts_exact, 3),
            "direction": "reduces_risk" if pts_exact >= 0 else "increases_risk",
            "description": describe(name, value, pts_exact >= 0), "five_c": spec.five_c, "missing": value is None,
        })
    contributions.sort(key=lambda c: -abs(c["points_exact"]))
    return {"raw_score": raw, "probability_of_default": 1 / (1 + math.exp(-margin)), "base_points": base_points,
            "contributions": contributions}


# feature -> (target value, better-when-lower)
_TARGETS: dict[str, tuple[float, bool]] = {
    "dscr": (1.5, False), "interest_coverage": (3.0, False), "debt_to_ebitda": (3.0, True), "debt_equity": (1.5, True),
    "current_ratio": (1.33, False), "receivable_days": (75, True), "gst_mismatch_pct": (2.0, True),
    "bank_bounce_count": (0, True), "promoter_pledge_pct": (10.0, True), "collateral_coverage": (1.5, False),
    "cashflow_volatility": (0.2, True),
}


def what_if(booster: Any, features: dict[str, float | None], contributions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Single-lever counterfactuals: how many points each actionable improvement would add."""
    current = clamp_score(margin_to_score(predict_margin(booster, features)))
    hurting = {c["feature"] for c in contributions if c["points_exact"] < 0}
    out = []
    for name, (target, lower_better) in _TARGETS.items():
        value = features.get(name)
        if value is None or name not in hurting:
            continue
        if (lower_better and value <= target) or (not lower_better and value >= target):
            continue
        new = clamp_score(margin_to_score(predict_margin(booster, {**features, name: target})))
        if new - current >= 3:
            out.append({"feature": name, "label": SPEC[name].label, "current": format_value(name, value),
                        "target": format_value(name, target), "score_gain": new - current})
    return sorted(out, key=lambda w: -w["score_gain"])[:5]
