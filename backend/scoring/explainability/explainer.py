"""Turn SHAP contributions into analyst-readable explanations."""

from __future__ import annotations

import math
from typing import Any

from ..feature_engineering.features import SPEC_BY_NAME, FeatureVector, format_feature
from ..inference.scale import base_points, logit_to_points
from ..models.registry import ModelOutput

_TEMPLATES = {
    "dscr": ("Debt service coverage of {v} comfortably covers obligations", "Debt service coverage of {v} is thin against obligations"),
    "interest_coverage": ("Interest is covered {v} by EBITDA", "EBITDA covers interest only {v}"),
    "debt_to_ebitda": ("Leverage of {v} Debt/EBITDA is moderate", "Leverage of {v} Debt/EBITDA is elevated"),
    "debt_to_equity": ("Gearing of {v} indicates adequate equity cushion", "Gearing of {v} indicates thin equity cushion"),
    "current_ratio": ("Current ratio of {v} provides liquidity headroom", "Current ratio of {v} signals tight liquidity"),
    "ebitda_margin": ("Healthy EBITDA margin of {v}", "Weak EBITDA margin of {v}"),
    "pat_margin": ("Net margin of {v} supports internal accruals", "Net margin of {v} limits internal accruals"),
    "revenue_growth": ("Revenue growth of {v} shows business momentum", "Revenue growth of {v} reflects slowing demand"),
    "receivable_days": ("Receivable cycle of {v} is efficient", "Receivable cycle of {v} ties up working capital"),
    "log_revenue": ("Scale of operations ({v} revenue) adds resilience", "Small scale ({v} revenue) limits resilience"),
    "gst_bank_variance": ("GST turnover reconciles with banking ({v} variance)", "GST turnover deviates {v} from bank credits"),
    "itc_excess": ("ITC claims align with GSTR-2A/2B", "ITC claimed exceeds GSTR-2A/2B by {v}"),
    "bounce_rate": ("Clean banking conduct ({v} bounces/month)", "Bounces of {v} per month indicate cash stress"),
    "litigation_score": ("No material litigation", "Litigation exposure (severity {v}/3)"),
    "adverse_media": ("Benign media and promoter sentiment", "Adverse media / promoter sentiment ({v})"),
    "sector_risk": ("Sector backdrop is supportive", "Sector headwinds (sector risk {v})"),
    "promoter_pledge": ("Low promoter share pledge ({v})", "Promoter pledge of {v} signals funding stress"),
    "fraud_score": ("No material fraud indicators ({v})", "Fraud indicators raise risk (score {v})"),
}


def explain(features: FeatureVector, output: ModelOutput) -> dict[str, Any]:
    items = []
    for name, logit in output.contributions.items():
        value = features.values.get(name, float("nan"))
        points = round(logit_to_points(logit), 2)
        missing = isinstance(value, float) and math.isnan(value)
        spec = SPEC_BY_NAME[name]
        pos_text, neg_text = _TEMPLATES[name]
        text = "Not available — model used population default" if missing else (pos_text if points >= 0 else neg_text).format(
            v=format_feature(name, value)
        )
        items.append(
            {
                "feature": name,
                "label": spec.label,
                "group": spec.group,
                "value": None if missing else round(value, 4),
                "display_value": format_feature(name, value),
                "shap_logit": round(logit, 5),
                "points": points,
                "direction": "positive" if points >= 0 else "negative",
                "missing": missing,
                "explanation": text,
            }
        )
    items.sort(key=lambda i: -abs(i["points"]))
    return {
        "base_points": round(base_points(output.base_logit), 2),
        "items": items,
        "explainer": output.explainer,
        "model_version": output.model_version,
    }


def top_drivers(explanation: dict[str, Any], *, negative: bool, limit: int = 4, min_points: float = 1.5) -> list[str]:
    filtered = [
        i for i in explanation["items"]
        if not i["missing"] and ((i["points"] < -min_points) if negative else (i["points"] > min_points))
    ]
    return [i["explanation"] for i in filtered[:limit]]
