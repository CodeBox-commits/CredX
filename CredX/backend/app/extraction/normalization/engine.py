from __future__ import annotations

from .schema import NormalizedFinancials


def normalize_financials(raw: dict[str, object]) -> NormalizedFinancials:
    revenue = raw.get("revenue")
    debt = raw.get("debt")
    liabilities = raw.get("liabilities")
    total_assets = raw.get("total_assets")
    current_assets = raw.get("current_assets")
    current_liabilities = raw.get("current_liabilities")
    ebitda = raw.get("ebitda")
    net_profit = raw.get("net_profit")
    operating_profit = raw.get("operating_profit")

    ratios: dict[str, float] = {}
    if isinstance(current_assets, (int, float)) and isinstance(current_liabilities, (int, float)) and current_liabilities:
        ratios["current_ratio"] = round(current_assets / current_liabilities, 2)
    if isinstance(revenue, (int, float)) and revenue:
        if isinstance(debt, (int, float)) and debt:
            ratios["debt_to_equity"] = round(debt / max(revenue, 1.0), 4)
        if isinstance(ebitda, (int, float)) and ebitda:
            ratios["operating_margin"] = round((ebitda / revenue) * 100, 2)
        if isinstance(net_profit, (int, float)) and net_profit:
            ratios["net_margin"] = round((net_profit / revenue) * 100, 2)
    if isinstance(debt, (int, float)) and isinstance(total_assets, (int, float)) and total_assets:
        ratios["debt_asset_ratio"] = round(debt / total_assets, 4)
    if isinstance(ebitda, (int, float)) and isinstance(interest_expense := raw.get("interest_expense"), (int, float)) and interest_expense:
        ratios["interest_coverage"] = round(ebitda / interest_expense, 2)

    warnings: list[str] = []
    if isinstance(revenue, (int, float)) and revenue > 0 and isinstance(debt, (int, float)) and debt > revenue:
        warnings.append("Debt exceeds revenue; borrower leverage appears elevated.")
    if isinstance(current_assets, (int, float)) and isinstance(current_liabilities, (int, float)) and current_liabilities and current_assets < current_liabilities:
        warnings.append("Current liabilities exceed current assets; liquidity stress is possible.")

    return NormalizedFinancials(
        company_name=raw.get("company_name") if isinstance(raw.get("company_name"), str) else None,
        cin=raw.get("cin") if isinstance(raw.get("cin"), str) else None,
        gst_number=raw.get("gst_number") if isinstance(raw.get("gst_number"), str) else None,
        pan=raw.get("pan") if isinstance(raw.get("pan"), str) else None,
        directors=(raw.get("directors") or []) if isinstance(raw.get("directors"), list) else None,
        auditor=raw.get("auditor") if isinstance(raw.get("auditor"), str) else None,
        revenue=float(revenue) if isinstance(revenue, (int, float)) else None,
        ebitda=float(ebitda) if isinstance(ebitda, (int, float)) else None,
        operating_profit=float(operating_profit) if isinstance(operating_profit, (int, float)) else None,
        net_profit=float(net_profit) if isinstance(net_profit, (int, float)) else None,
        debt=float(debt) if isinstance(debt, (int, float)) else None,
        current_assets=float(current_assets) if isinstance(current_assets, (int, float)) else None,
        current_liabilities=float(current_liabilities) if isinstance(current_liabilities, (int, float)) else None,
        fixed_assets=float(raw.get("fixed_assets")) if isinstance(raw.get("fixed_assets"), (int, float)) else None,
        inventory=float(raw.get("inventory")) if isinstance(raw.get("inventory"), (int, float)) else None,
        cash=float(raw.get("cash")) if isinstance(raw.get("cash"), (int, float)) else None,
        net_worth=float(raw.get("net_worth")) if isinstance(raw.get("net_worth"), (int, float)) else None,
        liabilities=float(liabilities) if isinstance(liabilities, (int, float)) else None,
        total_assets=float(total_assets) if isinstance(total_assets, (int, float)) else None,
        interest_expense=float(raw.get("interest_expense")) if isinstance(raw.get("interest_expense"), (int, float)) else None,
        tax_expense=float(raw.get("tax_expense")) if isinstance(raw.get("tax_expense"), (int, float)) else None,
        loans=float(raw.get("loans")) if isinstance(raw.get("loans"), (int, float)) else None,
        creditors=float(raw.get("creditors")) if isinstance(raw.get("creditors"), (int, float)) else None,
        debtors=float(raw.get("debtors")) if isinstance(raw.get("debtors"), (int, float)) else None,
        financial_year=raw.get("financial_year") if isinstance(raw.get("financial_year"), str) else None,
        risk_indicators=list(raw.get("risk_indicators") or []) if isinstance(raw.get("risk_indicators"), list) else None,
        financial_health=raw.get("financial_health") if isinstance(raw.get("financial_health"), str) else "UNKNOWN",
        confidence_score=float(raw.get("confidence_score")) if isinstance(raw.get("confidence_score"), (int, float)) else 0.0,
        validation_warnings=warnings,
        ratios=ratios,
    )
