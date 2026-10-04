# CredX ML workspace

Offline model development for the probability-of-default (PD) model served by `backend/scoring`.
The backend never imports from `ml/`; this folder trains, evaluates and publishes artifacts that the
backend loads from `MODEL_DIR` (default `backend/scoring/models/artifacts/`).

| Path | Purpose |
|---|---|
| `datasets/export_synthetic.py` | Export the synthetic bootstrap portfolio to CSV |
| `training/train.py` | Train XGBoost (monotone constraints) on synthetic data or a labelled CSV and publish the artifact |
| `evaluation/evaluate.py` | Validation report: AUC/Gini/KS/Brier, decile calibration, grade-band default rates, PSI, global SHAP |
| `experiments/` | Experiment log template — one markdown file per experiment |
| `notebooks/` | Exploratory notebooks (kept out of the serving path) |

```bash
cd backend
python ../ml/training/train.py                 # bootstrap model (~10 s)
python ../ml/evaluation/evaluate.py --json ../ml/experiments/latest_eval.json
python ../ml/datasets/export_synthetic.py      # CSV for notebooks
pip install -r ../ml/requirements.txt          # adds shap/matplotlib/jupyter for notebook work
```

## Why synthetic data?

There is no public, labelled dataset of Indian mid-corporate defaults with GST, banking, litigation and
fraud-graph features. The bootstrap portfolio (`backend/scoring/models/synthetic.py`) is generated from a
latent "company quality" factor with a default mechanism that encodes credit-policy priors (DSCR,
leverage, GST hygiene, litigation, promoter pledge...). It exists so the full explainable pipeline works
end-to-end; **replace it with your bureau/portfolio history before any production use**:

```bash
python ../ml/training/train.py --data path/to/portfolio.csv --target defaulted
```

## Model design choices

* **XGBoost with monotone constraints** — every feature can only move risk in the economically sensible
  direction (higher DSCR never increases PD). This removes a whole class of "the model is weird" findings
  in model validation.
* **Native TreeSHAP** (`pred_contribs=True`) — exact Shapley values from the booster itself, no `shap`
  dependency at serving time.
* **Points-to-double-odds scaling** (PDO 28, 680 ⇔ 20:1) — SHAP log-odds map linearly to score points, so the
  explanation waterfall sums *exactly* to the score.
* **Missing values are first-class** — 8% of training values are masked so trees learn sensible default
  branches; the UI shows which inputs were missing rather than silently imputing.
