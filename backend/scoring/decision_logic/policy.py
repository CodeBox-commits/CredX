"""Credit policy rules: knock-outs and deviations that sit on top of the model score."""

from __future__ import annotations

import math
from typing import Any

from extraction.normalization.merge import CaseProfile

from ..feature_engineering.features import FeatureVector, FraudSignals


def _check(code: str, label: str, status: str, value: Any, threshold: str, detail: str) -> dict[str, Any]:
    return {"code": code, "label": label, "status": status, "value": value, "threshold": threshold, "detail": detail}


def evaluate_policy(
    features: FeatureVector, profile: CaseProfile, fraud: FraudSignals, litigation_risk: str
) -> list[dict[str, Any]]:
    v = features.values
    checks: list[dict[str, Any]] = []
    codes = {r.code for r in profile.risk_indicators}

    def ratio(name: str) -> float | None:
        x = v.get(name)
        return None if x is None or math.isnan(x) else x

    # --- Knock-outs (automatic decline / referral) ---
    if "wilful_defaulter" in codes:
        checks.append(_check("ko_wilful", "Wilful defaulter", "KNOCKOUT", True, "Must be absent",
                             "RBI master direction prohibits fresh facilities to wilful defaulters."))
    if any(m.forum == "NCLT" and m.status == "ADMITTED" for m in profile.legal):
        checks.append(_check("ko_cirp", "Admitted insolvency (CIRP)", "KNOCKOUT", True, "Must be absent",
                             "Company is under a corporate insolvency resolution process."))
    if "npa_sma" in codes:
        checks.append(_check("ko_npa", "SMA / NPA classification", "KNOCKOUT", True, "Standard account",
                             "Existing exposure is classified SMA/NPA in source documents."))
    if fraud.risk_level == "CRITICAL":
        checks.append(_check("ko_fraud", "Critical fraud indicators", "KNOCKOUT", round(fraud.fraud_risk_score), "< 75",
                             "Refer to fraud risk management before any credit decision."))

    # --- Financial covenants (deviations) ---
    dscr = ratio("dscr")
    if dscr is not None:
        checks.append(_check("dscr_min", "Minimum DSCR", "PASS" if dscr >= 1.25 else "DEVIATION", round(dscr, 2), "≥ 1.25x",
                             "Cash accruals must cover scheduled debt service with a 25% cushion."))
    lev = ratio("debt_to_ebitda")
    if lev is not None:
        checks.append(_check("leverage_max", "Max Debt / EBITDA", "PASS" if lev <= 4.0 else "DEVIATION", round(lev, 2), "≤ 4.0x",
                             "Total debt should be repayable from ~4 years of EBITDA."))
    gearing = ratio("debt_to_equity")
    if gearing is not None:
        checks.append(_check("gearing_max", "Max TOL/TNW proxy (Debt/Equity)", "PASS" if gearing <= 2.5 else "DEVIATION",
                             round(gearing, 2), "≤ 2.5x", "Promoter equity cushion requirement."))
    cr = ratio("current_ratio")
    if cr is not None:
        checks.append(_check("current_ratio_min", "Minimum current ratio", "PASS" if cr >= 1.2 else "DEVIATION", round(cr, 2),
                             "≥ 1.20x", "Working-capital lenders typically require a current ratio of 1.2x–1.33x."))
    itc = ratio("itc_excess")
    if itc is not None:
        checks.append(_check("gst_itc", "GST ITC integrity", "PASS" if itc <= 0.1 else "DEVIATION", round(itc, 3), "≤ 10% excess",
                             "ITC claimed in GSTR-3B should be supported by GSTR-2A/2B."))
    if litigation_risk in {"HIGH", "CRITICAL"}:
        checks.append(_check("litigation", "Material litigation", "DEVIATION", litigation_risk, "≤ MEDIUM",
                             "High-severity litigation requires credit committee approval."))
    if profile.data_completeness < 0.45:
        checks.append(_check("data_sufficiency", "Data sufficiency", "DEVIATION", profile.data_completeness, "≥ 0.45",
                             "Insufficient audited financials / GST / banking data to underwrite without additional documents."))
    return checks
