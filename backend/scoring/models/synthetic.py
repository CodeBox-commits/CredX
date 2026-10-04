"""Synthetic Indian mid-corporate default dataset.

Real default data is proprietary, so CredX ships a generator with economically
sensible, correlated distributions (latent credit quality drives ratios) and a
known ground-truth default process. It is used for the bundled model, unit tests
and the ``ml/`` training pipeline; replace with a bank's own performance data
(same columns) in production.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..feature_engineering.features import FEATURE_NAMES

SECTOR_RISK = np.array([0.32, 0.35, 0.38, 0.44, 0.45, 0.47, 0.48, 0.50, 0.52, 0.55, 0.62, 0.68])


def true_logit(df: pd.DataFrame) -> np.ndarray:
    f = df.fillna(df.median(numeric_only=True))
    return (
        -3.85
        - 1.15 * np.clip(f.dscr - 1.3, -1.2, 2.0)
        + 0.22 * np.clip(f.debt_to_ebitda - 3.0, -2.5, 8.0)
        + 0.12 * np.clip(f.debt_to_equity - 1.2, -1, 6)
        - 0.55 * np.clip(f.current_ratio - 1.25, -1, 2)
        - 5.5 * (f.ebitda_margin - 0.11)
        - 2.0 * (f.pat_margin - 0.04)
        - 1.4 * np.clip(f.revenue_growth - 0.08, -0.6, 0.8)
        + 0.006 * (f.receivable_days - 75)
        - 0.30 * (f.log_revenue - 8.9)
        + 1.5 * f.gst_bank_variance
        + 2.2 * f.itc_excess
        + 0.35 * f.bounce_rate
        + 0.45 * f.litigation_score
        + 1.3 * (f.adverse_media - 0.3)
        + 1.6 * (f.sector_risk - 0.47)
        + 1.1 * f.promoter_pledge
        + 2.6 * f.fraud_score
    ).to_numpy()


def generate_dataset(n: int = 20000, seed: int = 42, missing_rate: float = 0.08) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    q = rng.normal(0, 1, n)  # latent credit quality
    fraud_latent = rng.random(n) < (0.05 + 0.04 * (q < -1))

    dscr = np.exp(rng.normal(0.33 + 0.33 * q, 0.32))
    icr = dscr * np.exp(rng.normal(0.55, 0.25, n))
    d_ebitda = np.exp(rng.normal(1.05 - 0.38 * q, 0.42))
    d_equity = np.exp(rng.normal(0.05 - 0.33 * q, 0.45))
    current = np.exp(rng.normal(0.24 + 0.14 * q, 0.22))
    ebitda_m = rng.normal(0.115 + 0.035 * q, 0.04)
    pat_m = ebitda_m - np.abs(rng.normal(0.065, 0.02, n))
    growth = rng.normal(0.08 + 0.06 * q, 0.14)
    rec_days = np.exp(rng.normal(4.3 - 0.18 * q, 0.33))
    log_rev = rng.normal(8.9 + 0.15 * q, 0.5)
    gst_var = np.abs(rng.normal(0.04, 0.04, n)) + fraud_latent * np.abs(rng.normal(0.35, 0.15, n))
    itc_excess = np.where(fraud_latent, np.abs(rng.normal(0.3, 0.15, n)), np.abs(rng.normal(0.0, 0.02, n)))
    bounces = rng.poisson(np.exp(-1.6 - 0.8 * q)) / 3
    lit_p = 1 / (1 + np.exp(1.8 + 1.0 * q))
    litigation = np.where(rng.random(n) < lit_p, rng.choice([1, 2, 3], n, p=[0.5, 0.35, 0.15]), 0)
    adverse = np.clip(rng.beta(2, 5, n) + 0.12 * (q < -1) + 0.25 * fraud_latent, 0, 1)
    sector = rng.choice(SECTOR_RISK, n)
    pledge = np.where(rng.random(n) < 0.2 + 0.15 * (q < -0.5), rng.uniform(0.05, 0.7, n), 0.0)
    fraud = np.clip(np.where(fraud_latent, rng.normal(0.62, 0.15, n), rng.normal(0.08, 0.07, n)), 0, 1)

    df = pd.DataFrame(
        {
            "dscr": dscr, "interest_coverage": icr, "debt_to_ebitda": d_ebitda, "debt_to_equity": d_equity,
            "current_ratio": current, "ebitda_margin": ebitda_m, "pat_margin": pat_m, "revenue_growth": growth,
            "receivable_days": rec_days, "log_revenue": log_rev, "gst_bank_variance": gst_var,
            "itc_excess": itc_excess, "bounce_rate": bounces, "litigation_score": litigation.astype(float),
            "adverse_media": adverse, "sector_risk": sector, "promoter_pledge": pledge, "fraud_score": fraud,
        }
    )[FEATURE_NAMES]
    pd_true = 1 / (1 + np.exp(-true_logit(df)))
    df["default"] = (rng.random(n) < pd_true).astype(int)

    # Thin-file realism: randomly blank non-core features.
    for col in ("revenue_growth", "receivable_days", "gst_bank_variance", "itc_excess", "bounce_rate",
                "promoter_pledge", "litigation_score", "adverse_media", "fraud_score"):
        mask = rng.random(n) < missing_rate
        df.loc[mask, col] = np.nan
    return df
