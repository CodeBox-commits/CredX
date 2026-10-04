"""Credit decision engine: model -> overlays -> policy -> decision -> sizing -> pricing -> Five Cs.

    model score (XGBoost PD, SHAP-attributed)
      + analyst-note overlays          (bounded, cited)
      + unmodelled red-flag overlays   (bounded, cited, no double counting)
      = final score -> grade/risk band
    policy knock-outs / deviations  -> decision (APPROVE / APPROVE_WITH_CONDITIONS / REFER / DECLINE)
    sizing (min of DSCR, leverage, turnover, security cover) and itemised risk-based pricing
"""

from __future__ import annotations

import math
from typing import Any

from scoring.decision_logic.five_cs import build_five_cs
from scoring.decision_logic.overlays import note_overlays, red_flag_overlays
from scoring.decision_logic.policy import evaluate_policy
from scoring.decision_logic.sizing_pricing import grade_for, price_loan, size_loan
from scoring.explainability.explainer import clamp_score, explain, score_to_pd, what_if
from scoring.feature_engineering.features import build_features, compute_ratios
from scoring.models.registry import get_model

APPROVE_FLOOR = 700
DECLINE_FLOOR = 600
REFER_CEILING = 660


def _decide(score: int, policy: dict[str, Any], overlays: list[dict[str, Any]]) -> tuple[str, list[str]]:
    reasons: list[str] = []
    if policy["knockouts"]:
        reasons += [f"Knock-out {r['id']}: {r['name']} (actual {r['actual']}, required {r['threshold']})" for r in policy["knockouts"]]
        return "DECLINE", reasons
    if score < DECLINE_FLOOR:
        return "DECLINE", [f"Final score {score} below decline floor {DECLINE_FLOOR}"]
    devs = policy["deviations"]
    severe_overlay = any(o["points"] <= -30 for o in overlays)
    if score < REFER_CEILING or len(devs) >= 3 or severe_overlay:
        if score < REFER_CEILING:
            reasons.append(f"Score {score} in referral band ({DECLINE_FLOOR}-{REFER_CEILING - 1})")
        if len(devs) >= 3:
            reasons.append(f"{len(devs)} policy deviations require credit-committee sanction")
        if severe_overlay:
            reasons.append("Severe qualitative concern raised (overlay <= -30 pts)")
        return "REFER", reasons
    if devs or score < APPROVE_FLOOR:
        reasons += [f"Deviation {r['id']}: {r['name']} (actual {r['actual']}, required {r['threshold']})" for r in devs]
        if score < APPROVE_FLOOR:
            reasons.append(f"Score {score} below clean-approval threshold {APPROVE_FLOOR}")
        return "APPROVE_WITH_CONDITIONS", reasons
    return "APPROVE", [f"Score {score} with all evaluable policy rules passed"]


def _approval_probability(score: int, decision: str, deviations: int) -> float:
    """Likelihood the sanctioning committee approves, calibrated on the score bands."""
    p = 1 / (1 + math.exp(-(score - 650) / 22))
    p *= 0.88 ** deviations
    if decision == "DECLINE":
        p = min(p, 0.05)
    elif decision == "REFER":
        p = min(p, 0.55)
    return round(p, 3)


def _conditions(decision: str, policy: dict[str, Any], features: dict[str, float | None]) -> list[str]:
    if decision == "DECLINE":
        return []
    conds = []
    for dev in policy["deviations"]:
        conds.append({
            "DV-01": "Debt-service reserve account (DSRA) of two quarters' instalments",
            "DV-02": "Leverage covenant: Debt/EBITDA to step down below 3.5x by next annual review",
            "DV-03": "Promoter to infuse equity / subordinate unsecured loans to bring D/E within 3.0x",
            "DV-04": "Stock & book-debt statements monthly; drawing power with 25% margin",
            "DV-05": "Chartered-accountant certificate reconciling GSTR-3B with GSTR-2A/2B before disbursement",
            "DV-06": "Negative pledge on promoter shareholding; no further pledge without consent",
            "DV-07": "Additional collateral or personal guarantees of promoters to reach 1.25x cover",
            "DV-08": "Independent legal opinion on pending litigation; escrow for contingent claims",
            "DV-09": "Escrow of receivables through lender's account; NACH mandate for EMIs",
            "DV-10": "Credit committee to review auditor's going-concern note; quarterly financial covenants",
        }.get(dev["id"], dev["guidance"]))
    if decision in ("APPROVE", "APPROVE_WITH_CONDITIONS"):
        conds.append("Standard: CERSAI registration of security, insurance with bank clause, annual review")
    return conds


def score_case(ctx: dict[str, Any]) -> dict[str, Any]:
    model = get_model()
    ratios = compute_ratios(ctx.get("financials") or {})
    ctx = {**ctx, "ratios": ratios}
    features, feature_sources = build_features(ctx)

    expl = explain(model.booster, features)
    model_score = clamp_score(expl["raw_score"])
    present = {k for k, v in features.items() if v is not None}

    overlays = [o.to_dict() for o in note_overlays(ctx.get("notes") or [])]
    overlays += [o.to_dict() for o in red_flag_overlays(ctx.get("red_flags") or [], present)]
    overlay_total = sum(o["points"] for o in overlays)
    final_score = clamp_score(model_score + overlay_total)
    final_pd = score_to_pd(final_score)
    grade, risk_level, _, _ = grade_for(final_score)

    policy = evaluate_policy(features, ctx.get("red_flags") or [], ctx.get("legal") or [])
    decision, reasons = _decide(final_score, policy, overlays)
    pricing = price_loan(final_score, features, ctx.get("application") or {}, len(policy["deviations"]))
    sizing = size_loan(ctx.get("financials") or {}, ctx.get("application") or {}, final_score, pricing["suggested_rate"], decision)
    if decision in ("APPROVE", "APPROVE_WITH_CONDITIONS") and sizing["recommended_amount"] <= 0:
        decision = "REFER"
        reasons.append(f"No debt headroom under {sizing['binding_constraint']}; restructure the ask or add equity")
    five_cs = build_five_cs(expl["contributions"], overlays, ctx)

    risk_drivers = [c for c in expl["contributions"] if c["points"] < 0 and not c["missing"]]
    strengths = [c for c in expl["contributions"] if c["points"] > 0 and not c["missing"]]
    top_risks = [f"{c['label']} {c['display_value']} ({c['points']:+d} pts)" for c in risk_drivers[:5]]
    top_risks += [f"{o['label']} ({o['points']:+d} pts)" for o in sorted(overlays, key=lambda o: o["points"]) if o["points"] < 0][:3]
    top_strengths = [f"{c['label']} {c['display_value']} ({c['points']:+d} pts)" for c in strengths[:5]]

    return {
        "model_version": model.version,
        "model_score": model_score,
        "credit_score": final_score,
        "probability_of_default": round(final_pd, 4),
        "model_probability_of_default": round(expl["probability_of_default"], 4),
        "approval_probability": _approval_probability(final_score, decision, len(policy["deviations"])),
        "risk_level": risk_level,
        "rating": grade,
        "decision": decision,
        "decision_reasons": reasons,
        "conditions": _conditions(decision, policy, features),
        "recommended_amount": sizing["recommended_amount"],
        "suggested_rate": pricing["suggested_rate"],
        "features": {"values": features, "sources": feature_sources},
        "base_points": expl["base_points"],
        "contributions": expl["contributions"],
        "overlays": overlays,
        "overlay_total": overlay_total,
        "what_if": what_if(model.booster, features, expl["contributions"]),
        "policy": policy,
        "five_cs": five_cs,
        "loan_sizing": sizing,
        "pricing": pricing,
        "ratios": ratios,
        "top_risk_factors": top_risks,
        "top_strengths": top_strengths,
        "model_metrics": model.meta.get("metrics", {}),
    }
