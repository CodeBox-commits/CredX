"""Assemble the case 'fact base' from the database for the engines, the copilot and the CAM.

The database is the source of truth (it includes analyst edits to financials), so every engine
reads through these functions rather than re-parsing documents.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from extraction.normalization.merge import merge_case_facts
from models import (
    AnalystNote,
    CamReport,
    CreditCase,
    CreditScore,
    Document,
    FinancialStatement,
    FraudAnalysis,
    ResearchReport,
)
from models.enums import DocumentStatus
from scoring.decision_logic.overlays import infer_note_impact

FIN_FIELDS = [
    "revenue", "ebitda", "depreciation", "interest_expense", "pat", "total_debt", "short_term_debt", "long_term_debt",
    "current_portion_ltd", "current_assets", "current_liabilities", "total_assets", "net_worth", "receivables",
    "inventory", "payables", "cash", "operating_cash_flow", "contingent_liabilities", "related_party_transactions",
]


def company_dict(case: CreditCase) -> dict[str, Any]:
    c = case.company
    return {
        "id": c.id, "name": c.name, "cin": c.cin, "pan": c.pan, "gstin": c.gstin, "sector": c.sector, "sub_sector": c.sub_sector,
        "constitution": c.constitution, "incorporation_year": c.incorporation_year, "city": c.city, "state": c.state,
        "promoters": c.promoters or [], "external_rating": c.external_rating, "website": c.website,
    }


def case_dict(case: CreditCase) -> dict[str, Any]:
    return {
        "id": case.id, "reference": case.reference, "facility_type": case.facility_type, "requested_amount": case.requested_amount,
        "tenure_months": case.tenure_months, "purpose": case.purpose, "collateral_type": case.collateral_type,
        "collateral_value": case.collateral_value, "status": case.status, "is_demo": case.is_demo,
    }


def processed_documents(db: Session, case_id: str) -> list[dict[str, Any]]:
    docs = db.scalars(select(Document).where(Document.case_id == case_id, Document.status == DocumentStatus.PROCESSED)
                      .order_by(Document.created_at)).all()
    return [{"id": d.id, "filename": d.filename, "doc_type": d.doc_type, "extracted": d.extracted} for d in docs]


def case_facts(db: Session, case_id: str) -> dict[str, Any]:
    return merge_case_facts(processed_documents(db, case_id))


def financials_by_year(db: Session, case_id: str) -> dict[str, dict[str, float]]:
    rows = db.scalars(select(FinancialStatement).where(FinancialStatement.case_id == case_id)).all()
    out: dict[str, dict[str, float]] = {}
    for r in rows:
        out[r.fiscal_year] = {f: getattr(r, f) for f in FIN_FIELDS if getattr(r, f) is not None}
    return out


def latest(db: Session, model, case_id: str):
    order = model.version.desc() if hasattr(model, "version") else model.created_at.desc()
    return db.scalars(select(model).where(model.case_id == case_id).order_by(order).limit(1)).first()


def notes_for_case(db: Session, case_id: str) -> list[dict[str, Any]]:
    notes = db.scalars(select(AnalystNote).where(AnalystNote.case_id == case_id).order_by(AnalystNote.created_at)).all()
    out = []
    for n in notes:
        inferred = n.inferred_impact
        if inferred is None and n.kind == "note":
            inferred = infer_note_impact(n.body)[0]
        out.append({"id": n.id, "kind": n.kind, "category": n.category, "body": n.body, "impact_points": n.impact_points,
                    "impact_rationale": n.impact_rationale, "five_c": n.five_c, "include_in_cam": n.include_in_cam,
                    "effective_impact": n.impact_points if n.impact_points is not None else inferred,
                    "author": n.author.full_name if n.author else None, "created_at": n.created_at.isoformat()})
    return out


def research_dict(report: ResearchReport | None) -> dict[str, Any] | None:
    if not report:
        return None
    return {
        "litigation_risk": report.litigation_risk, "promoter_sentiment": report.promoter_sentiment,
        "sector_outlook": report.sector_outlook, "overall_risk": report.overall_risk, "summary": report.summary,
        "sentiment_score": report.sentiment_score, "litigation_score": report.litigation_score,
        "sector_risk": (report.sector or {}).get("risk"), "sector_name": (report.sector or {}).get("name"),
        "sector": report.sector, "mca": report.mca,
        "findings": [{"category": f.category, "title": f.title, "snippet": f.snippet, "source": f.source, "url": f.url,
                      "severity": f.severity, "sentiment": f.sentiment, "provider": f.provider,
                      "published_at": f.published_at.isoformat() if f.published_at else None} for f in report.findings],
    }


def fraud_dict(analysis: FraudAnalysis | None) -> dict[str, Any] | None:
    if not analysis:
        return None
    return {
        "fraud_score": analysis.fraud_score, "risk_level": analysis.risk_level, "summary": analysis.summary,
        "gst_checks": analysis.gst_checks, "max_mismatch_pct": (analysis.stats or {}).get("max_mismatch_pct"),
        "alerts": [{"alert_type": a.alert_type, "severity": a.severity, "title": a.title, "description": a.description,
                    "status": a.status} for a in analysis.alerts if a.status != "dismissed"],
    }


def score_dict(score: CreditScore | None) -> dict[str, Any] | None:
    if not score:
        return None
    extra = score.explanation or {}
    return {
        "version": score.version, "model_version": score.model_version, "model_score": score.model_score,
        "credit_score": score.credit_score, "probability_of_default": score.probability_of_default,
        "approval_probability": score.approval_probability, "risk_level": score.risk_level, "rating": score.rating,
        "decision": score.decision, "recommended_amount": score.recommended_amount, "suggested_rate": score.suggested_rate,
        "contributions": score.contributions, "overlays": score.overlays, "policy": score.policy, "five_cs": score.five_cs,
        "loan_sizing": score.loan_sizing, "pricing": score.pricing, "ratios": score.ratios,
        "top_risk_factors": score.top_risk_factors, "top_strengths": score.top_strengths, "features": score.features,
        "decision_reasons": extra.get("decision_reasons", []), "conditions": extra.get("conditions", []),
        "what_if": extra.get("what_if", []), "base_points": extra.get("base_points"), "overlay_total": extra.get("overlay_total", 0),
        "model_metrics": extra.get("model_metrics", {}), "created_at": score.created_at.isoformat(),
    }


def scoring_context(db: Session, case: CreditCase) -> dict[str, Any]:
    facts = case_facts(db, case.id)
    fraud = latest(db, FraudAnalysis, case.id)
    research = latest(db, ResearchReport, case.id)
    banks = facts.get("bank") or []
    bounce = sum(b.get("bounce_count") or 0 for b in banks) if banks else None
    vols = [b["credit_volatility"] for b in banks if b.get("credit_volatility") is not None]
    gst_mismatch = (fraud.stats or {}).get("max_mismatch_pct") if fraud else None
    if gst_mismatch is None:
        mism = [g["mismatch_pct"] for g in facts.get("gst") or [] if g.get("mismatch_pct") is not None]
        gst_mismatch = max(mism) if mism else None
    fin = financials_by_year(db, case.id) or {fy: {k: v["value"] for k, v in f.items()} for fy, f in (facts.get("financials") or {}).items()}
    return {
        "company": company_dict(case),
        "application": case_dict(case),
        "financials": fin,
        "gst": {"max_mismatch_pct": gst_mismatch},
        "bank": {"bounce_count": bounce, "credit_volatility": max(vols) if vols else None},
        "research": research_dict(research) or {},
        "fraud": {"fraud_score": fraud.fraud_score} if fraud else {},
        "shareholding": facts.get("shareholding") or {},
        "red_flags": facts.get("red_flags") or [],
        "legal": facts.get("legal") or [],
        "notes": notes_for_case(db, case.id),
    }


def full_context(db: Session, case: CreditCase, compact: bool = False) -> dict[str, Any]:
    """Everything the copilot / CAM needs. `compact` trims bulky arrays for LLM prompts."""
    facts = case_facts(db, case.id)
    score = score_dict(latest(db, CreditScore, case.id))
    research = research_dict(latest(db, ResearchReport, case.id))
    fraud = fraud_dict(latest(db, FraudAnalysis, case.id))
    if compact and score:
        score = {**score, "contributions": score["contributions"][:10], "features": None,
                 "policy": {k: v for k, v in (score.get("policy") or {}).items() if k in ("knockouts", "deviations")}}
    if compact and research:
        research = {**research, "findings": research["findings"][:8], "mca": None}
    facts_view = {k: facts.get(k) for k in ("bank", "gst", "legal", "documents", "red_flags", "positive_signals", "shareholding")}
    if compact:
        facts_view["bank"] = [{k: v for k, v in b.items() if k not in ("monthly", "counterparties")} for b in facts_view["bank"] or []]
    return {
        "company": company_dict(case), "case": case_dict(case), "score": score, "research": research, "fraud": fraud,
        "facts": facts_view, "notes": notes_for_case(db, case.id),
        "latest_cam_version": (latest(db, CamReport, case.id) or CamReport(version=0)).version,
    }
