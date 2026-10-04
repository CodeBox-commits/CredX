"""Model registry: loads the trained PD model (training it on first use if absent).

Falls back to a transparent logistic scorecard when XGBoost is unavailable so
the platform always produces an explainable score.
"""

from __future__ import annotations

import json
import math
import threading
from dataclasses import dataclass
from typing import Any, Protocol

from config import get_settings
from core.logging import get_logger

from ..feature_engineering.features import FEATURE_NAMES, FeatureVector

logger = get_logger("credx.scoring.registry")


@dataclass(slots=True)
class ModelOutput:
    probability_of_default: float
    base_logit: float
    contributions: dict[str, float]  # per-feature log-odds contributions (SHAP values)
    model_version: str
    model_type: str
    explainer: str


class PdModel(Protocol):
    version: str
    metadata: dict[str, Any]

    def predict(self, features: FeatureVector) -> ModelOutput: ...


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


class XGBoostPdModel:
    def __init__(self, booster: Any, metadata: dict[str, Any]) -> None:
        self.booster = booster
        self.metadata = metadata
        self.version = metadata.get("version", "xgb")
        self._shap = None
        try:
            import shap

            self._shap = shap.TreeExplainer(booster, model_output="raw")
        except Exception as exc:  # noqa: BLE001 - shap is optional; pred_contribs is exact TreeSHAP too
            logger.info("shap_unavailable_using_pred_contribs", extra={"error": str(exc)[:120]})

    def predict(self, features: FeatureVector) -> ModelOutput:
        import numpy as np
        import xgboost as xgb

        row = np.array([features.as_row()], dtype=float)
        margin = float(self.booster.predict(xgb.DMatrix(row, feature_names=FEATURE_NAMES), output_margin=True)[0])
        explainer = "xgboost-treeshap"
        contribs: list[float] | None = None
        base = None
        if self._shap is not None:
            try:
                values = self._shap.shap_values(row)
                contribs = [float(v) for v in values[0]]
                expected = self._shap.expected_value
                base = float(expected[0] if hasattr(expected, "__len__") else expected)
                explainer = "shap-treeexplainer"
            except Exception:  # noqa: BLE001
                contribs = None
        if contribs is None:
            raw = self.booster.predict(xgb.DMatrix(row, feature_names=FEATURE_NAMES), pred_contribs=True)[0]
            contribs, base = [float(v) for v in raw[:-1]], float(raw[-1])
        # Guarantee additivity (base + Σ contributions == margin) for the score waterfall.
        drift = margin - (base + sum(contribs))
        base += drift
        return ModelOutput(
            probability_of_default=_sigmoid(margin),
            base_logit=base,
            contributions=dict(zip(FEATURE_NAMES, contribs)),
            model_version=self.version,
            model_type="xgboost",
            explainer=explainer,
        )


class ScorecardPdModel:
    """Linear logistic scorecard with fixed, documented weights (fallback)."""

    WEIGHTS = {
        "dscr": -1.1, "interest_coverage": -0.05, "debt_to_ebitda": 0.2, "debt_to_equity": 0.12,
        "current_ratio": -0.55, "ebitda_margin": -5.5, "pat_margin": -2.0, "revenue_growth": -1.4,
        "receivable_days": 0.006, "log_revenue": -0.3, "gst_bank_variance": 1.5, "itc_excess": 2.2,
        "bounce_rate": 0.35, "litigation_score": 0.45, "adverse_media": 1.3, "sector_risk": 1.6,
        "promoter_pledge": 1.1, "fraud_score": 2.6,
    }
    CENTRES = {
        "dscr": 1.4, "interest_coverage": 2.5, "debt_to_ebitda": 3.0, "debt_to_equity": 1.2, "current_ratio": 1.3,
        "ebitda_margin": 0.11, "pat_margin": 0.045, "revenue_growth": 0.08, "receivable_days": 75, "log_revenue": 8.9,
        "gst_bank_variance": 0.05, "itc_excess": 0.0, "bounce_rate": 0.1, "litigation_score": 0.3,
        "adverse_media": 0.3, "sector_risk": 0.47, "promoter_pledge": 0.05, "fraud_score": 0.1,
    }
    BASE = -2.95

    def __init__(self) -> None:
        self.version = "scorecard-v1"
        self.metadata = {"version": self.version, "model_type": "logistic_scorecard", "features": FEATURE_NAMES}

    def predict(self, features: FeatureVector) -> ModelOutput:
        contribs = {}
        for name in FEATURE_NAMES:
            value = features.values[name]
            contribs[name] = 0.0 if math.isnan(value) else self.WEIGHTS[name] * (value - self.CENTRES[name])
        margin = self.BASE + sum(contribs.values())
        return ModelOutput(_sigmoid(margin), self.BASE, contribs, self.version, "logistic_scorecard", "linear")


_model: PdModel | None = None
_lock = threading.Lock()


def get_model() -> PdModel:
    global _model
    if _model is not None:
        return _model
    with _lock:
        if _model is not None:
            return _model
        model_dir = get_settings().model_dir
        try:
            import xgboost as xgb

            path, meta_path = model_dir / "credit_xgb.json", model_dir / "metadata.json"
            if not path.exists():
                from .trainer import train_model

                logger.info("training_bundled_model", extra={"dir": str(model_dir)})
                train_model(model_dir)
            booster = xgb.Booster()
            booster.load_model(str(path))
            metadata = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
            _model = XGBoostPdModel(booster, metadata)
        except Exception as exc:  # noqa: BLE001
            logger.warning("xgboost_unavailable_using_scorecard", extra={"error": str(exc)})
            _model = ScorecardPdModel()
    return _model


def reset_model() -> None:
    global _model
    _model = None
