"""Export the synthetic training portfolio to CSV (for notebooks, experiments or a different learner).

    cd backend && python ../ml/datasets/export_synthetic.py --rows 30000 --out ../ml/datasets/synthetic_portfolio.csv
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))

import numpy as np  # noqa: E402

from scoring.feature_engineering.features import FEATURE_NAMES  # noqa: E402
from scoring.models import synthetic  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=30000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=Path, default=Path(__file__).with_name("synthetic_portfolio.csv"))
    args = parser.parse_args()
    X, y = synthetic.generate(args.rows, seed=args.seed)
    with args.out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow([*FEATURE_NAMES, "defaulted"])
        for row, label in zip(X, y, strict=True):
            w.writerow([("" if np.isnan(v) else round(float(v), 5)) for v in row] + [int(label)])
    print(f"wrote {args.rows} rows to {args.out} (default rate {y.mean():.2%})")


if __name__ == "__main__":
    main()
