"""Research, fraud, scoring and CAM read/write endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import Analyst, AnyUser, get_case_or_404
from core.errors import NotFoundError
from core.storage import get_storage
from database.session import get_db
from fraud.graph.store import NetworkXGraphStore, to_cypher
from models import CamReport, CreditScore, FraudAlert, FraudAnalysis, ResearchReport, User
from models.enums import JobKind
from schemas.common import AlertUpdate, CamCommentsIn, JobOut
from scoring.models.registry import get_model
from services import case_context as cc
from services.audit import audit
from services.jobs import enqueue

router = APIRouter(tags=["intelligence"])


# ---------------------------------------------------------------- research
@router.get("/cases/{case_id}/research")
def get_research(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> dict[str, Any] | None:
    get_case_or_404(db, case_id)
    report = cc.latest(db, ResearchReport, case_id)
    if not report:
        return None
    data = cc.research_dict(report)
    return {**data, "id": report.id, "created_at": report.created_at.isoformat(), "providers": report.providers,
            "queries": report.queries, "litigation_cases": (report.sector or {}).get("litigation_cases", []),
            "summary_provider": (report.sector or {}).get("summary_provider")}


# ---------------------------------------------------------------- fraud
def _latest_fraud(db: Session, case_id: str) -> FraudAnalysis:
    analysis = cc.latest(db, FraudAnalysis, case_id)
    if not analysis:
        raise NotFoundError("Fraud analysis has not run for this case")
    return analysis


@router.get("/cases/{case_id}/fraud")
def get_fraud(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> dict[str, Any] | None:
    get_case_or_404(db, case_id)
    a = cc.latest(db, FraudAnalysis, case_id)
    if not a:
        return None
    stats = {k: v for k, v in (a.stats or {}).items() if k != "graph_store"}
    return {"id": a.id, "fraud_score": a.fraud_score, "risk_level": a.risk_level, "summary": a.summary, "graph": a.graph,
            "heatmap": a.heatmap, "gst_checks": a.gst_checks, "stats": stats, "created_at": a.created_at.isoformat(),
            "alerts": [{"id": x.id, "alert_type": x.alert_type, "severity": x.severity, "title": x.title, "description": x.description,
                        "entities": x.entities, "evidence": x.evidence, "score_impact": x.score_impact, "status": x.status}
                       for x in sorted(a.alerts, key=lambda x: -x.score_impact)]}


@router.patch("/fraud/alerts/{alert_id}")
def update_alert(alert_id: str, body: AlertUpdate, db: Session = Depends(get_db), user: User = Analyst) -> dict[str, str]:
    alert = db.get(FraudAlert, alert_id)
    if alert is None:
        raise NotFoundError("Alert not found")
    alert.status = body.status
    audit(db, user, "fraud.alert_review", "fraud_alert", alert.id, alert.case_id, summary=f"Marked '{alert.title}' {body.status}",
          details={"comment": body.comment})
    return {"id": alert.id, "status": alert.status}


@router.get("/cases/{case_id}/fraud/cypher", response_class=PlainTextResponse)
def export_cypher(case_id: str, db: Session = Depends(get_db), _: User = Analyst) -> str:
    analysis = _latest_fraud(db, case_id)
    graph = NetworkXGraphStore().load(case_id, (analysis.stats or {}).get("graph_store") or {"nodes": [], "links": []})
    return to_cypher(graph, case_id)


# ---------------------------------------------------------------- scoring
@router.get("/cases/{case_id}/score")
def get_score(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> dict[str, Any] | None:
    get_case_or_404(db, case_id)
    s = cc.latest(db, CreditScore, case_id)
    return {**cc.score_dict(s), "id": s.id} if s else None


@router.get("/cases/{case_id}/scores")
def score_history(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> list[dict[str, Any]]:
    get_case_or_404(db, case_id)
    rows = db.scalars(select(CreditScore).where(CreditScore.case_id == case_id).order_by(CreditScore.version)).all()
    return [{"id": s.id, "version": s.version, "credit_score": s.credit_score, "model_score": s.model_score, "decision": s.decision,
             "rating": s.rating, "risk_level": s.risk_level, "recommended_amount": s.recommended_amount,
             "suggested_rate": s.suggested_rate, "overlay_total": (s.explanation or {}).get("overlay_total", 0),
             "created_at": s.created_at.isoformat()} for s in rows]


@router.get("/model/info")
def model_info(_: User = AnyUser) -> dict[str, Any]:
    m = get_model()
    return m.meta


# ---------------------------------------------------------------- CAM
@router.get("/cases/{case_id}/cam")
def get_cam(case_id: str, version: int | None = None, db: Session = Depends(get_db), _: User = AnyUser) -> dict[str, Any] | None:
    get_case_or_404(db, case_id)
    stmt = select(CamReport).where(CamReport.case_id == case_id)
    stmt = stmt.where(CamReport.version == version) if version else stmt.order_by(CamReport.version.desc())
    cam = db.scalars(stmt.limit(1)).first()
    if not cam:
        return None
    versions = db.scalars(select(CamReport.version).where(CamReport.case_id == case_id).order_by(CamReport.version.desc())).all()
    return {"id": cam.id, "version": cam.version, "status": cam.status, "sections": cam.sections, "analyst_comments": cam.analyst_comments,
            "narrative_provider": cam.narrative_provider, "created_at": cam.created_at.isoformat(), "versions": list(versions)}


@router.post("/cases/{case_id}/cam", response_model=JobOut, status_code=202)
def generate_cam_job(case_id: str, db: Session = Depends(get_db), user: User = Analyst):
    case = get_case_or_404(db, case_id)
    audit(db, user, "cam.generate", "case", case.id, case.id, summary="Requested CAM generation")
    db.commit()
    return enqueue(db, JobKind.CAM, case_id=case.id, created_by_id=user.id)


@router.put("/cases/{case_id}/cam/comments")
def save_cam_comments(case_id: str, body: CamCommentsIn, db: Session = Depends(get_db), user: User = Analyst) -> dict[str, Any]:
    case = get_case_or_404(db, case_id)
    cam = cc.latest(db, CamReport, case_id)
    if cam and not body.regenerate:
        cam.analyst_comments = {**(cam.analyst_comments or {}), **body.comments}
        cam.sections = [{**s, "analyst_comment": cam.analyst_comments.get(s["id"], "")} for s in cam.sections]
    audit(db, user, "cam.comments", "case", case.id, case.id, summary=f"Updated {len(body.comments)} CAM comment(s)",
          details={"sections": list(body.comments)})
    db.commit()
    if body.regenerate:
        job = enqueue(db, JobKind.CAM, case_id=case.id, params={"comments": body.comments}, created_by_id=user.id)
        return {"job": JobOut.model_validate(job).model_dump(mode="json")}
    return {"saved": True}


@router.get("/cam/{cam_id}/download")
def download_cam(cam_id: str, format: str = Query("pdf", pattern="^(pdf|docx|html)$"), db: Session = Depends(get_db),
                 user: User = AnyUser) -> Response:
    cam = db.get(CamReport, cam_id)
    if cam is None:
        raise NotFoundError("CAM not found")
    case = get_case_or_404(db, cam.case_id)
    audit(db, user, "cam.download", "cam", cam.id, cam.case_id, summary=f"Downloaded CAM v{cam.version} ({format})")
    name = f"CAM-{case.reference}-v{cam.version}"
    if format == "html":
        return HTMLResponse(cam.html or "", headers={"Content-Disposition": f'inline; filename="{name}.html"'})
    key = cam.pdf_key if format == "pdf" else cam.docx_key
    media = "application/pdf" if format == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return Response(get_storage().get(key), media_type=media, headers={"Content-Disposition": f'attachment; filename="{name}.{format}"'})
