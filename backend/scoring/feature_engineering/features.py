"""Feature engineering: case profile + research + fraud → model-ready features.

Missing values stay ``NaN`` (XGBoost learns a default branch for them) and are
reported explicitly, so a thin file never silently looks like a strong one.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from extraction.normalization.merge import CaseProfile
from extraction.normalization.schema import FinancialYearData

NAN = float("nan")


@dataclass(frozen=True, slots=True)
class FeatureSpec:
    name: str
    label: str
    fmt: str  # ratio | pct | days | score | x | count
    higher_is_riskier: bool
    group: str  # capacity | capital | liquidity | conduct | external | fraud


MODEL_FEATURES: list[FeatureSpec] = [
    FeatureSpec("dscr", "Debt service coverage (DSCR)", "x", False, "capacity"),
    FeatureSpec("interest_coverage", "Interest coverage", "x", False, "capacity"),
    FeatureSpec("debt_to_ebitda", "Debt / EBITDA", "x", True, "capital"),
    FeatureSpec("debt_to_equity", "Debt / Equity (gearing)", "x", True, "capital"),
    FeatureSpec("current_ratio", "Current ratio", "x", False, "liquidity"),
    FeatureSpec("ebitda_margin", "EBITDA margin", "pct", False, "capacity"),
    FeatureSpec("pat_margin", "PAT margin", "pct", False, "capacity"),
    FeatureSpec("revenue_growth", "Revenue growth (YoY)", "pct", False, "capacity"),
    FeatureSpec("receivable_days", "Receivable days", "days", True, "liquidity"),
    FeatureSpec("log_revenue", "Scale (log revenue)", "score", False, "capacity"),
    FeatureSpec("gst_bank_variance", "GST vs bank credit variance", "pct", True, "conduct"),
    FeatureSpec("itc_excess", "Excess ITC over GSTR-2A/2B", "pct", True, "conduct"),
    FeatureSpec("bounce_rate", "Cheque/ECS bounces per month", "count", True, "conduct"),
    FeatureSpec("litigation_score", "Litigation severity", "score", True, "external"),
    FeatureSpec("adverse_media", "Adverse media intensity", "score", True, "external"),
    FeatureSpec("sector_risk", "Sector risk", "score", True, "external"),
    FeatureSpec("promoter_pledge", "Promoter shares pledged", "pct", True, "external"),
    FeatureSpec("fraud_score", "Fraud risk score", "score", True, "fraud"),
]
FEATURE_NAMES = [f.name for f in MODEL_FEATURES]
SPEC_BY_NAME = {f.name: f for f in MODEL_FEATURES}

_LEVEL = {"LOW": 0.0, "MEDIUM": 1.0, "HIGH": 2.0, "CRITICAL": 3.0}


@dataclass(slots=True)
class ExternalSignals:
    litigation_risk: str = "LOW"
    promoter_sentiment: str = "NEUTRAL"
    sector_outlook: str = "STABLE"
    sector_risk_score: float = 47.0
    external_risk_score: float = 0.0
    adverse_findings: int = 0
    available: bool = False


@dataclass(slots=True)
class FraudSignals:
    fraud_risk_score: float = 0.0
    risk_level: str = "LOW"
    itc_ratio: float | None = None
    bank_gst_ratio: float | None = None
    available: bool = False


@dataclass(slots=True)
class FeatureVector:
    values: dict[str, float]
    missing: list[str] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)

    def as_row(self) -> list[float]:
        return [self.values[name] for name in FEATURE_NAMES]


def _div(a: float | None, b: float | None) -> float:
    if a is None or b is None or b == 0:
        return NAN
    return a / b


def latest_years(profile: CaseProfile) -> tuple[FinancialYearData | None, FinancialYearData | None]:
    years = profile.financials
    return (years[0] if years else None, years[1] if len(years) > 1 else None)


def compute_dscr(y: FinancialYearData, tenure_years: float = 5.0) -> float:
    """(PAT + depreciation + interest) / (interest + scheduled principal ≈ LTD / tenor)."""
    if y.interest_expense is None:
        return NAN
    cash_accrual = None
    if y.pat is not None:
        cash_accrual = y.pat + (y.depreciation or 0) + y.interest_expense
    elif y.ebitda is not None:
        cash_accrual = y.ebitda * 0.75  # post-tax proxy when PAT is unavailable
    if cash_accrual is None:
        return NAN
    principal = (y.long_term_debt if y.long_term_debt is not None else (y.total_debt or 0) * 0.6) / tenure_years
    service = y.interest_expense + principal
    return _div(cash_accrual, service) if service > 0 else NAN


def build_features(
    profile: CaseProfile,
    external: ExternalSignals,
    fraud: FraudSignals,
) -> FeatureVector:
    y, prev = latest_years(profile)
    v: dict[str, float] = {}
    if y is not None:
        ebitda = y.ebitda
        v["dscr"] = compute_dscr(y)
        v["interest_coverage"] = _div(ebitda, y.interest_expense)
        v["debt_to_ebitda"] = _div(y.total_debt, ebitda) if (ebitda or 0) > 0 else (25.0 if y.total_debt else NAN)
        v["debt_to_equity"] = _div(y.total_debt, y.net_worth) if (y.net_worth or 0) > 0 else (15.0 if y.net_worth is not None else NAN)
        v["current_ratio"] = _div(y.current_assets, y.current_liabilities)
        v["ebitda_margin"] = _div(ebitda, y.revenue)
        v["pat_margin"] = _div(y.pat, y.revenue)
        v["revenue_growth"] = _div((y.revenue or 0) - (prev.revenue or 0), prev.revenue) if prev and prev.revenue and y.revenue else NAN
        v["receivable_days"] = _div((y.receivables or 0) * 365, y.revenue) if y.receivables is not None else NAN
        v["log_revenue"] = math.log10(y.revenue) if y.revenue and y.revenue > 0 else NAN
    else:
        for name in ("dscr", "interest_coverage", "debt_to_ebitda", "debt_to_equity", "current_ratio", "ebitda_margin",
                     "pat_margin", "revenue_growth", "receivable_days", "log_revenue"):
            v[name] = NAN

    v["gst_bank_variance"] = abs(1 - fraud.bank_gst_ratio) if fraud.bank_gst_ratio else NAN
    v["itc_excess"] = max(0.0, fraud.itc_ratio - 1) if fraud.itc_ratio else (0.0 if profile.gst else NAN)
    bank = profile.bank
    if bank and (bank.months or bank.bounce_count):
        v["bounce_rate"] = bank.bounce_count / max(1, len(bank.months) or 3)
    else:
        v["bounce_rate"] = NAN
    v["litigation_score"] = _LEVEL.get(external.litigation_risk, 0.0) if external.available else NAN
    v["adverse_media"] = (
        {"NEGATIVE": 0.75, "NEUTRAL": 0.3, "POSITIVE": 0.05}.get(external.promoter_sentiment, 0.3)
        + min(0.25, external.adverse_findings * 0.05)
        if external.available else NAN
    )
    v["sector_risk"] = external.sector_risk_score / 100
    pledges = [s.pledged_pct for s in profile.shareholding if s.category == "promoter"]
    v["promoter_pledge"] = (max(pledges) / 100) if pledges else NAN
    v["fraud_score"] = fraud.fraud_risk_score / 100 if fraud.available else NAN

    # Clip extreme ratios to the training domain.
    clips = {"dscr": (-2, 8), "interest_coverage": (-5, 30), "debt_to_ebitda": (0, 25), "debt_to_equity": (0, 15),
             "current_ratio": (0, 6), "ebitda_margin": (-0.5, 0.6), "pat_margin": (-0.5, 0.4),
             "revenue_growth": (-0.8, 1.5), "receivable_days": (0, 400), "gst_bank_variance": (0, 2), "itc_excess": (0, 2),
             "bounce_rate": (0, 10)}
    for name, (lo, hi) in clips.items():
        if not math.isnan(v[name]):
            v[name] = round(min(hi, max(lo, v[name])), 4)

    missing = [name for name in FEATURE_NAMES if math.isnan(v[name])]
    raw = {
        "fiscal_year": y.fiscal_year if y else None,
        "revenue": y.revenue if y else None,
        "ebitda": y.ebitda if y else None,
        "pat": y.pat if y else None,
        "total_debt": y.total_debt if y else None,
        "net_worth": y.net_worth if y else None,
        "short_term_debt": y.short_term_debt if y else None,
        "interest_expense": y.interest_expense if y else None,
    }
    return FeatureVector(values=v, missing=missing, raw=raw)


def format_feature(name: str, value: float) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "n/a"
    fmt = SPEC_BY_NAME[name].fmt if name in SPEC_BY_NAME else "ratio"
    if fmt == "pct":
        return f"{value * 100:.1f}%"
    if fmt == "x":
        return f"{value:.2f}x"
    if fmt == "days":
        return f"{value:.0f} days"
    if fmt == "count":
        return f"{value:.1f}"
    if name == "log_revenue":
        return f"₹{10 ** value / 1e7:,.0f} Cr"
    return f"{value:.2f}"
