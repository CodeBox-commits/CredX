"""Credit policy: knock-outs (automatic decline) and deviations (need sanctioning-authority approval).

Rules sit on top of the model score; every rule reports its threshold, actual value and status so the
credit committee sees exactly which policy the recommendation relies on.
"""

from __future__ import annotations

from typing import Any

from scoring.feature_engineering.features import format_value


def _rule(rid: str, name: str, kind: str, threshold: str, actual: Any, failed: bool | None, guidance: str) -> dict[str, Any]:
    status = "na" if failed is None else ("fail" if failed else "pass")
    return {"id": rid, "name": name, "kind": kind, "threshold": threshold, "actual": actual, "status": status, "guidance": guidance}


def _cmp(value: float | None, limit: float, lower_is_breach: bool) -> bool | None:
    if value is None:
        return None
    return value < limit if lower_is_breach else value > limit


def evaluate_policy(features: dict[str, float | None], red_flags: list[dict[str, Any]], legal: list[dict[str, Any]]) -> dict[str, Any]:
    labels = {f.get("label") for f in red_flags}
    f = features

    def shown(name: str) -> str | None:
        return None if f.get(name) is None else format_value(name, f[name])

    admitted_ibc = any(any("IBC" in t for t in (m.get("case_types") or [])) and m.get("status") == "adjudicated" for m in legal)
    material_audit = labels & {"Going-concern uncertainty flagged by auditor", "Qualified/adverse audit opinion"}
    rules = [
        _rule("KO-01", "No wilful-defaulter reference", "knockout", "Absent", "Present" if "Wilful defaulter reference" in labels else "Absent",
              "Wilful defaulter reference" in labels, "RBI Master Direction bars fresh facilities to wilful defaulters."),
        _rule("KO-02", "No NPA / SMA classification", "knockout", "Standard account",
              "SMA/NPA mentioned" if "NPA / SMA classification mentioned" in labels else "Standard",
              "NPA / SMA classification mentioned" in labels, "Existing exposure classified SMA/NPA must be regularised first."),
        _rule("KO-03", "No admitted insolvency (CIRP)", "knockout", "No admitted IBC petition", "Admitted" if admitted_ibc else "None admitted",
              admitted_ibc, "A company under CIRP cannot be extended fresh credit outside the resolution process."),
        _rule("KO-04", "Fraud risk below critical", "knockout", "Fraud score < 75", shown("fraud_score"),
              None if f.get("fraud_score") is None else f["fraud_score"] >= 75,
              "Critical fraud indicators require FRMU / forensic review before any sanction."),
        _rule("KO-05", "No investigative-agency action", "knockout", "Absent",
              "Present" if "Investigative agency action" in labels else "Absent", "Investigative agency action" in labels,
              "ED/CBI/SFIO action against the borrower or promoters is a policy knock-out."),
        _rule("DV-01", "Minimum DSCR", "deviation", "≥ 1.25x", shown("dscr"), _cmp(f.get("dscr"), 1.25, True),
              "Cash accruals must cover scheduled debt service with a 25% cushion."),
        _rule("DV-02", "Maximum Debt / EBITDA", "deviation", "≤ 4.0x", shown("debt_to_ebitda"), _cmp(f.get("debt_to_ebitda"), 4.0, False),
              "Total debt should be repayable from about four years of EBITDA."),
        _rule("DV-03", "Maximum Debt / Equity", "deviation", "≤ 2.5x", shown("debt_equity"), _cmp(f.get("debt_equity"), 2.5, False),
              "Promoter equity cushion requirement (TOL/TNW proxy)."),
        _rule("DV-04", "Minimum current ratio", "deviation", "≥ 1.20x", shown("current_ratio"), _cmp(f.get("current_ratio"), 1.2, True),
              "Working-capital lenders expect a current ratio of 1.20x–1.33x."),
        _rule("DV-05", "GST reconciliation (2A/2B vs 3B)", "deviation", "≤ 5%", shown("gst_mismatch_pct"),
              _cmp(f.get("gst_mismatch_pct"), 5.0, False), "Turnover declared in GSTR-3B should be corroborated by counterparty filings."),
        _rule("DV-06", "Promoter pledge", "deviation", "≤ 25%", shown("promoter_pledge_pct"), _cmp(f.get("promoter_pledge_pct"), 25.0, False),
              "High pledge indicates promoter funding stress and control risk."),
        _rule("DV-07", "Minimum security cover", "deviation", "≥ 1.25x", shown("collateral_coverage"),
              _cmp(f.get("collateral_coverage"), 1.25, True), "Collateral should cover the exposure at least 1.25x."),
        _rule("DV-08", "Material litigation", "deviation", "Litigation score ≤ 40", shown("litigation_score"),
              _cmp(f.get("litigation_score"), 40.0, False), "High-severity litigation needs credit-committee review."),
        _rule("DV-09", "Banking conduct", "deviation", "≤ 2 cheque/ECS bounces", shown("bank_bounce_count"),
              _cmp(f.get("bank_bounce_count"), 2.0, False), "Repeated bounces indicate cash-flow stress."),
        _rule("DV-10", "Clean audit opinion", "deviation", "No going-concern / qualified opinion",
              ", ".join(sorted(material_audit)) or "Unmodified", bool(material_audit) if red_flags or legal else None,
              "Adverse auditor remarks need credit-committee review."),
    ]
    knockouts = [r for r in rules if r["kind"] == "knockout" and r["status"] == "fail"]
    deviations = [r for r in rules if r["kind"] == "deviation" and r["status"] == "fail"]
    return {"rules": rules, "knockouts": knockouts, "deviations": deviations,
            "passed": sum(1 for r in rules if r["status"] == "pass"), "not_evaluable": sum(1 for r in rules if r["status"] == "na")}
