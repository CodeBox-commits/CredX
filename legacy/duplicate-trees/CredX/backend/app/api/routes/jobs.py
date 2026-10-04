from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm import Session

from ...database.session import get_db_session
from ...schemas.cases import WorkflowJobResponse
from ...services.case_store import get_job, list_jobs

router = APIRouter()


@router.get("", response_model=list[WorkflowJobResponse])
def list_workflow_jobs(
    case_id: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db_session),
) -> list[WorkflowJobResponse]:
    return list_jobs(db, case_id=case_id, limit=limit)


@router.get("/{job_id}", response_model=WorkflowJobResponse)
def get_workflow_job(
    job_id: str,
    db: Session = Depends(get_db_session),
) -> WorkflowJobResponse:
    try:
        return get_job(db, job_id)
    except NoResultFound as exc:
        raise HTTPException(status_code=404, detail="Workflow job not found.") from exc
