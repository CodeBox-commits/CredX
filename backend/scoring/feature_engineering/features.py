"""Financial ratios and the 18 model features (case context -> model-ready vector).

Missing inputs stay ``None`` (NaN for XGBoost, which learned default branches for them) and are
reported as missing in the explanation, so a thin file never silently looks like a strong one.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any


@dataclass(frozen=True)
class FeatureSpec:
    name: str
    label: str
    five_c: str
    direction: int  # +1: higher value -> higher PD (monotone constraint sign)
    fmt: str  # x | pct | pct100 | days | count | score | years | signed
    clip: tuple[float, float]


FEATURES: list[FeatureSpec] = [
    FeatureSpec("dscr", "Debt service coverage", "capacity", -1, "x", (-2, 8)),
    FeatureSpec("interest_coverage", "Interest coverage", "capacity", -1, "x", (-5, 30)),
    FeatureSpec("debt_to_ebitda", "Debt / EBITDA", "capital", 1, "x", (0, 25)),
    FeatureSpec("debt_equity", "Debt / equity", "capital", 1, "x", (0, 15)),
    FeatureSpec("current_ratio", "Current ratio", "capacity", -1, "x", (0, 6)),
    FeatureSpec("ebitda_margin", "EBITDA margin", "capacity", -1, "pct", (-0.5, 0.6)),
    FeatureSpec("revenue_growth", "Revenue growth", "conditions", -1, "signed", (-0.8, 1.5)),
    FeatureSpec("receivable_days", "Receivable days", "capacity", 1, "days", (0, 400)),
    FeatureSpec("gst_mismatch_pct", "GST mismatch (2A vs 3B)", "character", 1, "pct100", (0, 100)),
    FeatureSpec("bank_bounce_count", "Cheque/ECS bounces", "character", 1, "count", (0, 30)),
    FeatureSpec("cashflow_volatility", "Cash-flow volatility", "capacity", 1, "pct", (0, 3)),
    FeatureSpec("litigation_score", "Litigation intensity", "character", 1, "score", (0, 100)),
    FeatureSpec("promoter_sentiment", "Promoter & media sentiment", "character", -1, "sentiment", (-1, 1)),
    FeatureSpec("fraud_score", "Fraud risk score", "character", 1, "score", (0, 100)),
    FeatureSpec("promoter_pledge_pct", "Promoter pledge", "capital", 1, "pct100", (0, 100)),
    FeatureSpec("vintage_years", "Business vintage", "character", -1, "years", (0, 80)),
    FeatureSpec("collateral_coverage", "Collateral coverage", "collateral", -1, "x", (0, 10)),
    FeatureSpec("sector_risk", "Sector risk", "conditions", 1, "score", (0, 100)),
]
FEATURE_NAMES = [f.name for f in FEATURES]
SPEC = {f.name: f for f in FEATURES}

# (description when the feature helps, description when it hurts)
_TEXT = {
    "dscr": ("DSCR of {v} comfortably covers debt service", "DSCR of {v} is thin against debt service"),
    "interest_coverage": ("EBITDA covers interest {v}", "EBITDA covers interest only {v}"),
    "debt_to_ebitda": ("Leverage of {v} Debt/EBITDA is moderate", "Leverage of {v} Debt/EBITDA is elevated"),
    "debt_equity": ("Gearing of {v} leaves a solid equity cushion", "Gearing of {v} leaves a thin equity cushion"),
    "current_ratio": ("Current ratio of {v} gives liquidity headroom", "Current ratio of {v} signals tight liquidity"),
    "ebitda_margin": ("Healthy EBITDA margin of {v}", "Weak EBITDA margin of {v}"),
    "revenue_growth": ("Revenue growth of {v} shows momentum", "Revenue growth of {v} reflects soft demand"),
    "receivable_days": ("Receivable cycle of {v} is efficient", "Receivables of {v} tie up working capital"),
    "gst_mismatch_pct": ("GST returns reconcile ({v} 2A vs 3B gap)", "GSTR-3B exceeds counterparty filings by {v}"),
    "bank_bounce_count": ("Clean banking conduct ({v} bounces)", "{v} cheque/ECS bounces indicate cash stress"),
    "cashflow_volatility": ("Stable monthly bank credits ({v} volatility)", "Volatile monthly bank credits ({v})"),
    "litigation_score": ("No material litigation ({v})", "Litigation exposure ({v})"),
    "promoter_sentiment": ("Benign or positive media coverage ({v})", "Adverse media around promoter/company ({v})"),
    "fraud_score": ("No material fraud indicators ({v})", "Fraud indicators raise risk ({v})"),
    "promoter_pledge_pct": ("Low promoter pledge ({v})", "{v} of promoter shares pledged"),
    "vintage_years": ("Established track record ({v})", "Limited operating track record ({v})"),
    "collateral_coverage": ("Security cover of {v} protects recovery", "Security cover of only {v}"),
    "sector_risk": ("Supportive sector backdrop ({v})", "Sector headwinds ({v})"),
}

# ------------------------------------------------------------------ financial helpers
def flat_financials(financials: dict[str, Any]) -> dict[str, dict[str, float]]:
    """Accept {FY: {field: number}} or extraction-style {FY: {field: {"value": number, ...}}}."""
    out: dict[str, dict[str, float]] = {}
    for fy, fields in (financials or {}).items():
        row: dict[str, float] = {}
        for k, v in (fields or {}).items():
            value = v.get("value") if isinstance(v, dict) else v
            if isinstance(value, int | float):
                row[k] = float(value)
        if "total_debt" not in row and any(k in row for k in ("long_term_debt", "short_term_debt", "current_portion_ltd")):
            row["total_debt"] = sum(row.get(k, 0.0) for k in ("long_term_debt", "short_term_debt", "current_portion_ltd"))
        out[fy] = row
    return out


def sorted_years(fin: dict[str, Any]) -> list[str]:
    """Fiscal-year labels, latest first."""
    return sorted(fin, key=lambda fy: int(fy[2:]) if fy[2:].isdigit() else 0, reverse=True)


def annual_debt_service(year: dict[str, float]) -> float | None:
    """Interest + scheduled principal (current maturities, or long-term debt over five years)."""
    interest = year.get("interest_expense")
    if interest is None:
        return None
    principal = year.get("current_portion_ltd")
    if principal is None:
        principal = (year.get("long_term_debt") or 0.0) / 5
    return interest + principal


def _div(a: float | None, b: float | None) -> float | None:
    if a is None or b in (None, 0):
        return None
    return a / b


def _r(x: float | None, nd: int = 4) -> float | None:
    return None if x is None else round(x, nd)


def ratio_row(fy: str, cur: dict[str, float], prev: dict[str, float] | None) -> dict[str, Any]:
    revenue, ebitda = cur.get("revenue"), cur.get("ebitda")
    service = annual_debt_service(cur)
    accrual = None
    if cur.get("pat") is not None and cur.get("interest_expense") is not None:
        accrual = cur["pat"] + (cur.get("depreciation") or 0) + cur["interest_expense"]
    elif ebitda is not None:
        accrual = ebitda * 0.75
    debt = cur.get("total_debt")
    return {
        "fiscal_year": fy,
        "revenue": revenue, "ebitda": ebitda, "pat": cur.get("pat"), "total_debt": debt, "net_worth": cur.get("net_worth"),
        "ebitda_margin": _r(_div(ebitda, revenue)),
        "pat_margin": _r(_div(cur.get("pat"), revenue)),
        "revenue_growth": _r(_div((revenue or 0) - (prev or {}).get("revenue", 0), (prev or {}).get("revenue")))
        if revenue is not None and prev and prev.get("revenue") else None,
        "debt_to_ebitda": _r(_div(debt, ebitda)) if (ebitda or 0) > 0 else (25.0 if debt else None),
        "debt_equity": _r(_div(debt, cur.get("net_worth"))) if (cur.get("net_worth") or 0) > 0 else (15.0 if debt else None),
        "interest_coverage": _r(_div(ebitda, cur.get("interest_expense"))),
        "dscr": _r(_div(accrual, service)) if service else None,
        "current_ratio": _r(_div(cur.get("current_assets"), cur.get("current_liabilities"))),
        "receivable_days": _r(_div((cur.get("receivables") or 0) * 365, revenue), 1) if cur.get("receivables") is not None else None,
        "inventory_days": _r(_div((cur.get("inventory") or 0) * 365, revenue), 1) if cur.get("inventory") is not None else None,
        "payable_days": _r(_div((cur.get("payables") or 0) * 365, revenue), 1) if cur.get("payables") is not None else None,
        "tol_tnw": _r(_div((cur.get("total_assets") or 0) - (cur.get("net_worth") or 0), cur.get("net_worth")))
        if cur.get("total_assets") and cur.get("net_worth") else None,
        "ocf_to_debt": _r(_div(cur.get("operating_cash_flow"), debt)),
    }


def compute_ratios(financials: dict[str, Any]) -> dict[str, Any]:
    fin = flat_financials(financials)
    years = sorted_years(fin)
    trend = [ratio_row(fy, fin[fy], fin[years[i + 1]] if i + 1 < len(years) else None) for i, fy in enumerate(years)]
    return {"latest_year": years[0] if years else None, "latest": trend[0] if trend else {}, "trend": trend}


# ------------------------------------------------------------------ model features
def _clip(name: str, value: float | None) -> float | None:
    if value is None:
        return None
    lo, hi = SPEC[name].clip
    return round(min(hi, max(lo, float(value))), 4)


def build_features(ctx: dict[str, Any]) -> tuple[dict[str, float | None], dict[str, str]]:
    ratios = ctx.get("ratios") or compute_ratios(ctx.get("financials") or {})
    latest = ratios.get("latest") or {}
    fy = ratios.get("latest_year")
    gst, bank = ctx.get("gst") or {}, ctx.get("bank") or {}
    research, fraud = ctx.get("research") or {}, ctx.get("fraud") or {}
    company, application = ctx.get("company") or {}, ctx.get("application") or {}
    shareholding = ctx.get("shareholding") or {}

    values: dict[str, float | None] = {name: latest.get(name) for name in
                                       ("dscr", "interest_coverage", "debt_to_ebitda", "debt_equity", "current_ratio",
                                        "ebitda_margin", "revenue_growth", "receivable_days")}
    sources = {name: f"Financial statements {fy}" for name in values if values[name] is not None}

    def put(name: str, value: Any, source: str) -> None:
        values[name] = float(value) if isinstance(value, int | float) else None
        if values[name] is not None:
            sources[name] = source

    put("gst_mismatch_pct", gst.get("max_mismatch_pct"), "GST returns (GSTR-2A/2B vs GSTR-3B)")
    put("bank_bounce_count", bank.get("bounce_count"), "Bank statements")
    put("cashflow_volatility", bank.get("credit_volatility"), "Bank statements (monthly credits)")
    put("litigation_score", research.get("litigation_score"), "Secondary research & legal documents")
    put("promoter_sentiment", research.get("sentiment_score"), "News & media sentiment")
    put("fraud_score", fraud.get("fraud_score"), "Fraud graph & GST forensics")
    put("promoter_pledge_pct", shareholding.get("pledged_pct"), "Shareholding pattern")
    year = company.get("incorporation_year")
    put("vintage_years", datetime.now(UTC).year - year if isinstance(year, int) else None, "Company profile (incorporation)")
    requested, collateral = application.get("requested_amount"), application.get("collateral_value")
    put("collateral_coverage", collateral / requested if requested and collateral is not None else None, "Application (collateral / request)")
    put("sector_risk", research.get("sector_risk"), "Sector knowledge base")
    return {name: _clip(name, values.get(name)) for name in FEATURE_NAMES}, sources


def format_value(name: str, value: float | None) -> str:
    if value is None:
        return "n/a"
    fmt = SPEC[name].fmt if name in SPEC else "x"
    if fmt == "x":
        return f"{value:.2f}x"
    if fmt == "pct":
        return f"{value * 100:.1f}%"
    if fmt == "signed":
        return f"{value * 100:+.1f}%"
    if fmt == "pct100":
        return f"{value:.1f}%"
    if fmt == "days":
        return f"{value:.0f} days"
    if fmt == "count":
        return f"{value:.0f}"
    if fmt == "years":
        return f"{value:.0f} yrs"
    if fmt == "sentiment":
        return f"{value:+.2f}"
    return f"{value:.0f}/100"


def describe(name: str, value: float | None, helps: bool) -> str:
    if value is None:
        return "Not available — the model used its learned default for missing data"
    good, bad = _TEXT[name]
    return (good if helps else bad).format(v=format_value(name, value))
