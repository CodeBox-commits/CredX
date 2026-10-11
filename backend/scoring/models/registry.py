"""Model registry: loads the PD model artifact from MODEL_DIR (training the bootstrap model if absent)."""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from typing import Any

from config import get_settings
from core.logging import get_logger
from scoring.feature_engineering.features import FEATURE_NAMES
from scoring.models.trainer import META_FILE, MODEL_FILE, train

log = get_logger("credx.model")


@dataclass
class PdModel:
    booster: Any  # xgboost.Booster
    version: str
    meta: dict[str, Any]


_model: PdModel | None = None
_lock = threading.Lock()


def get_model() -> PdModel:
    global _model
    if _model is not None:
        return _model
    with _lock:
        if _model is None:
            import xgboost as xgb

            model_dir = get_settings().model_dir
            path, meta_path = model_dir / MODEL_FILE, model_dir / META_FILE
            meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
            if not path.exists() or [f.get("name") for f in meta.get("features", [])] != FEATURE_NAMES:
                log.info("training bootstrap PD model", extra={"dir": str(model_dir)})
                meta = train(model_dir)
            booster = xgb.Booster()
            booster.load_model(str(path))
            _model = PdModel(booster, meta.get("version", "xgb"), meta)
    return _model
