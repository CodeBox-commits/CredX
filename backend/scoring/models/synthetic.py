"""Synthetic Indian mid-corporate portfolio for bootstrapping the PD model.

There is no public labelled dataset of Indian mid-corporate defaults with GST, banking, litigation and
fraud-graph features. This generator draws correlated features from a latent "credit quality" factor
and defaults from a known logistic process encoding credit-policy priors. It exists so the explainable
pipeline works end to end — retrain on real portfolio history (same columns) before production use.
"""

from __future__ import annotations

import numpy as np

from scoring.feature_engineering.features import FEATURE_NAMES

SLOPE = 0.6  # < 1 keeps the bootstrap model from being over-confident at the extremes
MASKABLE = ("revenue_growth", "receivable_days", "gst_mismatch_pct", "bank_bounce_count", "cashflow_volatility",
            "litigation_score", "promoter_sentiment", "fraud_score", "promoter_pledge_pct", "collateral_coverage")


def _true_logit(f: dict[str, np.ndarray]) -> np.ndarray:
    return -2.95 + SLOPE * (
        - 1.10 * np.clip(f["dscr"] - 1.3, -1.2, 2.0)
        - 0.08 * np.clip(f["interest_coverage"] - 2.5, -2.5, 8)
        + 0.18 * np.clip(f["debt_to_ebitda"] - 3.0, -2.5, 8)
        + 0.25 * np.clip(f["debt_equity"] - 1.2, -1.2, 5)
        - 0.60 * np.clip(f["current_ratio"] - 1.25, -1.0, 2.0)
        - 6.00 * (f["ebitda_margin"] - 0.12)
        - 1.50 * np.clip(f["revenue_growth"] - 0.08, -0.6, 0.8)
        + 0.006 * (f["receivable_days"] - 75)
        + 0.05 * f["gst_mismatch_pct"]
        + 0.25 * np.minimum(f["bank_bounce_count"], 10)
        + 1.20 * (f["cashflow_volatility"] - 0.2)
        + 0.02 * f["litigation_score"]
        - 0.90 * f["promoter_sentiment"]
        + 0.035 * f["fraud_score"]
        + 0.012 * f["promoter_pledge_pct"]
        - 0.02 * np.clip(f["vintage_years"], 0, 40)
        - 0.35 * np.clip(f["collateral_coverage"], 0, 3)
        + 0.02 * (f["sector_risk"] - 47)
    )


def generate(n: int = 30000, seed: int = 7, missing_rate: float = 0.08) -> tuple[np.ndarray, np.ndarray]:
    """Return (X, y): X columns follow FEATURE_NAMES, NaN marks missing inputs."""
    rng = np.random.default_rng(seed)
    q = rng.normal(0, 1, n)  # latent credit quality
    fraudster = rng.random(n) < (0.04 + 0.05 * (q < -1))
    dscr = np.exp(rng.normal(0.35 + 0.32 * q, 0.30))
    f = {
        "dscr": dscr,
        "interest_coverage": dscr * np.exp(rng.normal(0.55, 0.25, n)),
        "debt_to_ebitda": np.exp(rng.normal(1.0 - 0.35 * q, 0.40)),
        "debt_equity": np.exp(rng.normal(-0.1 - 0.30 * q, 0.45)),
        "current_ratio": np.exp(rng.normal(0.22 + 0.12 * q, 0.18)),
        "ebitda_margin": rng.normal(0.12 + 0.035 * q, 0.045),
        "revenue_growth": rng.normal(0.08 + 0.06 * q, 0.14),
        "receivable_days": np.exp(rng.normal(4.3 - 0.15 * q, 0.35)),
        "gst_mismatch_pct": np.abs(rng.normal(1.5, 1.5, n)) + fraudster * np.abs(rng.normal(15, 8, n)),
        "bank_bounce_count": (rng.poisson(np.exp(-1.3 - 0.9 * q)) + fraudster * rng.poisson(1.5, n)).astype(float),
        "cashflow_volatility": np.exp(rng.normal(-1.6 - 0.25 * q, 0.45)),
        "litigation_score": np.clip(np.where(rng.random(n) < 1 / (1 + np.exp(1.6 + 0.9 * q)),
                                             rng.gamma(2.5, 14, n), rng.gamma(1.0, 3.0, n)), 0, 100),
        "promoter_sentiment": np.clip(rng.normal(0.1 + 0.22 * q, 0.3) - 0.4 * fraudster, -1, 1),
        "fraud_score": np.clip(np.where(fraudster, rng.normal(62, 15, n), rng.gamma(1.8, 5, n)), 0, 100),
        "promoter_pledge_pct": np.where(rng.random(n) < 0.15 + 0.15 * (q < -0.5), rng.uniform(5, 80, n), 0.0),
        "vintage_years": np.clip(rng.gamma(3, 6, n) + 2 * q, 0.5, 60),
        "collateral_coverage": np.clip(np.exp(rng.normal(0.15 + 0.12 * q, 0.45)), 0, 5),
        "sector_risk": np.clip(rng.normal(47, 12, n), 10, 90),
    }
    pd_true = 1 / (1 + np.exp(-_true_logit(f)))
    y = (rng.random(n) < pd_true).astype(int)
    X = np.column_stack([f[name] for name in FEATURE_NAMES])
    for name in MASKABLE:  # thin-file realism: trees learn sensible default branches
        col = FEATURE_NAMES.index(name)
        X[rng.random(n) < missing_rate, col] = np.nan
    return X, y
