"""Train the monotone-constrained XGBoost probability-of-default model."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from ..feature_engineering.features import FEATURE_NAMES, MODEL_FEATURES
from .synthetic import generate_dataset

DEFAULT_PARAMS: dict[str, Any] = {
    "n_estimators": 350,
    "max_depth": 4,
    "learning_rate": 0.05,
    "subsample": 0.85,
    "colsample_bytree": 0.85,
    "min_child_weight": 5,
    "reg_lambda": 2.0,
    "eval_metric": "auc",
}


def monotone_constraints() -> str:
    """+1 ⇒ PD may only rise with the feature; −1 ⇒ only fall. Keeps explanations intuitive."""
    signs = [1 if spec.higher_is_riskier else -1 for spec in MODEL_FEATURES]
    return "(" + ",".join(str(s) for s in signs) + ")"


def ks_statistic(y_true: np.ndarray, scores: np.ndarray) -> float:
    order = np.argsort(scores)
    y = y_true[order]
    cum_bad = np.cumsum(y) / max(1, y.sum())
    cum_good = np.cumsum(1 - y) / max(1, (1 - y).sum())
    return float(np.max(np.abs(cum_bad - cum_good)))


def evaluate(y_true: np.ndarray, pd_hat: np.ndarray) -> dict[str, float]:
    from sklearn.metrics import brier_score_loss, roc_auc_score

    auc = float(roc_auc_score(y_true, pd_hat))
    return {
        "auc": round(auc, 4),
        "gini": round(2 * auc - 1, 4),
        "ks": round(ks_statistic(y_true, pd_hat), 4),
        "brier": round(float(brier_score_loss(y_true, pd_hat)), 5),
        "default_rate": round(float(y_true.mean()), 4),
        "mean_predicted_pd": round(float(pd_hat.mean()), 4),
    }


def train_model(
    output_dir: Path,
    *,
    df: pd.DataFrame | None = None,
    n_samples: int = 20000,
    seed: int = 42,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    from sklearn.model_selection import train_test_split
    from xgboost import XGBClassifier

    dataset_name = "custom" if df is not None else "synthetic-indian-midcorp-v1"
    df = df if df is not None else generate_dataset(n_samples, seed)
    X, y = df[FEATURE_NAMES], df["default"].to_numpy()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=seed, stratify=y)

    model = XGBClassifier(**{**DEFAULT_PARAMS, **(params or {})}, monotone_constraints=monotone_constraints(),
                          random_state=seed, n_jobs=2)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    pd_test = model.predict_proba(X_test)[:, 1]
    metrics = evaluate(y_test, pd_test)

    importance = model.get_booster().get_score(importance_type="gain")
    total = sum(importance.values()) or 1.0
    version = "xgb-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    metadata = {
        "version": version,
        "model_type": "xgboost",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "features": FEATURE_NAMES,
        "monotone_constraints": monotone_constraints(),
        "params": {**DEFAULT_PARAMS, **(params or {})},
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "metrics": metrics,
        "feature_importance": {k: round(v / total, 4) for k, v in sorted(importance.items(), key=lambda kv: -kv[1])},
        "dataset": dataset_name,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    model.get_booster().save_model(str(output_dir / "credit_xgb.json"))
    (output_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata
