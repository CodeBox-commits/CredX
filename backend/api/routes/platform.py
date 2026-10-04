"""Copilot, jobs, audit log, dashboard analytics, health and metrics."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ai.orchestration.router import get_router
from ai.providers.base import ChatMessage, LLMError
from ai.summarizers.services import answer_question
from api.deps import AnyUser, Manager, get_case_or_404
from config import get_settings
from core.errors import NotFoundError, UpstreamError
from core.metrics import render_metrics
from database.session import get_db
from models import AiUsage, AuditLog, Company, CopilotMessage, CreditCase, FraudAlert, Job, User
from schemas.common import AuditOut, ChatIn, ChatOut, JobOut
from services import case_context as cc

router = APIRouter(tags=["platform"])
public = APIRouter(tags=["health"])


# ---------------------------------------------------------------- copilot
@router.post("/copilot/chat", response_model=ChatOut)
def chat(body: ChatIn, db: Session = Depends(get_db), user: User = AnyUser) -> ChatOut:
    context: dict[str, Any] = {}
    if body.case_id:
        case = get_case_or_404(db, body.case_id)
        context = cc.full_context(db, case, compact=True)
    history_rows = db.scalars(select(CopilotMessage).where(CopilotMessage.user_id == user.id, CopilotMessage.case_id == body.case_id)
                              .order_by(CopilotMessage.created_at.desc()).limit(10)).all()
    history = [ChatMessage(m.role, m.content) for m in reversed(history_rows)]
    try:
        result = answer_question(context, history, body.message, body.case_id, user.id)
    except LLMError as exc:
        raise UpstreamError(f"AI providers unavailable: {exc}") from exc
    db.add(CopilotMessage(case_id=body.case_id, user_id=user.id, role="user", content=body.message))
    reply = CopilotMessage(case_id=body.case_id, user_id=user.id, role="assistant", content=result.text, provider=result.provider)
    db.add(reply)
    db.flush()
    return ChatOut(answer=result.text, provider=result.provider, model=result.model, input_tokens=result.input_tokens,
                   output_tokens=result.output_tokens, latency_ms=result.latency_ms, fallback_used=result.fallback_used, message_id=reply.id)


@router.get("/copilot/history")
def chat_history(case_id: str | None = None, db: Session = Depends(get_db), user: User = AnyUser) -> list[dict[str, Any]]:
    rows = db.scalars(select(CopilotMessage).where(CopilotMessage.user_id == user.id, CopilotMessage.case_id == case_id)
                      .order_by(CopilotMessage.created_at).limit(100)).all()
    return [{"id": m.id, "role": m.role, "content": m.content, "provider": m.provider, "created_at": m.created_at.isoformat()} for m in rows]


@router.get("/copilot/providers")
def providers(_: User = AnyUser) -> dict[str, Any]:
    r = get_router()
    return {"order": [p.name for p in r.providers], "active": r.active_providers(),
            "models": {"anthropic": get_settings().anthropic_model, "openai": get_settings().openai_model, "gemini": get_settings().gemini_model}}


# ---------------------------------------------------------------- jobs
@router.get("/jobs", response_model=list[JobOut])
def list_jobs(case_id: str | None = None, status: str | None = None, limit: int = Query(50, le=200),
              db: Session = Depends(get_db), _: User = AnyUser) -> list[Job]:
    stmt = select(Job).order_by(Job.created_at.desc())
    if case_id:
        stmt = stmt.where(Job.case_id == case_id)
    if status:
        stmt = stmt.where(Job.status.in_(status.split(",")))
    return list(db.scalars(stmt.limit(limit)).all())


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise NotFoundError("Job not found")
    return job


# ---------------------------------------------------------------- audit
@router.get("/audit", response_model=list[AuditOut])
def audit_log(case_id: str | None = None, action: str | None = None, limit: int = Query(100, le=500),
              db: Session = Depends(get_db), _: User = Manager) -> list[AuditLog]:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if case_id:
        stmt = stmt.where(AuditLog.case_id == case_id)
    if action:
        stmt = stmt.where(AuditLog.action.like(f"{action}%"))
    return list(db.scalars(stmt.limit(limit)).all())


@router.get("/cases/{case_id}/audit", response_model=list[AuditOut])
def case_audit(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> list[AuditLog]:
    get_case_or_404(db, case_id)
    return list(db.scalars(select(AuditLog).where(AuditLog.case_id == case_id).order_by(AuditLog.created_at.desc()).limit(300)).all())


# ---------------------------------------------------------------- dashboard
@router.get("/dashboard/summary")
def dashboard(db: Session = Depends(get_db), _: User = AnyUser) -> dict[str, Any]:
    cases = db.scalars(select(CreditCase)).unique().all()
    by_status: dict[str, int] = {}
    by_risk: dict[str, int] = {}
    exposure_requested = 0.0
    for c in cases:
        by_status[c.status] = by_status.get(c.status, 0) + 1
        if c.latest_risk_level:
            by_risk[c.latest_risk_level] = by_risk.get(c.latest_risk_level, 0) + 1
        exposure_requested += c.requested_amount or 0
    scored = [c for c in cases if c.latest_score is not None]
    recent = sorted(cases, key=lambda c: c.updated_at, reverse=True)[:8]
    open_alerts = db.scalars(select(FraudAlert).where(FraudAlert.status == "open", FraudAlert.severity.in_(["HIGH", "CRITICAL"]))
                             .order_by(FraudAlert.created_at.desc()).limit(8)).all()
    since = datetime.now(UTC) - timedelta(days=30)
    tokens = db.execute(select(AiUsage.provider, func.sum(AiUsage.input_tokens), func.sum(AiUsage.output_tokens), func.count())
                        .where(AiUsage.created_at >= since).group_by(AiUsage.provider)).all()
    case_names = {c.id: (c.company.name, c.reference) for c in cases}
    sectors: dict[str, int] = {}
    for c in cases:
        key = c.company.sector or "unspecified"
        sectors[key] = sectors.get(key, 0) + 1
    return {
        "totals": {
            "cases": len(cases), "scored": len(scored),
            "avg_score": round(sum(c.latest_score for c in scored) / len(scored)) if scored else None,
            "requested_exposure": exposure_requested,
            "approved": sum(1 for c in cases if c.status == "approved"),
            "in_review": by_status.get("in_review", 0), "escalated": by_status.get("escalated", 0),
            "high_fraud": sum(1 for c in cases if (c.latest_fraud_score or 0) >= 50),
            "companies": db.scalar(select(func.count()).select_from(Company)),
        },
        "by_status": by_status,
        "by_risk": by_risk,
        "by_sector": sectors,
        "score_distribution": [{"reference": c.reference, "company": c.company.name, "score": c.latest_score,
                                "fraud": c.latest_fraud_score, "amount": c.requested_amount, "risk": c.latest_risk_level}
                               for c in scored],
        "recent_cases": [{"id": c.id, "reference": c.reference, "company": c.company.name, "status": c.status, "score": c.latest_score,
                          "risk": c.latest_risk_level, "amount": c.requested_amount, "updated_at": c.updated_at.isoformat()} for c in recent],
        "alerts": [{"id": a.id, "case_id": a.case_id, "company": case_names.get(a.case_id, ("", ""))[0], "title": a.title,
                    "severity": a.severity, "alert_type": a.alert_type} for a in open_alerts],
        "ai_usage": [{"provider": p, "input_tokens": int(i or 0), "output_tokens": int(o or 0), "calls": n} for p, i, o, n in tokens],
        "active_jobs": db.scalar(select(func.count()).select_from(Job).where(Job.status.in_(["queued", "running"]))),
    }


# ---------------------------------------------------------------- health
@public.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "credx-api"}


@public.get("/health/ready")
def ready(db: Session = Depends(get_db)) -> dict[str, Any]:
    db.execute(text("SELECT 1"))
    from extraction.ocr.engine import ocr_available

    s = get_settings()
    return {"status": "ready", "database": "ok", "job_backend": s.job_backend, "storage": s.storage_backend,
            "ocr": "tesseract" if ocr_available() else "unavailable", "ai_providers": get_router().active_providers(),
            "environment": s.environment}


@public.get("/metrics")
def metrics() -> Response:
    body, content_type = render_metrics()
    return Response(body, media_type=content_type)


