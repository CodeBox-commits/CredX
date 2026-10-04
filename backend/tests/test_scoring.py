import pytest

from scoring.decision_logic.overlays import infer_note_impact, red_flag_overlays
from scoring.decision_logic.sizing_pricing import price_loan, size_loan
from scoring.explainability.explainer import pd_to_score, score_to_pd
from scoring.inference.engine import score_case

CR = 1e7


def ctx(dscr_ebitda=38.0, notes=None, flags=None, fraud=8, facility="Term Loan", collateral=70):
    return {
        "financials": {
            "FY25": {"revenue": 242 * CR, "ebitda": dscr_ebitda * CR, "pat": 17 * CR, "interest_expense": 6 * CR, "total_debt": 95 * CR,
                     "long_term_debt": 60 * CR, "current_portion_ltd": 9 * CR, "short_term_debt": 26 * CR, "net_worth": 120 * CR,
                     "current_assets": 110 * CR, "current_liabilities": 72 * CR, "receivables": 40 * CR},
            "FY24": {"revenue": 215 * CR, "ebitda": 33 * CR},
        },
        "gst": {"max_mismatch_pct": 1.2}, "bank": {"bounce_count": 0, "credit_volatility": 0.12},
        "research": {"litigation_score": 5, "sentiment_score": 0.35, "sector_risk": 2}, "fraud": {"fraud_score": fraud},
        "company": {"incorporation_year": 2004},
        "application": {"requested_amount": 40 * CR, "tenure_months": 60, "collateral_value": collateral * CR, "facility_type": facility},
        "notes": notes or [], "red_flags": flags or [],
    }


def test_shap_points_sum_exactly_to_model_score():
    r = score_case(ctx())
    assert r["base_points"] + sum(c["points"] for c in r["contributions"]) == r["model_score"]
    assert r["credit_score"] == r["model_score"] + r["overlay_total"]


def test_monotonic_in_cash_flow():
    weak, strong = score_case(ctx(dscr_ebitda=18)), score_case(ctx(dscr_ebitda=45))
    assert strong["model_score"] > weak["model_score"]


def test_fraud_raises_risk_and_knocks_out():
    r = score_case(ctx(fraud=90))
    assert r["decision"] == "DECLINE"
    assert any(k["id"] == "KO-04" for k in r["policy"]["knockouts"])


def test_analyst_note_moves_score():
    base = score_case(ctx())
    noted = score_case(ctx(notes=[{"id": "n1", "kind": "note", "body": "Factory operating at 40% capacity."}]))
    assert noted["credit_score"] < base["credit_score"]
    overlay = noted["overlays"][0]
    assert overlay["source"] == "analyst_note" and overlay["points"] < 0 and "40%" in overlay["rationale"]


def test_explicit_note_impact_wins_and_is_capped():
    r = score_case(ctx(notes=[{"id": "n", "kind": "note", "body": "anything", "impact_points": 99}]))
    assert r["overlays"][0]["points"] == 40


def test_note_inference_lexicon():
    pts, five_c, why = infer_note_impact("Factory operating at 40% capacity; promoter infused fresh equity.")
    assert pts < 0 and "Capacity" in why and "equity" in why.lower()
    assert infer_note_impact("General observation without signal")[0] == 0


def test_red_flags_not_double_counted_when_feature_present():
    flags = [{"label": "Cheque/ECS bounces", "severity": "HIGH", "five_c": "capacity", "evidence": "x"}]
    assert red_flag_overlays(flags, {"bank_bounce_count"}) == []
    assert red_flag_overlays(flags, set())[0].points < 0


def test_pd_score_inverse():
    for pd_ in (0.002, 0.03, 0.2):
        assert score_to_pd(pd_to_score(pd_)) == pytest.approx(pd_, rel=1e-6)


def test_working_capital_uses_turnover_method():
    fin = ctx()["financials"]
    sizing = size_loan(fin, {"requested_amount": 60 * CR, "facility_type": "Cash Credit", "tenure_months": 12}, 760, 10.5, "APPROVE")
    methods = {m["method"] for m in sizing["methods"]}
    assert "Turnover method (Nayak Committee)" in methods and "DSCR capacity" not in methods
    assert sizing["recommended_amount"] <= 0.2 * 242 * CR


def test_decline_recommends_zero():
    sizing = size_loan(ctx()["financials"], {"requested_amount": 10 * CR}, 500, 15, "DECLINE")
    assert sizing["recommended_amount"] == 0


def test_pricing_components_add_up():
    p = price_loan(700, {"collateral_coverage": 0.8, "fraud_score": 50}, {"tenure_months": 90}, deviations=2)
    assert round(sum(c["bps"] for c in p["components"]) / 100, 2) == p["suggested_rate"]
    names = {c["component"] for c in p["components"]}
    assert {"Tenor premium", "Unsecured exposure premium", "Policy deviation premium", "Forensic risk premium"} <= names
