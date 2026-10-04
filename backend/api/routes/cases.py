"""Companies, credit cases, final decisions and the case activity timeline."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from api.deps import Analyst, AnyUser, Manager, get_case_or_404
from core.errors import ConflictError, NotFoundError, ValidationFailed
from database.session import get_db
from models import AnalystNote, AuditLog, Company, CreditCase, Job, User
from models.enums import CaseStatus, JobKind
from research.sector_analysis.knowledge_base import list_sectors
from schemas.common import CaseCreate, CaseOut, CaseUpdate, CompanyIn, CompanyOut, DecisionIn, JobOut, Page
from services import case_context as cc
from services.audit import audit
from services.jobs import enqueue

router = APIRouter(tags=["cases"])


def next_reference(db: Session) -> str:
    year = datetime.now(UTC).year
    count = db.scalar(select(func.count()).select_from(CreditCase).where(CreditCase.reference.like(f"CX-{year}-%"))) or 0
    return f"CX-{year}-{count + 1:04d}"


@router.get("/companies", response_model=list[CompanyOut])
def list_companies(q: str | None = None, db: Session = Depends(get_db), _: User = AnyUser) -> list[Company]:
    stmt = select(Company).order_by(Company.name)
    if q:
        stmt = stmt.where(or_(Company.name.ilike(f"%{q}%"), Company.gstin.ilike(f"%{q}%"), Company.cin.ilike(f"%{q}%")))
    return list(db.scalars(stmt.limit(100)).all())


@router.post("/companies", response_model=CompanyOut, status_code=201)
def create_company(body: CompanyIn, db: Session = Depends(get_db), user: User = Analyst) -> Company:
    if body.cin and db.scalars(select(Company).where(Company.cin == body.cin)).first():
        raise ConflictError("A company with this CIN already exists")
    company = Company(**body.model_dump(exclude={"promoters"}), promoters=[p.model_dump() for p in body.promoters], created_by_id=user.id)
    db.add(company)
    db.flush()
    audit(db, user, "company.create", "company", company.id, summary=f"Created company {company.name}")
    return company


@router.patch("/companies/{company_id}", response_model=CompanyOut)
def update_company(company_id: str, body: CompanyIn, db: Session = Depends(get_db), user: User = Analyst) -> Company:
    company = db.get(Company, company_id)
    if company is None:
        raise NotFoundError("Company not found")
    data = body.model_dump(exclude={"promoters"})
    for k, v in data.items():
        setattr(company, k, v)
    company.promoters = [p.model_dump() for p in body.promoters]
    audit(db, user, "company.update", "company", company.id, summary=f"Updated company {company.name}")
    return company


@router.get("/cases", response_model=Page)
def list_cases(
    q: str | None = None,
    status: str | None = None,
    risk: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = AnyUser,
) -> Page:
    stmt = select(CreditCase).join(Company)
    if q:
        stmt = stmt.where(or_(Company.name.ilike(f"%{q}%"), CreditCase.reference.ilike(f"%{q}%"), Company.gstin.ilike(f"%{q}%")))
    if status:
        stmt = stmt.where(CreditCase.status.in_(status.split(",")))
    if risk:
        stmt = stmt.where(CreditCase.latest_risk_level.in_(risk.upper().split(",")))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(CreditCase.updated_at.desc()).limit(limit).offset(offset)).unique().all()
    return Page(items=[CaseOut.model_validate(r) for r in rows], total=total, limit=limit, offset=offset)


@router.post("/cases", response_model=CaseOut, status_code=201)
def create_case(body: CaseCreate, db: Session = Depends(get_db), user: User = Analyst) -> CreditCase:
    if body.company_id:
        company = db.get(Company, body.company_id)
        if company is None:
            raise NotFoundError("Company not found")
    elif body.company:
        company = Company(**body.company.model_dump(exclude={"promoters"}),
                          promoters=[p.model_dump() for p in body.company.promoters], created_by_id=user.id)
        db.add(company)
        db.flush()
    else:
        raise ValidationFailed("Provide company_id or a new company")
    case = CreditCase(reference=next_reference(db), company_id=company.id, facility_type=body.facility_type,
                      requested_amount=body.requested_amount, tenure_months=body.tenure_months, purpose=body.purpose,
                      collateral_type=body.collateral_type, collateral_value=body.collateral_value, priority=body.priority,
                      created_by_id=user.id, assigned_to_id=user.id, network={})
    db.add(case)
    db.flush()
    audit(db, user, "case.create", "case", case.id, case.id, summary=f"Opened {case.reference} for {company.name}",
          details={"requested_amount": body.requested_amount, "facility": body.facility_type})
    db.refresh(case)
    return case


@router.get("/cases/{case_id}", response_model=CaseOut)
def get_case(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> CreditCase:
    return get_case_or_404(db, case_id)


@router.patch("/cases/{case_id}", response_model=CaseOut)
def update_case(case_id: str, body: CaseUpdate, db: Session = Depends(get_db), user: User = Analyst) -> CreditCase:
    case = get_case_or_404(db, case_id)
    changes = body.model_dump(exclude_none=True)
    for k, v in changes.items():
        setattr(case, k, v)
    audit(db, user, "case.update", "case", case.id, case.id, summary="Updated application details", details=changes)
    return case


@router.get("/cases/{case_id}/overview")
def case_overview(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> dict[str, Any]:
    """Single round-trip payload for the case workspace header and overview tab."""
    case = get_case_or_404(db, case_id)
    ctx = cc.full_context(db, case)
    active = db.scalars(select(Job).where(Job.case_id == case.id, Job.status.in_(["queued", "running"]))
                        .order_by(Job.created_at.desc())).all()
    return {**ctx, "case_record": CaseOut.model_validate(case).model_dump(mode="json"),
            "active_jobs": [JobOut.model_validate(j).model_dump(mode="json") for j in active],
            "financials": cc.financials_by_year(db, case.id)}


def _start(db: Session, case: CreditCase, user: User, kind: JobKind, params: dict | None = None) -> Job:
    running = db.scalars(select(Job).where(Job.case_id == case.id, Job.kind == kind, Job.status.in_(["queued", "running"]))).first()
    if running:
        return running
    audit(db, user, f"job.{kind.value}", "case", case.id, case.id, summary=f"Started {kind.value.replace('_', ' ')}")
    db.commit()
    return enqueue(db, kind, case_id=case.id, params=params, created_by_id=user.id)


@router.post("/cases/{case_id}/analyze", response_model=JobOut, status_code=202)
def analyze_case(case_id: str, db: Session = Depends(get_db), user: User = Analyst) -> Job:
    return _start(db, get_case_or_404(db, case_id), user, JobKind.FULL_ANALYSIS)


@router.post("/cases/{case_id}/score", response_model=JobOut, status_code=202)
def rescore_case(case_id: str, db: Session = Depends(get_db), user: User = Analyst) -> Job:
    return _start(db, get_case_or_404(db, case_id), user, JobKind.SCORE)


@router.post("/cases/{case_id}/research", response_model=JobOut, status_code=202)
def research_case(case_id: str, db: Session = Depends(get_db), user: User = Analyst) -> Job:
    return _start(db, get_case_or_404(db, case_id), user, JobKind.RESEARCH)


@router.post("/cases/{case_id}/fraud", response_model=JobOut, status_code=202)
def fraud_case(case_id: str, db: Session = Depends(get_db), user: User = Analyst) -> Job:
    return _start(db, get_case_or_404(db, case_id), user, JobKind.FRAUD)


@router.post("/cases/{case_id}/decision", response_model=CaseOut)
def record_decision(case_id: str, body: DecisionIn, db: Session = Depends(get_db), user: User = Manager) -> CreditCase:
    case = get_case_or_404(db, case_id)
    case.final_decision = body.decision
    case.decision_rationale = body.rationale
    case.decided_by_id = user.id
    case.decided_at = datetime.now(UTC)
    case.status = {"APPROVE": CaseStatus.APPROVED, "APPROVE_WITH_CONDITIONS": CaseStatus.APPROVED,
                   "DECLINE": CaseStatus.REJECTED, "REFER": CaseStatus.ESCALATED}[body.decision]
    audit(db, user, "case.decision", "case", case.id, case.id, summary=f"Final decision: {body.decision.replace('_', ' ').title()}",
          details={"rationale": body.rationale, "model_score": case.latest_score})
    return case


@router.get("/cases/{case_id}/timeline")
def case_timeline(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> list[dict[str, Any]]:
    get_case_or_404(db, case_id)
    events: list[dict[str, Any]] = []
    for a in db.scalars(select(AuditLog).where(AuditLog.case_id == case_id).order_by(AuditLog.created_at.desc()).limit(200)):
        events.append({"type": "audit", "at": a.created_at.isoformat(), "actor": a.actor_email, "action": a.action, "summary": a.summary})
    for n in db.scalars(select(AnalystNote).where(AnalystNote.case_id == case_id)):
        events.append({"type": "note", "at": n.created_at.isoformat(), "actor": n.author.email if n.author else None,
                       "action": f"note.{n.kind}", "summary": n.body[:160]})
    for j in db.scalars(select(Job).where(Job.case_id == case_id, Job.finished_at.is_not(None))):
        events.append({"type": "job", "at": j.finished_at.isoformat(), "actor": "system", "action": f"job.{j.kind}.{j.status}",
                       "summary": f"{j.kind.replace('_', ' ').title()} {j.status}" + (f" in {j.duration_ms / 1000:.1f}s" if j.duration_ms else "")})
    return sorted(events, key=lambda e: e["at"], reverse=True)[:300]


@router.get("/meta/sectors")
def sectors(_: User = AnyUser) -> list[dict[str, str]]:
    return list_sectors()
