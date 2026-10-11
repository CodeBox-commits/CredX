"""Analyst workspace: notes & threaded comments, manual overrides (maker-checker), escalations."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import Analyst, AnyUser, Manager, get_case_or_404
from core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationFailed
from core.security import Role, role_at_least
from database.session import get_db
from models import AnalystNote, CreditScore, Escalation, ManualOverride, User
from models.enums import CaseStatus, EscalationStatus, OverrideStatus
from schemas.common import (
    EscalationIn,
    EscalationOut,
    NoteIn,
    NoteOut,
    NoteUpdate,
    OverrideIn,
    OverrideOut,
    ResolveIn,
    ReviewIn,
)
from scoring.decision_logic.overlays import infer_note_impact
from services import case_context as cc
from services.audit import audit

router = APIRouter(tags=["workflow"])


def _note_out(n: AnalystNote) -> NoteOut:
    out = NoteOut.model_validate(n)
    if n.kind == "note":
        out.preview_impact, _, out.preview_rationale = infer_note_impact(n.body)
    return out


@router.get("/cases/{case_id}/notes", response_model=list[NoteOut])
def list_notes(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> list[NoteOut]:
    get_case_or_404(db, case_id)
    notes = db.scalars(select(AnalystNote).where(AnalystNote.case_id == case_id).order_by(AnalystNote.created_at)).all()
    return [_note_out(n) for n in notes]


@router.post("/notes/preview-impact")
def preview_impact(body: NoteIn, _: User = AnyUser) -> dict:
    """Live 'what will this note do to the score' as the analyst types."""
    points, five_c, rationale = infer_note_impact(body.body)
    return {"points": body.impact_points if body.impact_points is not None else points, "inferred_points": points,
            "five_c": body.five_c or five_c, "rationale": rationale}


@router.post("/cases/{case_id}/notes", response_model=NoteOut, status_code=201)
def create_note(case_id: str, body: NoteIn, db: Session = Depends(get_db), user: User = Analyst) -> NoteOut:
    case = get_case_or_404(db, case_id)
    if body.parent_id:
        parent = db.get(AnalystNote, body.parent_id)
        if parent is None or parent.case_id != case.id:
            raise ValidationFailed("Parent note not found on this case")
    note = AnalystNote(case_id=case.id, author_id=user.id, **body.model_dump())
    if note.kind == "comment":
        note.include_in_cam = False
    db.add(note)
    db.flush()
    pts = body.impact_points if body.impact_points is not None else infer_note_impact(body.body)[0]
    audit(db, user, f"note.{body.kind}", "note", note.id, case.id, summary=body.body[:200],
          details={"category": body.category, "impact": pts, "explicit": body.impact_points is not None})
    db.refresh(note)
    return _note_out(note)


def _own_note(db: Session, note_id: str, user: User) -> AnalystNote:
    note = db.get(AnalystNote, note_id)
    if note is None:
        raise NotFoundError("Note not found")
    if note.author_id != user.id and not role_at_least(user.role, Role.CREDIT_MANAGER):
        raise ForbiddenError("Only the author or a credit manager can change this note")
    return note


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: str, body: NoteUpdate, db: Session = Depends(get_db), user: User = Analyst) -> NoteOut:
    note = _own_note(db, note_id, user)
    changes = body.model_dump(exclude_none=True, exclude={"clear_impact"})
    for k, v in changes.items():
        setattr(note, k, v)
    if body.clear_impact:
        note.impact_points = None
    audit(db, user, "note.update", "note", note.id, note.case_id, summary="Edited note", details=changes)
    return _note_out(note)


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: str, db: Session = Depends(get_db), user: User = Analyst) -> None:
    note = _own_note(db, note_id, user)
    audit(db, user, "note.delete", "note", note.id, note.case_id, summary=f"Deleted note: {note.body[:160]}")
    db.delete(note)


# ---------------------------------------------------------------- overrides
@router.get("/cases/{case_id}/overrides", response_model=list[OverrideOut])
def list_overrides(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> list[ManualOverride]:
    get_case_or_404(db, case_id)
    return list(db.scalars(select(ManualOverride).where(ManualOverride.case_id == case_id).order_by(ManualOverride.created_at.desc())).all())


@router.post("/cases/{case_id}/overrides", response_model=OverrideOut, status_code=201)
def request_override(case_id: str, body: OverrideIn, db: Session = Depends(get_db), user: User = Analyst) -> ManualOverride:
    case = get_case_or_404(db, case_id)
    score = cc.latest(db, CreditScore, case.id)
    if score is None:
        raise ConflictError("Score the case before requesting an override")
    if body.field == "decision" and body.new_value not in ("APPROVE", "APPROVE_WITH_CONDITIONS", "REFER", "DECLINE"):
        raise ValidationFailed("Decision override must be APPROVE, APPROVE_WITH_CONDITIONS, REFER or DECLINE")
    if body.field != "decision":
        try:
            float(body.new_value)
        except ValueError as exc:
            raise ValidationFailed("Override value must be numeric") from exc
    ov = ManualOverride(case_id=case.id, field=body.field, original_value=str(getattr(score, body.field)), new_value=body.new_value,
                        reason=body.reason, requested_by_id=user.id)
    db.add(ov)
    db.flush()
    audit(db, user, "override.request", "override", ov.id, case.id, summary=f"Requested {body.field} override → {body.new_value}",
          details={"from": ov.original_value, "reason": body.reason})
    db.refresh(ov)
    return ov


@router.post("/overrides/{override_id}/review", response_model=OverrideOut)
def review_override(override_id: str, body: ReviewIn, db: Session = Depends(get_db), user: User = Manager) -> ManualOverride:
    ov = db.get(ManualOverride, override_id)
    if ov is None:
        raise NotFoundError("Override not found")
    if ov.status != OverrideStatus.PENDING:
        raise ConflictError("Override already reviewed")
    if ov.requested_by_id == user.id:
        raise ForbiddenError("Maker-checker: you cannot approve your own override")
    ov.status = OverrideStatus.APPROVED if body.approve else OverrideStatus.REJECTED
    ov.reviewed_by_id = user.id
    ov.reviewed_at = datetime.now(UTC)
    ov.review_comment = body.comment
    if body.approve and ov.field == "decision":
        case = get_case_or_404(db, ov.case_id)
        case.final_decision = ov.new_value
        case.decision_rationale = f"Override approved by {user.full_name}: {ov.reason}"
        case.decided_by_id, case.decided_at = user.id, ov.reviewed_at
        case.status = {"DECLINE": CaseStatus.REJECTED, "REFER": CaseStatus.ESCALATED}.get(ov.new_value, CaseStatus.APPROVED)
    audit(db, user, "override.review", "override", ov.id, ov.case_id,
          summary=f"{'Approved' if body.approve else 'Rejected'} {ov.field} override", details={"comment": body.comment})
    return ov


# ---------------------------------------------------------------- escalations
@router.get("/cases/{case_id}/escalations", response_model=list[EscalationOut])
def list_escalations(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> list[Escalation]:
    get_case_or_404(db, case_id)
    return list(db.scalars(select(Escalation).where(Escalation.case_id == case_id).order_by(Escalation.created_at.desc())).all())


@router.post("/cases/{case_id}/escalations", response_model=EscalationOut, status_code=201)
def escalate(case_id: str, body: EscalationIn, db: Session = Depends(get_db), user: User = Analyst) -> Escalation:
    case = get_case_or_404(db, case_id)
    esc = Escalation(case_id=case.id, raised_by_id=user.id, to_role=body.to_role, reason=body.reason)
    db.add(esc)
    case.status = CaseStatus.ESCALATED
    db.flush()
    audit(db, user, "case.escalate", "escalation", esc.id, case.id, summary=f"Escalated to {body.to_role.replace('_', ' ')}",
          details={"reason": body.reason})
    db.refresh(esc)
    return esc


@router.post("/escalations/{escalation_id}/resolve", response_model=EscalationOut)
def resolve(escalation_id: str, body: ResolveIn, db: Session = Depends(get_db), user: User = Manager) -> Escalation:
    esc = db.get(Escalation, escalation_id)
    if esc is None:
        raise NotFoundError("Escalation not found")
    if esc.status != EscalationStatus.OPEN:
        raise ConflictError("Escalation already resolved")
    esc.status, esc.resolution, esc.resolved_by_id, esc.resolved_at = EscalationStatus.RESOLVED, body.resolution, user.id, datetime.now(UTC)
    case = get_case_or_404(db, esc.case_id)
    still_open = db.scalars(select(Escalation).where(Escalation.case_id == case.id, Escalation.status == EscalationStatus.OPEN,
                                                     Escalation.id != esc.id)).first()
    if not still_open and case.status == CaseStatus.ESCALATED:
        case.status = CaseStatus.IN_REVIEW
    audit(db, user, "escalation.resolve", "escalation", esc.id, case.id, summary="Resolved escalation", details={"resolution": body.resolution})
    return esc
