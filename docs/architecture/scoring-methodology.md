# Scoring methodology

```
features ──► XGBoost PD model ──► model score (TreeSHAP-attributed)
                                      + analyst-note overlays      (±40 per note, ±80 total)
                                      + unmodelled red-flag overlays (bounded, −90 total)
                                      = final score (300–900) ──► grade CX1…CX8 · risk band
policy rule book (knock-outs, deviations) ─────────────┐
                                                        ▼
                    decision: APPROVE · APPROVE_WITH_CONDITIONS · REFER · DECLINE
                    sizing:   min(DSCR capacity, leverage ceiling, Nayak turnover, security cover, request)
                    pricing:  benchmark + grade spread + tenor + collateral + deviation + forensic premia
                    Five Cs:  SHAP points + overlays grouped by C
```

## 1. Features (`scoring/feature_engineering/features.py`)

Eighteen features, each declared once with its meaning, Five-C bucket, benchmark and **direction**
(enforced as an XGBoost monotone constraint, so e.g. higher DSCR can never increase risk):

DSCR · interest coverage · Debt/EBITDA · Debt/Equity · current ratio · EBITDA margin · revenue growth ·
receivable days · GST mismatch % · cheque/ECS bounces · cash-flow volatility · litigation intensity ·
promoter sentiment · fraud score · promoter pledge % · vintage · collateral coverage · sector risk band.

Missing inputs stay missing — the model learned default branches (8% of training values were masked)
and the UI shows them as "not available" rather than silently imputing.

## 2. Model (`scoring/models`)

* Gradient-boosted trees (`binary:logistic`, depth 3, 500 rounds with early stopping, monotone constraints).
* Bootstrapped on a synthetic Indian mid-corporate portfolio (latent quality factor + policy-informed
  default mechanism, 8% default rate) because no public labelled dataset exists — **replace with your
  portfolio** via `ml/training/train.py --data portfolio.csv`.
* Validation (`ml/evaluation/evaluate.py`): AUC ≈ 0.88, Gini ≈ 0.77, KS ≈ 0.61, PSI ≈ 0.

## 3. From probability to points

```
score = OFFSET + FACTOR × ln(odds_good)          FACTOR = PDO / ln 2,  PDO = 28
anchor: 680 ⇔ 20:1 good:bad (PD ≈ 4.8%)          OFFSET = 680 − FACTOR × ln 20
```

TreeSHAP decomposes the model's log-odds of default into `bias + Σ shapᵢ`, therefore

```
score = (OFFSET − FACTOR × bias) + Σ (−FACTOR × shapᵢ)
        └──── base points ─────┘   └─ feature points ─┘
```

Feature points are rounded with largest-remainder rounding so the integer waterfall sums *exactly*
to the integer score. What-if analysis re-scores with one feature moved to its benchmark.

| Score | PD | Grade | Risk |
|---|---|---|---|
| ≥ 800 | ≤ 0.26% | CX1 | LOW |
| 760–799 | ≤ 0.7% | CX2 | LOW |
| 720–759 | ≤ 1.8% | CX3 | MEDIUM |
| 680–719 | ≤ 4.8% | CX4 | MEDIUM |
| 640–679 | ≤ 12% | CX5 | HIGH |
| 600–639 | ≤ 27% | CX6 | HIGH |
| 550–599 | ≤ 56% | CX7 | CRITICAL |
| < 550 | — | CX8 | CRITICAL |

## 4. Overlays (`scoring/decision_logic/overlays.py`)

* **Analyst notes** — "Factory operating at 40% capacity" → capacity utilisation vs 75% benchmark → −21.
  A transparent lexicon (shutdowns, stock mismatches, evasive management, equity infusion, verified
  collateral, order book…) infers the impact; analysts can pin an explicit value. Each note ±40, all notes ±80.
* **Unmodelled red flags** — e.g. going-concern emphasis (−40), auditor resignation (−25). Flags whose
  signal *is* a model feature (bounces, GST mismatch, NCLT litigation, circular trading) are skipped
  to avoid double counting.

## 5. Policy and decision (`scoring/decision_logic/policy.py`, `scoring/inference/engine.py`)

Knock-outs (wilful defaulter, NPA/SMA-2, admitted IBC, fraud score > 75, DSCR < 0.9) → DECLINE.
Score < 600 → DECLINE; < 660, ≥ 3 deviations or a severe overlay → REFER; deviations or < 700 →
APPROVE_WITH_CONDITIONS (with generated covenants); otherwise APPROVE. Zero debt headroom turns an
approval into a referral.

## 6. Sizing and pricing (`scoring/decision_logic/sizing_pricing.py`)

* Term loans: DSCR capacity (EBITDA/1.35 − existing debt service → annuity), grade leverage ceiling.
* Working capital: Nayak Committee turnover method (20% of turnover), leverage with WC refinanced.
* Security cover: collateral / 1.25. Recommendation = binding (minimum) method, rounded to ₹5 lakh.
* Pricing: EBLR/MCLR anchor + grade spread (50–600 bps) + tenor + collateral discount/premium +
  25 bps per deviation (max 75) + 40 bps forensic premium when fraud score > 40.
