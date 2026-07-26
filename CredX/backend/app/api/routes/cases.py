from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm import Session

from ...database.session import get_db_session
from ...schemas.cases import (
    AnalystNoteCreateRequest,
    AnalystNoteResponse,
    CaseDashboardSummaryResponse,
    CaseDetailResponse,
    CaseSummaryResponse,
    CaseSyncRequest,
    CaseSyncResponse,
)
from ...services.case_store import (
    add_case_note,
    archive_case,
    get_case,
    get_dashboard_summary,
    list_cases,
    rerun_case_analysis,
    sync_case,
    transition_case_status,
)

router = APIRouter()


@router.get("", response_model=list[CaseSummaryResponse])
def list_underwriting_cases(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db_session),
) -> list[CaseSummaryResponse]:
    return list_cases(db, limit=limit)


@router.get("/dashboard-summary", response_model=CaseDashboardSummaryResponse)
def dashboard_summary(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db_session),
) -> CaseDashboardSummaryResponse:
    return get_dashboard_summary(db, limit=limit)


@router.post("/sync", response_model=CaseSyncResponse)
def sync_underwriting_case(
    request: CaseSyncRequest,
    db: Session = Depends(get_db_session),
) -> CaseSyncResponse:
    return sync_case(db, request)


@router.get("/{case_id}", response_model=CaseDetailResponse)
def get_underwriting_case(
    case_id: str,
    db: Session = Depends(get_db_session),
) -> CaseDetailResponse:
    try:
        return get_case(db, case_id)
    except NoResultFound as exc:
        raise HTTPException(status_code=404, detail="Case not found.") from exc


@router.post("/{case_id}/notes", response_model=AnalystNoteResponse)
def create_case_note(
    case_id: str,
    payload: AnalystNoteCreateRequest,
    db: Session = Depends(get_db_session),
) -> AnalystNoteResponse:
    try:
        return add_case_note(db, case_id, payload)
    except NoResultFound as exc:
        raise HTTPException(status_code=404, detail="Case not found.") from exc


@router.post("/{case_id}/rerun", response_model=CaseDetailResponse)
def rerun_case(
    case_id: str,
    db: Session = Depends(get_db_session),
) -> CaseDetailResponse:
    try:
        return rerun_case_analysis(db, case_id)
    except NoResultFound as exc:
        raise HTTPException(status_code=404, detail="Case not found.") from exc


@router.post("/{case_id}/status", response_model=CaseDetailResponse)
def update_case_status(
    case_id: str,
    status: str,
    db: Session = Depends(get_db_session),
) -> CaseDetailResponse:
    try:
        return transition_case_status(db, case_id, status)
    except NoResultFound as exc:
        raise HTTPException(status_code=404, detail="Case not found.") from exc


@router.post("/{case_id}/archive", response_model=CaseDetailResponse)
def archive_case_route(
    case_id: str,
    db: Session = Depends(get_db_session),
) -> CaseDetailResponse:
    try:
        return archive_case(db, case_id)
    except NoResultFound as exc:
        raise HTTPException(status_code=404, detail="Case not found.") from exc
