"""Merge per-document extractions into a single case-level profile.

Conflict resolution is field-by-field: the value with the highest evidence
confidence wins, and every source document is recorded for traceability.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from .schema import (
    BankSummary,
    Counterparty,
    Director,
    DocumentExtraction,
    FinancialYearData,
    GstPeriodData,
    LegalMatter,
    MCAProfile,
    RiskIndicator,
    SanctionFacility,
    Shareholder,
)


class CaseProfile(BaseModel):
    company_name: str | None = None
    cin: str | None = None
    pan: str | None = None
    gstins: list[str] = Field(default_factory=list)
    auditor: str | None = None
    directors: list[Director] = Field(default_factory=list)
    financials: list[FinancialYearData] = Field(default_factory=list)
    gst: list[GstPeriodData] = Field(default_factory=list)
    bank: BankSummary | None = None
    legal: list[LegalMatter] = Field(default_factory=list)
    sanctions: list[SanctionFacility] = Field(default_factory=list)
    shareholding: list[Shareholder] = Field(default_factory=list)
    mca: MCAProfile | None = None
    counterparties: list[Counterparty] = Field(default_factory=list)
    risk_indicators: list[RiskIndicator] = Field(default_factory=list)
    document_types: dict[str, int] = Field(default_factory=dict)
    field_sources: dict[str, str] = Field(default_factory=dict)
    data_completeness: float = 0.0


def merge_extractions(items: list[tuple[str, DocumentExtraction]]) -> CaseProfile:
    profile = CaseProfile()
    years: dict[str, FinancialYearData] = {}
    year_conf: dict[tuple[str, str], float] = {}
    gst: dict[tuple[str | None, str], GstPeriodData] = {}
    directors: dict[str, Director] = {}
    risks: dict[str, RiskIndicator] = {}
    name_votes: dict[str, float] = {}

    for doc_id, ext in items:
        profile.document_types[ext.doc_type] = profile.document_types.get(ext.doc_type, 0) + 1
        ent = ext.entities
        if ent.company_name:
            name_votes[ent.company_name] = name_votes.get(ent.company_name, 0) + ext.confidence
        profile.cin = profile.cin or ent.cin
        profile.pan = profile.pan or ent.pan
        profile.auditor = profile.auditor or ent.auditor
        for g in ent.gstins:
            if g not in profile.gstins:
                profile.gstins.append(g)
        for d in ent.directors:
            existing = directors.setdefault(d.name, d)
            existing.din = existing.din or d.din
            existing.designation = existing.designation or d.designation

        conf_by_field = {(e.fiscal_year, e.field): e.confidence for e in ext.evidence}
        for fy in ext.financials:
            target = years.setdefault(fy.fiscal_year, FinancialYearData(fiscal_year=fy.fiscal_year))
            for field, value in fy.populated().items():
                conf = conf_by_field.get((fy.fiscal_year, field), fy.confidence)
                key = (fy.fiscal_year, field)
                if key not in year_conf or conf > year_conf[key]:
                    setattr(target, field, value)
                    year_conf[key] = conf
                    profile.field_sources[f"{fy.fiscal_year}.{field}"] = doc_id

        for period in ext.gst:
            key = (period.gstin, period.period)
            existing_period = gst.get(key)
            if existing_period is None:
                gst[key] = period.model_copy()
            else:
                for field, value in period.model_dump(exclude={"gstin", "period"}).items():
                    if value not in (None, 0) and getattr(existing_period, field) in (None, 0):
                        setattr(existing_period, field, value)

        if ext.bank and (profile.bank is None or len(ext.bank.months) > len(profile.bank.months)):
            profile.bank = ext.bank
        profile.legal.extend(m for m in ext.legal if all(m.case_type != x.case_type for x in profile.legal))
        profile.sanctions.extend(ext.sanctions)
        if ext.shareholding and not profile.shareholding:
            profile.shareholding = ext.shareholding
        if ext.mca:
            profile.mca = ext.mca
        for cp in ext.counterparties:
            if all((cp.gstin or cp.name) != (x.gstin or x.name) for x in profile.counterparties):
                profile.counterparties.append(cp)
        for r in ext.risk_indicators:
            if r.code not in risks or _sev(r.severity) > _sev(risks[r.code].severity):
                risks[r.code] = r

    if name_votes:
        profile.company_name = max(name_votes.items(), key=lambda kv: kv[1])[0]
    for fy, data in years.items():
        confs = [c for (y, _), c in year_conf.items() if y == fy]
        data.confidence = round(sum(confs) / len(confs), 3) if confs else 0.0
    profile.financials = sorted(years.values(), key=lambda y: y.fiscal_year, reverse=True)
    profile.gst = sorted(gst.values(), key=lambda g: g.period)
    profile.directors = list(directors.values())
    profile.risk_indicators = sorted(risks.values(), key=lambda r: -_sev(r.severity))
    profile.data_completeness = _completeness(profile)
    return profile


_SEV = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


def _sev(level: str) -> int:
    return _SEV.get(level, 0)


def _completeness(profile: CaseProfile) -> float:
    checks: list[Any] = [
        profile.company_name,
        profile.financials,
        len(profile.financials) >= 2,
        profile.financials and profile.financials[0].ebitda is not None,
        profile.financials and profile.financials[0].total_debt is not None,
        profile.gst,
        profile.bank,
        profile.gstins,
        profile.directors,
    ]
    return round(sum(1 for c in checks if c) / len(checks), 2)
