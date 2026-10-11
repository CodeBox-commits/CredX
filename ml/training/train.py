"""Train the CredX probability-of-default model and publish it to the backend's model directory.

    cd backend && python ../ml/training/train.py                      # synthetic bootstrap portfolio
    cd backend && python ../ml/training/train.py --data ../ml/datasets/portfolio.csv --target defaulted

A CSV must contain one column per feature in scoring.feature_engineering.features.FEATURE_NAMES
(blank = missing) plus the binary target. The backend hot-reads the artifact on restart.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))

import numpy as np  # noqa: E402

from config import get_settings  # noqa: E402
from scoring.feature_engineering.features import FEATURE_NAMES  # noqa: E402
from scoring.models.trainer import train  # noqa: E402


def load_csv(path: Path, target: str) -> tuple[np.ndarray, np.ndarray]:
    with path.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    missing = [f for f in [*FEATURE_NAMES, target] if f not in rows[0]]
    if missing:
        raise SystemExit(f"CSV is missing columns: {', '.join(missing)}")
    X = np.array([[float(r[f]) if r[f] not in ("", None) else np.nan for f in FEATURE_NAMES] for r in rows])
    y = np.array([int(float(r[target])) for r in rows])
    return X, y


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, help="labelled CSV (defaults to the synthetic generator)")
    parser.add_argument("--target", default="defaulted")
    parser.add_argument("--rows", type=int, default=30000, help="synthetic rows when --data is omitted")
    parser.add_argument("--out", type=Path, default=None, help="artifact directory (default: settings.model_dir)")
    args = parser.parse_args()
    X = y = None
    if args.data:
        X, y = load_csv(args.data, args.target)
    meta = train(args.out or get_settings().model_dir, X, y, n_rows=args.rows)
    print(json.dumps({"version": meta["version"], **meta["metrics"]}, indent=2))


if __name__ == "__main__":
    main()
