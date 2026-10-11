# Notebooks

Exploration only — nothing here is imported by the backend. Suggested starting points:

* `pd_model_shap.ipynb` — load `backend/scoring/models/artifacts/pd_model.json`, compute `shap.TreeExplainer`
  summary/dependence plots on `ml/datasets/synthetic_portfolio.csv`.
* `score_band_calibration.ipynb` — plot `ml/evaluation/evaluate.py --json` output.

Install extras with `pip install -r ../requirements.txt`.
