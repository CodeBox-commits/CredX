"""Credit decision engine.

    final score = ML score (XGBoost PD → PDO scale, SHAP-decomposed)
                + bounded qualitative overlays (analyst notes, document red flags)
    decision    = policy knock-outs/deviations × score bands
    amount/rate = multi-method sizing × risk-based pricing

Each step is recorded so the decision is reproducible and never a black box.
"""

from __future__ import annotations

import math
from typing import Any

from pydantic import BaseModel, Field

from config import get_settings
from extraction.normalization.merge import CaseProfile

from .decision_logic.five_cs import score_five_cs
from .decision_logic.policy import evaluate_policy
from .decision_logic.pricing import price_loan
from .decision_logic.qualitative import MAX_TOTAL_OVERLAY
from .decision_logic.sizing import size_loan
from .explainability.explainer import explain, top_drivers
from .feature_engineering.features import ExternalSignals, FraudSignals, build_features, latest_years
from .inference.scale import clamp_score, pd_to_score, score_to_pd
from .models.registry import get_model

DOCUMENT_OVERLAYS: dict[str, tuple[str, float]] = {
    "going_concern": ("Auditor going-concern uncertainty", -20),
    "qualified_opinion": ("Qualified audit opinion", -12),
    "auditor_resignation": ("Auditor resignation", -12),
    "emphasis_of_matter": ("Emphasis of matter in audit report", -5),
    "restructuring": ("Debt restructuring / OTS history", -10),
    "default": ("Delays in debt servicing", -15),
    "limit_overdrawal": ("Overdrawal beyond sanctioned limits", -8),
    "rating_downgrade": ("Rating downgrade / negative outlook", -6),
    "capacity_underutilisation": ("Capacity underutilisation disclosed", -6),
    "positive_order_book": ("Strong order book disclosed", 5),
}
OVERLAY_FLOOR, OVERLAY_CAP = -80.0, 30.0


class AnalystNoteInput(BaseModel):
    id: str
    category: str = "general"
    content: str
    signals: list[dict[str, Any]] = Field(default_factory=list)


class ScoringInputs(BaseModel):
    model_config = {"arbitrary_types_allowed": True}

    company_name: str
    sector: str
    requested_amount: float
    facility_type: str = "Term Loan"
    tenure_months: int = 60
    collateral_value: float | None = None
    profile: CaseProfile
    external: Any  # ExternalSignals
    fraud: Any  # FraudSignals
    notes: list[AnalystNoteInput] = Field(default_factory=list)


class CreditDecision(BaseModel):
    credit_score: int
    ml_score: int
    overlay_points: float
    grade: str
    risk_level: str
    probability_of_default: float
    approval_probability: float
    decision: str
    escalation_required: bool
    recommended_amount: float
    suggested_rate: float
    top_risk_factors: list[str]
    strengths: list[str]
    conditions: list[str]
    features: dict[str, Any]
    explanation: dict[str, Any]
    overlays: list[dict[str, Any]]
    policy_checks: list[dict[str, Any]]
    five_cs: dict[str, Any]
    pricing: dict[str, Any]
    loan_sizing: dict[str, Any]
    model_version: str
    model_type: str
    narrative: str


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def _overlays(inputs: ScoringInputs) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    note_total = 0.0
    for note in inputs.notes:
        for s in note.signals:
            items.append({"source": "analyst_note", "note_id": note.id, "code": s["code"], "label": s["label"],
                          "points": float(s["impact"]), "evidence": s.get("matched")})
            note_total += float(s["impact"])
    # Scale notes proportionally if they exceed the cap so each remains visible.
    if abs(note_total) > MAX_TOTAL_OVERLAY:
        factor = MAX_TOTAL_OVERLAY / abs(note_total)
        for item in items:
            item["points"] = round(item["points"] * factor, 2)
            item["capped"] = True

    doc_items = []
    for r in inputs.profile.risk_indicators:
        if r.code in DOCUMENT_OVERLAYS:
            label, pts = DOCUMENT_OVERLAYS[r.code]
            doc_items.append({"source": "document", "code": r.code, "label": label, "points": pts, "evidence": r.snippet})
    doc_total = sum(i["points"] for i in doc_items)
    if doc_total < -45:
        for item in doc_items:
            item["points"] = round(item["points"] * 45 / -doc_total, 2)
    items.extend(doc_items)
    if inputs.profile.data_completeness < 0.45:
        items.append({"source": "data", "code": "thin_file", "label": "Thin file — limited verified financial data",
                      "points": -15.0, "evidence": f"Data completeness {inputs.profile.data_completeness:.0%}"})
    return items


_CONDITION_TEMPLATES = {
    "dscr_min": "Maintain DSCR ≥ 1.25x (tested annually); create a DSRA equal to one quarter's debt service.",
    "leverage_max": "No additional borrowings without lender consent; Debt/EBITDA to be brought below 4.0x within 18 months.",
    "gearing_max": "Promoters to infuse equity / unsecured loans (subordinated) to bring Debt/Equity below 2.5x.",
    "current_ratio_min": "Monthly stock & book-debt statements; drawing power based on 25% stock / 40% debtor margins.",
    "gst_itc": "CA-certified GSTR-2B vs 3B reconciliation before first disbursement; reverse ineligible ITC.",
    "litigation": "Independent legal opinion on pending matters; escrow/BG for the disputed claim amount.",
    "data_sufficiency": "Obtain 3 years' audited financials, 12 months' GST returns and bank statements before sanction.",
}


def score_case(inputs: ScoringInputs) -> CreditDecision:
    settings = get_settings()
    external: ExternalSignals = inputs.external
    fraud: FraudSignals = inputs.fraud
    profile = inputs.profile

    fv = build_features(profile, external, fraud)
    output = get_model().predict(fv)
    explanation = explain(fv, output)
    ml_raw = pd_to_score(output.probability_of_default)

    overlays = _overlays(inputs)
    overlay_points = round(max(OVERLAY_FLOOR, min(OVERLAY_CAP, sum(o["points"] for o in overlays))), 2)
    score = clamp_score(ml_raw + overlay_points)
    pd_final = score_to_pd(score)
    risk_level = "LOW" if score >= 740 else "MEDIUM" if score >= 650 else "HIGH"

    policy = evaluate_policy(fv, profile, fraud, external.litigation_risk)
    knockouts = [p for p in policy if p["status"] == "KNOCKOUT"]
    deviations = [p for p in policy if p["status"] == "DEVIATION"]

    if knockouts or score < 600:
        decision = "REJECT"
    elif score >= 720 and not deviations:
        decision = "APPROVE"
    elif (score >= 650 and len(deviations) <= 2) or (score >= 620 and len(deviations) <= 1):
        decision = "CONDITIONAL APPROVAL"
    else:
        decision = "REJECT"
    escalation = bool(knockouts) or len(deviations) >= 2 or fraud.risk_level in {"HIGH", "CRITICAL"}

    approval_probability = round(_sigmoid((score - 650) / 60), 3)
    if knockouts:
        approval_probability = min(approval_probability, 0.05)

    latest, _ = latest_years(profile)
    collateral_cover = (inputs.collateral_value / inputs.requested_amount) if inputs.collateral_value and inputs.requested_amount else None
    pricing = price_loan(score=score, base_rate=settings.base_lending_rate, tenure_months=inputs.tenure_months,
                         fraud_level=fraud.risk_level, collateral_cover=collateral_cover, sector_outlook=external.sector_outlook)
    sizing = size_loan(requested=inputs.requested_amount, facility_type=inputs.facility_type,
                       tenure_months=inputs.tenure_months, year=latest, collateral_value=inputs.collateral_value,
                       risk_level=risk_level, score=score, rate_pct=pricing["suggested_rate"])
    recommended = 0.0 if decision == "REJECT" else sizing["recommended_amount"]

    five_cs = score_five_cs(
        fv, external, fraud,
        note_impact=sum(o["points"] for o in overlays if o["source"] == "analyst_note"),
        collateral_cover=collateral_cover,
        profile_risk_codes={r.code for r in profile.risk_indicators} | {o["code"] for o in overlays},
    )

    risk_factors = [k["label"] for k in knockouts]
    risk_factors += top_drivers(explanation, negative=True, limit=4)
    risk_factors += [o["label"] for o in sorted(overlays, key=lambda o: o["points"]) if o["points"] <= -8][:3]
    strengths = top_drivers(explanation, negative=False, limit=4)
    strengths += [o["label"] for o in overlays if o["points"] >= 5][:2]
    conditions = []
    if decision != "REJECT":
        conditions = [_CONDITION_TEMPLATES[d["code"]] for d in deviations if d["code"] in _CONDITION_TEMPLATES]
        if fraud.risk_level in {"MEDIUM", "HIGH"}:
            conditions.append("Forensic review of top-10 counterparties and related-party transactions before disbursement.")
        conditions += [
            "Personal guarantees of promoter directors.",
            "Exclusive charge on primary security; collateral as stipulated with 1.25x minimum cover.",
            "Quarterly stock audit / unaudited financials and annual review.",
        ]

    narrative = (
        f"{inputs.company_name} scores {score} ({pricing['grade']}, {risk_level.lower()} risk; PD {pd_final:.2%}). "
        f"The model score of {clamp_score(ml_raw)} was adjusted by {overlay_points:+.0f} points of qualitative overlays. "
        + (f"Policy knock-out: {knockouts[0]['label']}. " if knockouts else "")
        + (f"{len(deviations)} policy deviation(s) require approval. " if deviations else "")
        + f"Recommendation: {decision.title()}"
        + (f" of ₹{recommended / 1e7:,.2f} Cr at {pricing['suggested_rate']:.2f}% (binding method: {sizing['binding_method']})." if recommended else ".")
    )

    return CreditDecision(
        credit_score=score,
        ml_score=clamp_score(ml_raw),
        overlay_points=overlay_points,
        grade=pricing["grade"],
        risk_level=risk_level,
        probability_of_default=round(pd_final, 5),
        approval_probability=approval_probability,
        decision=decision,
        escalation_required=escalation,
        recommended_amount=recommended,
        suggested_rate=pricing["suggested_rate"],
        top_risk_factors=list(dict.fromkeys(risk_factors))[:6],
        strengths=list(dict.fromkeys(strengths))[:5],
        conditions=conditions,
        features={"values": {k: (None if math.isnan(v) else v) for k, v in fv.values.items()}, "missing": fv.missing, "raw": fv.raw},
        explanation=explanation,
        overlays=overlays,
        policy_checks=policy,
        five_cs=five_cs,
        pricing=pricing,
        loan_sizing=sizing,
        model_version=output.model_version,
        model_type=output.model_type,
        narrative=narrative,
    )
