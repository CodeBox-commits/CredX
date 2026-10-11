"""Model validation report: discrimination, calibration by score band, stability and global SHAP.

    cd backend && python ../ml/evaluation/evaluate.py [--rows 20000] [--json out.json]

Credit-risk model governance (RBI's model risk expectations) needs more than AUC: this prints
KS, Gini, Brier, a decile calibration table, the score-band default rates the policy relies on
and the population stability index (PSI) against a fresh sample.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))

import numpy as np  # noqa: E402
import xgboost as xgb  # noqa: E402
from sklearn.metrics import brier_score_loss, roc_auc_score  # noqa: E402

from scoring.decision_logic.sizing_pricing import GRADES  # noqa: E402
from scoring.explainability.explainer import pd_to_score  # noqa: E402
from scoring.feature_engineering.features import FEATURE_NAMES  # noqa: E402
from scoring.models import synthetic  # noqa: E402
from scoring.models.registry import get_model  # noqa: E402
from scoring.models.trainer import ks_statistic  # noqa: E402


def psi(expected: np.ndarray, actual: np.ndarray, bins: int = 10) -> float:
    edges = np.quantile(expected, np.linspace(0, 1, bins + 1))
    edges[0], edges[-1] = -np.inf, np.inf
    e = np.histogram(expected, edges)[0] / len(expected) + 1e-6
    a = np.histogram(actual, edges)[0] / len(actual) + 1e-6
    return float(np.sum((a - e) * np.log(a / e)))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=20000)
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
    model = get_model()
    X, y = synthetic.generate(args.rows, seed=2026)
    p = model.booster.predict(xgb.DMatrix(X, feature_names=FEATURE_NAMES))
    scores = np.array([pd_to_score(v) for v in p])

    deciles = []
    order = np.argsort(p)
    for chunk in np.array_split(order, 10):
        deciles.append({"mean_pd": round(float(p[chunk].mean()), 4), "observed": round(float(y[chunk].mean()), 4), "n": len(chunk)})
    bands = []
    floors = [g[0] for g in GRADES]
    for i, (floor, grade, risk, *_ ) in enumerate(GRADES):
        ceil = floors[i - 1] if i else 10_000
        mask = (scores >= floor) & (scores < ceil)
        if mask.any():
            bands.append({"grade": grade, "risk": risk, "share": round(float(mask.mean()), 3), "default_rate": round(float(y[mask].mean()), 4)})
    X2, _ = synthetic.generate(args.rows, seed=99)
    p2 = model.booster.predict(xgb.DMatrix(X2, feature_names=FEATURE_NAMES))
    report = {
        "model_version": model.version,
        "auc": round(float(roc_auc_score(y, p)), 4),
        "gini": round(2 * float(roc_auc_score(y, p)) - 1, 4),
        "ks": round(ks_statistic(y, p), 4),
        "brier": round(float(brier_score_loss(y, p)), 4),
        "psi_vs_fresh_sample": round(psi(p, p2), 4),
        "calibration_deciles": deciles,
        "grade_bands": bands,
        "global_importance": model.meta.get("global_importance", [])[:10],
    }
    print(json.dumps(report, indent=2))
    if args.json:
        args.json.write_text(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
