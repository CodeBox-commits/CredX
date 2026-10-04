"""Job creation and dispatch (thin facade over workers.dispatcher)."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from config import get_settings
from models import Job
from models.enums import JobKind


def enqueue(
    db: Session,
    kind: JobKind,
    case_id: str | None = None,
    document_id: str | None = None,
    params: dict[str, Any] | None = None,
    created_by_id: str | None = None,
) -> Job:
    job = Job(kind=kind, case_id=case_id, document_id=document_id, params=params or {}, created_by_id=created_by_id,
              backend=get_settings().job_backend, message="Queued", stage="queued")
    db.add(job)
    db.commit()  # the worker reads the job in its own session
    from workers.dispatcher import dispatch

    dispatch(job.id)
    return job
