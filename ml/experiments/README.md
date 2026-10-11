# Experiment log

One markdown file per experiment: `YYYY-MM-DD-short-name.md` with

1. **Hypothesis** — what you expect to change and why
2. **Data** — source, rows, date range, default definition (90+ DPD / NPA)
3. **Config** — params diff vs `backend/scoring/models/trainer.py::PARAMS`, feature changes
4. **Results** — `ml/evaluation/evaluate.py` JSON (AUC, KS, Brier, PSI, grade-band default rates)
5. **Decision** — promote / reject, and who signed off (model risk governance)
