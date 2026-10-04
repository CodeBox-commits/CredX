"""GST consistency checks used by Indian lenders.

* GSTR-2A/2B vs GSTR-3B ITC   – ITC claimed beyond what suppliers reported
* GSTR-1 vs GSTR-3B turnover  – outward supplies reported differently in two returns
* GST turnover vs bank credits – revenue inflation / unbanked sales
* GST turnover vs financials   – books vs returns
* Effective tax rate           – unusually low cash tax relative to turnover
* Filing discipline            – late returns
"""

from __future__ import annotations

from extraction.normalization.schema import BankSummary, GstPeriodData

from ..types import FraudAlertData, GstCheck


def _sum(periods: list[GstPeriodData], field: str) -> float:
    return float(sum(getattr(p, field) or 0 for p in periods))


def run_gst_checks(
    gst: list[GstPeriodData], bank: BankSummary | None, revenue: float | None
) -> tuple[list[GstCheck], list[FraudAlertData]]:
    checks: list[GstCheck] = []
    alerts: list[FraudAlertData] = []
    if not gst:
        checks.append(GstCheck(code="gst_data", label="GST returns available", status="NA", threshold="—",
                               detail="No GST returns ingested — upload GSTR-1/3B/2A to enable GST checks."))
        return checks, alerts

    # 1. ITC claimed (3B) vs ITC available (2A/2B)
    claimed, available = _sum(gst, "itc_claimed"), _sum(gst, "itc_available")
    if claimed and available:
        ratio = claimed / available
        status = "FAIL" if ratio > 1.2 else "WARN" if ratio > 1.05 else "PASS"
        checks.append(GstCheck(code="itc_2a_3b", label="ITC claimed (3B) vs available (2A/2B)", status=status,
                               value=round(ratio, 3), threshold="≤ 1.05x",
                               detail=f"ITC claimed is {ratio:.2f}x the ITC reflected in supplier filings."))
        if status != "PASS":
            excess = claimed - available
            alerts.append(FraudAlertData(
                alert_type="itc_mismatch", severity="HIGH" if status == "FAIL" else "MEDIUM",
                title=f"Excess ITC claimed: {(ratio - 1):.0%} above GSTR-2A/2B",
                description=f"₹{excess:,.0f} of input tax credit claimed in GSTR-3B is not supported by supplier GSTR-1 filings. "
                            "Possible fake purchase invoices or ineligible credit.",
                evidence={"itc_claimed": claimed, "itc_available": available, "ratio": round(ratio, 3)},
                score_impact=18 if status == "FAIL" else 8,
            ))

    # 2. GSTR-1 vs GSTR-3B outward supplies (or 2A-reported vs 3B turnover for summaries)
    g1, g3 = _sum(gst, "gstr1_turnover"), _sum(gst, "gstr3b_turnover")
    g2a = _sum(gst, "gstr2a_turnover")
    if g1 and g3:
        gap = abs(g1 - g3) / max(g1, g3)
        status = "FAIL" if gap > 0.10 else "WARN" if gap > 0.03 else "PASS"
        checks.append(GstCheck(code="gstr1_3b", label="GSTR-1 vs GSTR-3B outward supplies", status=status,
                               value=round(gap, 4), threshold="≤ 3% variance",
                               detail=f"Outward supplies differ by {gap:.1%} between GSTR-1 and GSTR-3B."))
        if status != "PASS":
            alerts.append(FraudAlertData(
                alert_type="gstr1_3b_gap", severity="MEDIUM" if status == "WARN" else "HIGH",
                title=f"GSTR-1 vs GSTR-3B variance of {gap:.1%}",
                description="Invoices reported to buyers (GSTR-1) do not reconcile with tax paid (GSTR-3B).",
                evidence={"gstr1": g1, "gstr3b": g3}, score_impact=10 if status == "FAIL" else 5,
            ))
    elif g2a and g3:
        gap = (g3 - g2a) / g3
        status = "FAIL" if gap > 0.10 else "WARN" if gap > 0.04 else "PASS"
        checks.append(GstCheck(code="gstr2a_3b", label="GSTR-2A vs GSTR-3B turnover", status=status,
                               value=round(gap, 4), threshold="≤ 4% variance",
                               detail=f"GSTR-3B turnover exceeds counterparty-reported (2A) values by {gap:.1%}."))
        if status != "PASS":
            alerts.append(FraudAlertData(
                alert_type="gstr2a_3b_gap", severity="HIGH" if status == "FAIL" else "MEDIUM",
                title=f"GSTR-2A vs 3B mismatch of {gap:.1%}",
                description="Turnover self-declared in GSTR-3B is not corroborated by counterparty filings — a classic revenue-inflation indicator.",
                evidence={"gstr2a": g2a, "gstr3b": g3}, score_impact=14 if status == "FAIL" else 6,
            ))

    # 3. GST turnover vs bank credits (CogniCam-style revenue inflation check)
    gst_turnover = g3 or g1
    monthly = [p for p in gst if len(p.period) == 7]
    if bank and bank.total_credits and gst_turnover:
        months_covered = len(bank.months) or 12
        gst_months = len(monthly) or 12
        bank_annualised = bank.total_credits / months_covered * 12
        gst_annualised = gst_turnover / gst_months * 12
        ratio = bank_annualised / gst_annualised if gst_annualised else 0
        status = "FAIL" if ratio < 0.7 or ratio > 1.5 else "WARN" if ratio < 0.85 or ratio > 1.3 else "PASS"
        checks.append(GstCheck(code="bank_vs_gst", label="Bank credits vs GST turnover", status=status,
                               value=round(ratio, 3), threshold="0.85x – 1.30x",
                               detail=f"Annualised bank credits are {ratio:.2f}x GST-declared turnover."))
        if status != "PASS":
            alerts.append(FraudAlertData(
                alert_type="revenue_inflation" if ratio < 1 else "unexplained_credits",
                severity="HIGH" if status == "FAIL" else "MEDIUM",
                title="GST turnover not supported by banking" if ratio < 1 else "Bank credits exceed GST turnover",
                description=(
                    "Declared sales are materially higher than money received in the bank — possible accommodation billing."
                    if ratio < 1 else "Credits materially exceed GST sales — check for unbanked loans, round-tripping or undeclared sales."
                ),
                evidence={"bank_annualised": bank_annualised, "gst_annualised": gst_annualised, "ratio": round(ratio, 3)},
                score_impact=14 if status == "FAIL" else 6,
            ))

    # 4. Books vs returns
    if revenue and gst_turnover:
        annualised = gst_turnover / (len(monthly) or 12) * 12 if monthly else gst_turnover
        gap = (revenue - annualised) / revenue
        status = "FAIL" if abs(gap) > 0.15 else "WARN" if abs(gap) > 0.07 else "PASS"
        checks.append(GstCheck(code="books_vs_gst", label="Audited revenue vs GST turnover", status=status,
                               value=round(gap, 4), threshold="± 7%",
                               detail=f"Reported revenue differs from GST turnover by {gap:+.1%}."))
        if status == "FAIL":
            alerts.append(FraudAlertData(
                alert_type="books_gst_gap", severity="MEDIUM",
                title=f"Books vs GST turnover gap of {gap:+.1%}",
                description="Financial statements and GST returns tell different revenue stories; obtain a reconciliation from the auditor.",
                evidence={"revenue": revenue, "gst_turnover": annualised}, score_impact=7,
            ))

    # 5. Effective cash tax rate
    tax_paid = _sum(gst, "tax_paid")
    if tax_paid and gst_turnover:
        rate = tax_paid / gst_turnover
        status = "WARN" if rate < 0.01 else "PASS"
        checks.append(GstCheck(code="effective_tax", label="Effective GST cash outflow", status=status,
                               value=round(rate, 4), threshold="≥ 1% of turnover",
                               detail=f"GST paid in cash is {rate:.2%} of turnover."))
        if status == "WARN":
            alerts.append(FraudAlertData(
                alert_type="low_tax_rate", severity="MEDIUM", title=f"Unusually low GST cash outflow ({rate:.2%})",
                description="Very low cash tax with high ITC utilisation is consistent with credit-only (fake ITC) business models.",
                evidence={"tax_paid": tax_paid, "turnover": gst_turnover}, score_impact=6,
            ))

    # 6. Filing discipline
    late = [p for p in gst if p.filing_delay_days > 0]
    if monthly:
        share = len(late) / len(monthly)
        status = "FAIL" if share > 0.4 else "WARN" if share > 0.15 else "PASS"
        avg_delay = sum(p.filing_delay_days for p in late) / len(late) if late else 0
        checks.append(GstCheck(code="filing_delays", label="GST filing discipline", status=status,
                               value=round(share, 3), threshold="≤ 15% late returns",
                               detail=f"{len(late)} of {len(monthly)} returns filed late (avg {avg_delay:.0f} days)."))
        if status == "FAIL":
            alerts.append(FraudAlertData(
                alert_type="filing_delays", severity="LOW", title="Frequent late GST filings",
                description="Persistent filing delays often precede cash-flow stress.",
                evidence={"late": len(late), "total": len(monthly)}, score_impact=4,
            ))
    return checks, alerts
