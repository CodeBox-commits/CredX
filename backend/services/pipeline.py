"""Job handlers: ingestion, research, fraud, scoring, CAM and the end-to-end analysis workflow.

Handlers receive (db, job, progress) and return a small JSON result. They are executed by
workers.runner regardless of whether the job came through Celery, the thread pool or inline.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ai.summarizers.services import cam_narrative
from cam.exporters.renderers import render_docx, render_html, render_pdf
from cam.generators.builder import build_sections
from core.logging import get_logger
from core.metrics import DOCUMENTS
from core.storage import get_storage, materialize
from extraction.pipeline import process_document
from fraud.engine import run_fraud_analysis
from models import (
    AnalystNote,
    BankStatementSummary,
    CamReport,
    Company,
    CreditCase,
    CreditScore,
    Document,
    FinancialStatement,
    FraudAlert,
    FraudAnalysis,
    GstFiling,
    Job,
    ResearchFinding,
    ResearchReport,
)
from models.enums import CaseStatus, DocumentStatus, JobKind, JobStatus
from research.engine import run_research
from scoring.inference.engine import score_case
from services import case_context as cc

log = get_logger("credx.pipeline")


def _sub(progress, start: int, end: int):
    """Map a child's 0..100 progress into [start, end] of the parent job."""
    return lambda pct, stage, msg: progress(start + int((end - start) * pct / 100), stage, msg)


def _date(s: str | None) -> date | None:
    try:
        return date.fromisoformat(s) if s else None
    except ValueError:
        return None


# ------------------------------------------------------------------ ingestion
def _persist_financials(db: Session, doc: Document, result: dict[str, Any]) -> int:
    count = 0
    for fy, fields in (result.get("financials") or {}).items():
        row = db.scalars(select(FinancialStatement).where(FinancialStatement.case_id == doc.case_id,
                                                          FinancialStatement.fiscal_year == fy)).first()
        if row is None:
            row = FinancialStatement(case_id=doc.case_id, fiscal_year=fy, document_id=doc.id, source="extracted", provenance={})
            db.add(row)
        provenance = dict(row.provenance or {})
        for name, info in fields.items():
            if not hasattr(row, name) or name in ("pbt",):
                continue
            current = provenance.get(name)
            if row.source == "manual" and getattr(row, name) is not None:
                continue
            if current is None or info["confidence"] >= current.get("confidence", 0):
                setattr(row, name, info["value"])
                provenance[name] = {"document_id": doc.id, "filename": doc.filename, "page": info.get("page"),
                                    "snippet": info.get("snippet"), "confidence": info["confidence"], "method": info.get("method")}
                count += 1
        row.provenance = provenance
        confs = [p["confidence"] for p in provenance.values()]
        row.confidence = round(sum(confs) / len(confs), 3) if confs else None
    return count


def _persist_specific(db: Session, doc: Document, result: dict[str, Any]) -> None:
    gst = result.get("gst")
    if gst:
        gstin = (result.get("identifiers") or {}).get("gstins", [None])[0] if (result.get("identifiers") or {}).get("gstins") else None
        for r in gst.get("returns", []):
            db.add(GstFiling(case_id=doc.case_id, document_id=doc.id, gstin=gstin, return_type=r["return_type"],
                             period=r.get("period") or gst.get("period") or "unknown", taxable_turnover=r.get("turnover"),
                             itc_claimed=r.get("itc") or gst.get("itc_claimed"), tax_paid=gst.get("tax_paid"),
                             filed_on=_date(gst.get("filed_on")), days_late=gst.get("days_late")))
    bank = result.get("bank")
    if bank:
        db.add(BankStatementSummary(
            case_id=doc.case_id, document_id=doc.id, bank_name=bank.get("bank_name"), account_masked=bank.get("account_masked"),
            period_start=_date(bank.get("period_start")), period_end=_date(bank.get("period_end")),
            opening_balance=bank.get("opening_balance"), closing_balance=bank.get("closing_balance"),
            total_credits=bank.get("total_credits"), total_debits=bank.get("total_debits"), average_balance=bank.get("average_balance"),
            bounce_count=bank.get("bounce_count") or 0, overdraw_days=bank.get("overdraw_days") or 0,
            monthly=bank.get("monthly") or [], counterparties=bank.get("counterparties") or [],
        ))


def handle_ingest(db: Session, job: Job, progress) -> dict[str, Any]:
    doc = db.get(Document, job.document_id)
    if doc is None:
        raise ValueError("document not found")
    doc_id, case_id = doc.id, doc.case_id
    doc.status = DocumentStatus.PROCESSING
    db.commit()
    try:
        with materialize(doc.storage_key, Path(doc.filename).suffix) as path:
            result = process_document(path, doc.filename, doc.declared_type, progress)
        fields = _apply_extraction(db, doc, result)
        db.commit()
    except Exception as exc:
        db.rollback()
        doc = db.get(Document, doc_id)
        doc.status = DocumentStatus.FAILED
        doc.error = f"{type(exc).__name__}: {exc}"[:1000]
        DOCUMENTS.labels(doc.doc_type or "unknown", "failed").inc()
        db.commit()
        _after_ingest(db, case_id, job)  # a failed document must not block auto-analysis of the rest
        raise
    _after_ingest(db, case_id, job)
    return {"document_id": doc.id, "doc_type": doc.doc_type, "confidence": doc.extraction_confidence,
            "financial_fields": fields, "headline": result["headline"]}


def _apply_extraction(db: Session, doc: Document, result: dict[str, Any]) -> int:
    # Re-ingestion: replace previously persisted structured rows from this document.
    for model in (GstFiling, BankStatementSummary):
        for row in db.scalars(select(model).where(model.document_id == doc.id)).all():
            db.delete(row)
    doc.doc_type = result["doc_type"]
    doc.classification_confidence = result["classification"]["confidence"]
    doc.classification_signals = result["classification"]["signals"]
    doc.page_count = result["page_count"]
    doc.ocr_used = result["ocr_used"]
    doc.extraction_confidence = result["confidence"]["overall"]
    doc.text_preview = result.pop("text_preview", None)
    doc.status = DocumentStatus.PROCESSED
    doc.error = None
    fields = _persist_financials(db, doc, result)
    _persist_specific(db, doc, result)

    company = db.get(CreditCase, doc.case_id).company
    ids = result.get("identifiers") or {}
    for attr, values in (("gstin", ids.get("gstins")), ("cin", ids.get("cins"))):
        if getattr(company, attr) or not values:
            continue
        owner = db.scalars(select(Company).where(getattr(Company, attr) == values[0], Company.id != company.id)).first()
        if owner is None:
            setattr(company, attr, values[0])
        else:
            # Same statutory identifier already belongs to another borrower: surface it, don't overwrite.
            result.setdefault("warnings", []).append(
                f"{attr.upper()} {values[0]} in this document is already registered to '{owner.name}' — possible duplicate or identity mismatch")
    doc.extracted = result
    DOCUMENTS.labels(result["doc_type"], "processed").inc()
    return fields


def _after_ingest(db: Session, case_id: str, job: Job) -> None:
    """When every document has settled, unlock the case and (optionally) start full analysis."""
    case = db.get(CreditCase, case_id)
    pending = db.scalar(select(func.count()).select_from(Document).where(
        Document.case_id == case_id, Document.status.in_([DocumentStatus.UPLOADED, DocumentStatus.PROCESSING])))
    if pending or case.status != CaseStatus.INGESTING:
        return
    case.status = CaseStatus.DRAFT
    db.commit()
    processed = db.scalar(select(func.count()).select_from(Document).where(
        Document.case_id == case_id, Document.status == DocumentStatus.PROCESSED))
    if not (job.params.get("auto_analyze") and processed):
        return
    from services.jobs import enqueue  # avoid import cycle

    running = db.scalar(select(func.count()).select_from(Job).where(
        Job.case_id == case_id, Job.kind == JobKind.FULL_ANALYSIS, Job.status.in_([JobStatus.QUEUED, JobStatus.RUNNING])))
    if not running:
        enqueue(db, JobKind.FULL_ANALYSIS, case_id=case_id, created_by_id=job.created_by_id)


# ------------------------------------------------------------------ research / fraud
def _revenue(db: Session, case: CreditCase) -> float | None:
    fin = cc.financials_by_year(db, case.id)
    if not fin:
        return None
    latest = max(fin, key=lambda y: int(y[2:]))
    return fin[latest].get("revenue")


def run_research_step(db: Session, case: CreditCase, progress) -> ResearchReport:
    facts = cc.case_facts(db, case.id)
    result = run_research(cc.company_dict(case), facts, _revenue(db, case), use_demo_intel=case.is_demo, progress=progress, case_id=case.id)
    report = ResearchReport(
        case_id=case.id, litigation_risk=result["litigation_risk"], promoter_sentiment=result["promoter_sentiment"],
        sector_outlook=result["sector_outlook"], overall_risk=result["overall_risk"], sentiment_score=result["sentiment_score"],
        litigation_score=result["litigation_score"], summary=result["summary"],
        sector={**result["sector"], "litigation_cases": result["litigation_cases"], "summary_provider": result["summary_provider"]},
        mca=result["mca"], providers=result["providers"], queries=result["queries"],
    )
    db.add(report)
    db.flush()
    for f in result["findings"]:
        published = None
        if f.get("published_at"):
            try:
                published = datetime.fromisoformat(f["published_at"])
            except ValueError:
                published = None
        db.add(ResearchFinding(report_id=report.id, case_id=case.id, category=f["category"], title=f["title"], snippet=f.get("snippet"),
                               source=f["source"][:160], url=f.get("url"), published_at=published, sentiment=f["sentiment"],
                               severity=f["severity"], tags=f.get("tags", []), provider=f["provider"]))
    db.commit()
    return report


def run_fraud_step(db: Session, case: CreditCase, progress) -> FraudAnalysis:
    facts = cc.case_facts(db, case.id)
    company = cc.company_dict(case)
    result = run_fraud_analysis(company, facts, case.network or None, _revenue(db, case), progress)
    stats = {**result["stats"], "max_mismatch_pct": result["max_mismatch_pct"]}
    analysis = FraudAnalysis(case_id=case.id, fraud_score=result["fraud_score"], risk_level=result["risk_level"],
                             summary=result["summary"], graph=result["graph"], heatmap=result["heatmap"],
                             gst_checks=result["gst_checks"], stats=stats)
    db.add(analysis)
    db.flush()
    for a in result["alerts"]:
        db.add(FraudAlert(analysis_id=analysis.id, case_id=case.id, alert_type=a["alert_type"], severity=a["severity"],
                          title=a["title"][:255], description=a["description"], entities=a["entities"], evidence=a["evidence"],
                          score_impact=a["score_impact"]))
    case.latest_fraud_score = result["fraud_score"]
    db.commit()
    return analysis


# ------------------------------------------------------------------ scoring
def run_scoring_step(db: Session, case: CreditCase, created_by_id: str | None) -> CreditScore:
    ctx = cc.scoring_context(db, case)
    result = score_case(ctx)
    version = (db.scalar(select(func.max(CreditScore.version)).where(CreditScore.case_id == case.id)) or 0) + 1
    score = CreditScore(
        case_id=case.id, version=version, model_version=result["model_version"], model_score=result["model_score"],
        credit_score=result["credit_score"], probability_of_default=result["probability_of_default"],
        approval_probability=result["approval_probability"], risk_level=result["risk_level"], rating=result["rating"],
        decision=result["decision"], recommended_amount=result["recommended_amount"], suggested_rate=result["suggested_rate"],
        features=result["features"], contributions=result["contributions"], overlays=result["overlays"], policy=result["policy"],
        five_cs=result["five_cs"], loan_sizing=result["loan_sizing"], pricing=result["pricing"], ratios=result["ratios"],
        top_risk_factors=result["top_risk_factors"], top_strengths=result["top_strengths"], created_by_id=created_by_id,
        explanation={k: result[k] for k in ("decision_reasons", "conditions", "what_if", "base_points", "overlay_total",
                                             "model_metrics", "model_probability_of_default")},
    )
    db.add(score)
    case.latest_score = result["credit_score"]
    case.latest_risk_level = result["risk_level"]
    # Persist the inferred impact of each note so the notes timeline shows what the engine applied.
    applied = {o["reference_id"]: o for o in result["overlays"] if o["source"] == "analyst_note"}
    for note in db.scalars(select(AnalystNote).where(AnalystNote.case_id == case.id, AnalystNote.kind == "note")).all():
        o = applied.get(note.id)
        note.inferred_impact = o["points"] if o else 0
        if note.impact_points is None:
            note.impact_rationale = o["rationale"] if o else "No score-relevant signal detected"
    db.commit()
    return score


# ------------------------------------------------------------------ CAM
def generate_cam(db: Session, case: CreditCase, user_id: str | None, comments: dict[str, str] | None = None) -> CamReport:
    previous = cc.latest(db, CamReport, case.id)
    merged_comments = {**((previous.analyst_comments if previous else None) or {}), **(comments or {})}
    ctx = cc.full_context(db, case)
    narrative = cam_narrative(cc.full_context(db, case, compact=True), case.id, user_id)
    sections = build_sections(ctx, narrative.text, merged_comments)
    version = (previous.version if previous else 0) + 1
    score = cc.latest(db, CreditScore, case.id)
    storage = get_storage()
    pdf_key = storage.put(f"cams/{case.id}/CAM-{case.reference}-v{version}.pdf", render_pdf(ctx, sections, version), "application/pdf")
    docx_key = storage.put(f"cams/{case.id}/CAM-{case.reference}-v{version}.docx", render_docx(ctx, sections, version),
                           "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    cam = CamReport(case_id=case.id, version=version, score_id=score.id if score else None, sections=sections,
                    analyst_comments=merged_comments, html=render_html(ctx, sections, version), pdf_key=pdf_key, docx_key=docx_key,
                    narrative_provider=narrative.provider, generated_by_id=user_id)
    db.add(cam)
    db.commit()
    return cam


# ------------------------------------------------------------------ handlers
def handle_research(db: Session, job: Job, progress) -> dict[str, Any]:
    report = run_research_step(db, db.get(CreditCase, job.case_id), progress)
    return {"report_id": report.id, "litigation_risk": report.litigation_risk, "promoter_sentiment": report.promoter_sentiment,
            "sector_outlook": report.sector_outlook}


def handle_fraud(db: Session, job: Job, progress) -> dict[str, Any]:
    analysis = run_fraud_step(db, db.get(CreditCase, job.case_id), progress)
    return {"analysis_id": analysis.id, "fraud_score": analysis.fraud_score, "risk_level": analysis.risk_level}


def handle_score(db: Session, job: Job, progress) -> dict[str, Any]:
    progress(30, "scoring", "Scoring with XGBoost + SHAP")
    score = run_scoring_step(db, db.get(CreditCase, job.case_id), job.created_by_id)
    progress(100, "complete", "Scored")
    return {"score_id": score.id, "credit_score": score.credit_score, "decision": score.decision}


def handle_cam(db: Session, job: Job, progress) -> dict[str, Any]:
    progress(20, "cam", "Writing CAM narrative")
    cam = generate_cam(db, db.get(CreditCase, job.case_id), job.created_by_id, job.params.get("comments"))
    progress(100, "complete", "CAM ready")
    return {"cam_id": cam.id, "version": cam.version}


def handle_full_analysis(db: Session, job: Job, progress) -> dict[str, Any]:
    case = db.get(CreditCase, job.case_id)
    previous_status = case.status
    case.status = CaseStatus.ANALYZING
    db.commit()
    steps = [
        ("research", "Secondary research", 0, 30),
        ("fraud", "Fraud graph & GST forensics", 30, 50),
        ("scoring", "Credit scoring & explainability", 50, 75),
        ("cam", "CAM generation", 75, 100),
    ]
    job.steps = [{"key": k, "label": label, "status": "pending"} for k, label, _, _ in steps]
    db.commit()
    out: dict[str, Any] = {}

    def mark(key: str, status: str) -> None:
        job.steps = [{**s, "status": status} if s["key"] == key else s for s in job.steps]
        db.commit()

    try:
        for key, _label, start, end in steps:
            mark(key, "running")
            sub = _sub(progress, start, end)
            if key == "research":
                out["research"] = run_research_step(db, case, sub).overall_risk
            elif key == "fraud":
                out["fraud_score"] = run_fraud_step(db, case, sub).fraud_score
            elif key == "scoring":
                sub(20, "scoring", "Scoring with XGBoost + SHAP")
                s = run_scoring_step(db, case, job.created_by_id)
                out.update(credit_score=s.credit_score, decision=s.decision)
            elif key == "cam":
                sub(20, "cam", "Writing CAM")
                out["cam_version"] = generate_cam(db, case, job.created_by_id).version
            mark(key, "done")
    except Exception:
        case.status = previous_status if previous_status not in (CaseStatus.ANALYZING,) else CaseStatus.DRAFT
        db.commit()
        raise
    if case.status not in (CaseStatus.APPROVED, CaseStatus.REJECTED, CaseStatus.ESCALATED):
        case.status = CaseStatus.IN_REVIEW
    db.commit()
    return out


HANDLERS = {
    JobKind.INGEST_DOCUMENT: handle_ingest,
    JobKind.RESEARCH: handle_research,
    JobKind.FRAUD: handle_fraud,
    JobKind.SCORE: handle_score,
    JobKind.CAM: handle_cam,
    JobKind.FULL_ANALYSIS: handle_full_analysis,
}


def now() -> datetime:
    return datetime.now(UTC)
