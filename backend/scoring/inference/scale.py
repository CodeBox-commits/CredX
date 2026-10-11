"""Points-to-double-odds (PDO) scaling, as in bureau and bank scorecards.

    score = BASE_SCORE + FACTOR · ln(odds_good / BASE_ODDS),   FACTOR = PDO / ln 2

Score is linear in log-odds, so each SHAP log-odds contribution maps *exactly* to score points
(points_i = −FACTOR · shap_i) and the explanation waterfall sums to the model score.
"""

from __future__ import annotations

import math

BASE_SCORE = 680.0  # score at BASE_ODDS
BASE_ODDS = 20.0  # 20:1 good:bad  <=>  PD ≈ 4.8%
PDO = 20.0
FACTOR = PDO / math.log(2)
MIN_SCORE, MAX_SCORE = 300, 900


def margin_to_score(margin: float) -> float:
    """``margin`` is the model's log-odds of default; odds_good = exp(-margin)."""
    return BASE_SCORE + FACTOR * (-margin - math.log(BASE_ODDS))


def logit_to_points(contribution: float) -> float:
    """A +x log-odds-of-default contribution costs FACTOR·x points."""
    return -FACTOR * contribution


def pd_to_score(pd: float) -> float:
    pd = min(max(pd, 1e-9), 1 - 1e-9)
    return margin_to_score(math.log(pd / (1 - pd)))


def score_to_pd(score: float) -> float:
    odds_good = BASE_ODDS * math.exp((score - BASE_SCORE) / FACTOR)
    return 1 / (1 + odds_good)


def clamp_score(score: float) -> int:
    return int(round(min(MAX_SCORE, max(MIN_SCORE, score))))
