"""Five Cs of Credit scored 0–100 with drivers (character, capacity, capital, collateral, conditions)."""

from __future__ import annotations

import math
from typing import Any

from ..feature_engineering.features import ExternalSignals, FeatureVector, FraudSignals

# Sector modifiers per C (CogniCam idea, re-weighted for Indian mid-corporate lending).
_SECTOR_MODS = {
    "WEAK": {"conditions": -12, "capacity": -3},
    "STABLE": {},
    "FAVORABLE": {"conditions": 8, "capacity": 2},
}


def _bound(x: float) -> float:
    return round(max(5.0, min(98.0, x)), 1)


def _val(fv: FeatureVector, name: str) -> float | None:
    x = fv.values.get(name)
    return None if x is None or math.isnan(x) else x


def score_five_cs(
    fv: FeatureVector,
    external: ExternalSignals,
    fraud: FraudSignals,
    *,
    note_impact: float,
    collateral_cover: float | None,
    profile_risk_codes: set[str],
) -> dict[str, Any]:
    mods = _SECTOR_MODS.get(external.sector_outlook, {})

    # Character — integrity, track record, conduct
    character, c_drivers = 78.0, []
    if external.litigation_risk in {"HIGH", "CRITICAL"}:
        character -= 22
        c_drivers.append(f"{external.litigation_risk.title()} litigation exposure")
    elif external.litigation_risk == "MEDIUM":
        character -= 9
        c_drivers.append("Pending litigation")
    if external.promoter_sentiment == "NEGATIVE":
        character -= 15
        c_drivers.append("Adverse promoter/company media")
    elif external.promoter_sentiment == "POSITIVE":
        character += 6
        c_drivers.append("Positive media coverage")
    if fraud.fraud_risk_score >= 50:
        character -= 25
        c_drivers.append(f"Fraud risk {fraud.fraud_risk_score:.0f}/100")
    elif fraud.fraud_risk_score >= 25:
        character -= 10
        c_drivers.append("Moderate fraud indicators")
    if (b := _val(fv, "bounce_rate")) and b > 0.5:
        character -= 8
        c_drivers.append("Repeated cheque/ECS returns")
    if {"going_concern", "qualified_opinion", "auditor_resignation"} & profile_risk_codes:
        character -= 10
        c_drivers.append("Adverse audit remarks")
    character += max(-10, min(6, note_impact * 0.3))

    # Capacity — ability to repay from cash flows
    capacity, cap_drivers = 60.0, []
    if (d := _val(fv, "dscr")) is not None:
        capacity += max(-30, min(25, (d - 1.25) * 30))
        cap_drivers.append(f"DSCR {d:.2f}x")
    if (m := _val(fv, "ebitda_margin")) is not None:
        capacity += max(-15, min(12, (m - 0.10) * 150))
        cap_drivers.append(f"EBITDA margin {m:.1%}")
    if (g := _val(fv, "revenue_growth")) is not None:
        capacity += max(-10, min(8, g * 40))
        cap_drivers.append(f"Growth {g:+.1%}")
    capacity += mods.get("capacity", 0) + max(-12, min(6, note_impact * 0.4))

    # Capital — skin in the game, leverage
    capital, capi_drivers = 62.0, []
    if (de := _val(fv, "debt_to_equity")) is not None:
        capital += max(-30, min(22, (1.5 - de) * 15))
        capi_drivers.append(f"Debt/Equity {de:.2f}x")
    if (le := _val(fv, "debt_to_ebitda")) is not None:
        capital += max(-20, min(12, (3.5 - le) * 6))
        capi_drivers.append(f"Debt/EBITDA {le:.2f}x")
    if (p := _val(fv, "promoter_pledge")) and p > 0.2:
        capital -= 10
        capi_drivers.append(f"Promoter pledge {p:.0%}")

    # Collateral — security cover
    if collateral_cover:
        collateral = 45 + min(45, collateral_cover * 22)
        col_drivers = [f"Security cover {collateral_cover:.2f}x"]
    else:
        collateral, col_drivers = 40.0, ["No collateral details provided"]
    if "title_issue" in profile_risk_codes:
        collateral -= 15

    # Conditions — sector, macro, regulatory
    conditions = 70.0 - (external.sector_risk_score - 47) * 0.6 + mods.get("conditions", 0)
    cond_drivers = [f"Sector outlook {external.sector_outlook.title()}", f"External risk {external.external_risk_score:.0f}/100"]
    conditions -= external.external_risk_score * 0.15

    def pack(score: float, drivers: list[str], weight: float) -> dict[str, Any]:
        s = _bound(score)
        return {"score": s, "weight": weight, "rating": "Strong" if s >= 72 else "Adequate" if s >= 55 else "Weak", "drivers": drivers}

    result = {
        "character": pack(character, c_drivers or ["No adverse conduct observed"], 0.25),
        "capacity": pack(capacity, cap_drivers or ["Limited financial data"], 0.30),
        "capital": pack(capital, capi_drivers or ["Limited balance-sheet data"], 0.20),
        "collateral": pack(collateral, col_drivers, 0.10),
        "conditions": pack(conditions, cond_drivers, 0.15),
    }
    result["composite"] = round(sum(v["score"] * v["weight"] for k, v in result.items() if isinstance(v, dict)), 1)
    return result
