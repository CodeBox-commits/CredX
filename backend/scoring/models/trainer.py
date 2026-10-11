"""Train the monotone-constrained XGBoost probability-of-default model and publish the artifact."""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

from scoring.feature_engineering.features import FEATURE_NAMES, FEATURES

MODEL_FILE, META_FILE = "pd_model.json", "pd_model.meta.json"
PARAMS: dict[str, Any] = {
    "objective": "binary:logistic", "eval_metric": "auc", "max_depth": 3, "eta": 0.05, "subsample": 0.85,
    "colsample_bytree": 0.85, "min_child_weight": 8, "lambda": 2.0, "tree_method": "hist", "seed": 7,
}
ROUNDS = 500


def monotone_constraints() -> str:
    """+1: PD may only rise with the feature; -1: only fall. Keeps every explanation economically sensible."""
    return "(" + ",".join(str(f.direction) for f in FEATURES) + ")"


def ks_statistic(y: np.ndarray, p: np.ndarray) -> float:
    order = np.argsort(p)
    ys = y[order]
    cum_bad = np.cumsum(ys) / max(1, ys.sum())
    cum_good = np.cumsum(1 - ys) / max(1, (1 - ys).sum())
    return float(np.max(np.abs(cum_bad - cum_good)))


def evaluate(y: np.ndarray, p: np.ndarray) -> dict[str, float]:
    from sklearn.metrics import brier_score_loss, roc_auc_score

    auc = float(roc_auc_score(y, p))
    return {"auc": round(auc, 4), "gini": round(2 * auc - 1, 4), "ks": round(ks_statistic(y, p), 4),
            "brier": round(float(brier_score_loss(y, p)), 4), "default_rate": round(float(y.mean()), 4), "test_rows": int(len(y))}


def train(out_dir: Path, X: np.ndarray | None = None, y: np.ndarray | None = None, n_rows: int = 30000) -> dict[str, Any]:
    import xgboost as xgb
    from sklearn.model_selection import train_test_split

    from scoring.models import synthetic

    started = time.perf_counter()
    source = "custom-csv" if X is not None else f"synthetic:{n_rows}"
    if X is None or y is None:
        X, y = synthetic.generate(n_rows, seed=PARAMS["seed"])
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=PARAMS["seed"], stratify=y)
    params = {**PARAMS, "monotone_constraints": monotone_constraints()}
    dtrain = xgb.DMatrix(X_tr, label=y_tr, feature_names=FEATURE_NAMES, missing=np.nan)
    dtest = xgb.DMatrix(X_te, label=y_te, feature_names=FEATURE_NAMES, missing=np.nan)
    booster = xgb.train(params, dtrain, num_boost_round=ROUNDS)

    p = booster.predict(dtest)
    contribs = np.abs(booster.predict(dtest, pred_contribs=True)[:, :-1]).mean(axis=0)
    gain = booster.get_score(importance_type="gain")
    importance = sorted(
        ({"feature": f.name, "label": f.label, "mean_abs_shap": round(float(c), 5), "gain": round(gain.get(f.name, 0.0), 3)}
         for f, c in zip(FEATURES, contribs)), key=lambda r: -r["mean_abs_shap"])
    now = datetime.now(UTC)
    meta = {
        "version": "xgb-" + now.strftime("%Y%m%d-%H%M%S"),
        "trained_at": now.isoformat(),
        "data_source": source,
        "features": [{"name": f.name, "label": f.label, "direction": f.direction} for f in FEATURES],
        "params": params,
        "trees": ROUNDS,
        "metrics": evaluate(y_te, p),
        "global_importance": importance,
        "training_seconds": round(time.perf_counter() - started, 2),
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    booster.save_model(str(out_dir / MODEL_FILE))
    (out_dir / META_FILE).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta
