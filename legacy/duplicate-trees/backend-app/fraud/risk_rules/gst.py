from __future__ import annotations


def evaluate_gst_rules(
    *,
    gstr_2a_amount: float | None,
    gstr_3b_amount: float | None,
    declared_turnover: float | None,
    bank_credits: float | None,
    supplier_gstins: list[str],
    customer_gstins: list[str],
) -> list[tuple[str, str, float]]:
    alerts: list[tuple[str, str, float]] = []

    if gstr_2a_amount and gstr_3b_amount:
        gap_percent = abs(gstr_2a_amount - gstr_3b_amount) / max(gstr_2a_amount, gstr_3b_amount, 1.0) * 100
        if gap_percent > 20:
            alerts.append(
                (
                    "GSTR-2A vs GSTR-3B mismatch",
                    f"Mismatch estimated at {gap_percent:.1f}% across GST declarations.",
                    24.0,
                )
            )

    if declared_turnover and bank_credits and bank_credits > declared_turnover * 1.3:
        excess = (bank_credits / declared_turnover - 1) * 100
        alerts.append(
            (
                "Revenue inflation watch",
                f"Bank credits exceed declared turnover by {excess:.1f}%.",
                20.0,
            )
        )

    if supplier_gstins and customer_gstins:
        overlap = len(set(supplier_gstins).intersection(customer_gstins))
        overlap_ratio = overlap / max(len(set(supplier_gstins)), 1)
        if overlap_ratio > 0.4:
            alerts.append(
                (
                    "Circular trading suspicion",
                    f"{overlap} overlapping GST counterparties detected in buy/sell loops.",
                    28.0,
                )
            )

    return alerts
