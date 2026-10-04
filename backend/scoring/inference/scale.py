"""PDO (points-to-double-odds) score scaling, as used in bureau and bank scorecards.

    score = BASE_SCORE + FACTOR · ln(odds_good / BASE_ODDS),  FACTOR = PDO / ln 2

Because score is linear in log-odds, per-feature SHAP log-odds contributions map
*exactly* to score points: points_i = −FACTOR · shap_i. The waterfall in the UI
therefore sums precisely to the model score.
"""

from __future__ import annotations

import math

BASE_SCORE = 660.0  # score at BASE_ODDS
BASE_ODDS = 19.0  # 19:1 good:bad  ⇔  PD = 5%
PDO = 45.0
FACTOR = PDO / math.log(2)
MIN_SCORE, MAX_SCORE = 300, 900


def pd_to_score(pd: float) -> float:
    pd = min(max(pd, 1e-5), 1 - 1e-5)
    return BASE_SCORE + FACTOR * math.log(((1 - pd) / pd) / BASE_ODDS)


def logit_to_points(logit_contribution: float) -> float:
    """A +x log-odds-of-default contribution costs FACTOR·x points."""
    return -FACTOR * logit_contribution


def base_points(base_logit: float) -> float:
    # base_logit is log-odds of *default*; odds_good = exp(-base_logit)
    return BASE_SCORE + FACTOR * (-base_logit - math.log(BASE_ODDS))


def score_to_pd(score: float) -> float:
    odds_good = BASE_ODDS * math.exp((score - BASE_SCORE) / FACTOR)
    return 1 / (1 + odds_good)


def clamp_score(score: float) -> int:
    return int(round(min(MAX_SCORE, max(MIN_SCORE, score))))
