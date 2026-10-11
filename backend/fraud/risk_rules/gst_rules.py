"""GST forensic checks (India-specific): GSTR-2A/2B vs 3B, GSTR-1 vs 3B, GST vs bank credits,
GST vs book revenue, filing delays and GSTIN validity."""

from __future__ import annotations

from typing import Any

from utils.india import format_inr_short, is_valid_gstin


def _check(check: str, status: str, detail: str, value: float | None = None, impact: int = 0) -> dict[str, Any]:
    return {"check": check, "status": status, "detail": detail, "value": value, "score_impact": impact}


def _returns(gst_docs: list[dict[str, Any]]) -> dict[str, float]:
    out: dict[str, float] = {}
    for doc in gst_docs:
        for r in doc.get("returns", []):
            if r.get("turnover"):
                out[r["return_type"]] = out.get(r["return_type"], 0.0) + r["turnover"]
    return out


def run_gst_checks(facts: dict[str, Any], revenue: float | None) -> tuple[list[dict[str, Any]], float | None]:
    """-> (checks, max_mismatch_pct used as the model feature)."""
    gst_docs = facts.get("gst") or []
    checks: list[dict[str, Any]] = []
    if not gst_docs:
        return [_check("GST returns available", "na", "No GST returns uploaded — reconciliation not possible.")], None
    turnover = _returns(gst_docs)
    t3b = turnover.get("GSTR-3B")
    t2 = turnover.get("GSTR-2A") or turnover.get("GSTR-2B")
    t1 = turnover.get("GSTR-1")
    mismatches: list[float] = []

    if t3b and t2:
        pct = abs(t3b - t2) / t3b * 100
        mismatches.append(pct)
        status = "fail" if pct > 10 else "warn" if pct > 5 else "pass"
        checks.append(_check("GSTR-2A/2B vs GSTR-3B", status,
                             f"3B {format_inr_short(t3b)} vs 2A/2B {format_inr_short(t2)} — variance {pct:.1f}% (tolerance 5%).",
                             round(pct, 2), {"fail": 15, "warn": 6, "pass": 0}[status]))
    if t3b and t1:
        pct = abs(t1 - t3b) / t3b * 100
        mismatches.append(pct)
        status = "fail" if pct > 10 else "warn" if pct > 3 else "pass"
        checks.append(_check("GSTR-1 vs GSTR-3B", status,
                             f"Outward supplies declared {format_inr_short(t1)} vs tax paid on {format_inr_short(t3b)} ({pct:.1f}%).",
                             round(pct, 2), {"fail": 12, "warn": 4, "pass": 0}[status]))
    gst_turnover = t3b or t1
    bank_credits = sum(b.get("total_credits") or 0 for b in facts.get("bank") or [])
    bank_months = sum(max(1, len(b.get("monthly") or [])) if b.get("monthly") else 0 for b in facts.get("bank") or [])
    if gst_turnover and bank_credits and bank_months:
        annualised = bank_credits / bank_months * 12
        ratio = annualised / (gst_turnover * 1.18)  # bank credits include GST
        status = "fail" if ratio < 0.6 or ratio > 1.6 else "warn" if ratio < 0.8 or ratio > 1.3 else "pass"
        checks.append(_check("Bank credits vs GST turnover", status,
                             f"Annualised bank credits {format_inr_short(annualised)} are {ratio * 100:.0f}% of GST turnover incl. tax"
                             + (" — sales may be inflated or routed through other accounts." if ratio < 0.8 else
                                " — unexplained credits beyond declared sales." if ratio > 1.3 else "."),
                             round(ratio, 3), {"fail": 12, "warn": 5, "pass": 0}[status]))
    if gst_turnover and revenue:
        pct = abs(revenue - gst_turnover) / revenue * 100
        status = "fail" if pct > 15 else "warn" if pct > 7 else "pass"
        checks.append(_check("Book revenue vs GST turnover", status,
                             f"Financial-statement revenue {format_inr_short(revenue)} vs GST turnover {format_inr_short(gst_turnover)} ({pct:.1f}%).",
                             round(pct, 2), {"fail": 10, "warn": 4, "pass": 0}[status]))
    late = [d.get("days_late") for d in gst_docs if d.get("days_late")]
    if late:
        worst = max(late)
        status = "fail" if worst > 60 else "warn"
        checks.append(_check("Return filing timeliness", status, f"Returns filed up to {worst} days late.", worst, 5 if status == "fail" else 2))
    for gstin in facts.get("gstins") or []:
        if not is_valid_gstin(gstin):
            checks.append(_check("GSTIN validity", "fail", f"GSTIN {gstin} fails checksum validation.", None, 8))
    if facts.get("gstins") and all(is_valid_gstin(g) for g in facts["gstins"]):
        checks.append(_check("GSTIN validity", "pass", f"{len(facts['gstins'])} GSTIN(s) pass checksum and state-code validation."))
    return checks, (round(max(mismatches), 2) if mismatches else None)
