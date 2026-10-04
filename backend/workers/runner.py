"""Executes a job by id: status transitions, throttled progress, retries, timing and metrics."""

from __future__ import annotations

import time
import traceback
from datetime import UTC, datetime

import httpx
from sqlalchemy.exc import OperationalError

from core.logging import get_logger, job_id_var
from core.metrics import JOB_LATENCY, JOBS
from database.session import SessionLocal
from models import Job
from models.enums import JobStatus

log = get_logger("credx.worker")
TRANSIENT = (ConnectionError, TimeoutError, httpx.TransportError, OperationalError)
MAX_ATTEMPTS = 3


def run_job(job_id: str) -> None:
    from services.pipeline import HANDLERS

    token = job_id_var.set(job_id)
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if job is None:
            log.error("job not found")
            return
        if job.status in (JobStatus.SUCCEEDED, JobStatus.RUNNING):
            return
        handler = HANDLERS[job.kind]
        started = time.perf_counter()
        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(UTC)
        job.progress = max(job.progress, 1)
        job.message = "Starting"
        db.commit()
        last = {"pct": -10, "stage": None, "t": 0.0}

        def progress(pct: int, stage: str, message: str) -> None:
            pct = max(0, min(99, int(pct)))
            now = time.perf_counter()
            if pct - last["pct"] < 4 and stage == last["stage"] and now - last["t"] < 1.5:
                return
            last.update(pct=pct, stage=stage, t=now)
            job.progress, job.stage, job.message = pct, stage, message[:500]
            db.commit()

        while True:
            job.attempts += 1
            try:
                result = handler(db, job, progress)
                break
            except TRANSIENT as exc:
                db.rollback()
                if job.attempts >= MAX_ATTEMPTS:
                    raise
                delay = 2 ** job.attempts
                log.warning("transient job failure, retrying", extra={"attempt": job.attempts, "delay_s": delay, "error": str(exc)[:200]})
                job.message = f"Retrying after transient error (attempt {job.attempts + 1}/{MAX_ATTEMPTS})"
                db.commit()
                time.sleep(delay)

        job.status = JobStatus.SUCCEEDED
        job.progress = 100
        job.stage = "complete"
        job.message = "Completed"
        job.result = result
        job.finished_at = datetime.now(UTC)
        job.duration_ms = int((time.perf_counter() - started) * 1000)
        db.commit()
        JOBS.labels(job.kind, "succeeded").inc()
        JOB_LATENCY.labels(job.kind).observe(time.perf_counter() - started)
        log.info("job succeeded", extra={"kind": job.kind, "ms": job.duration_ms})
    except Exception as exc:
        db.rollback()
        job = db.get(Job, job_id)
        if job is not None:
            job.status = JobStatus.FAILED
            job.error = f"{type(exc).__name__}: {exc}"[:2000]
            job.message = "Failed"
            job.finished_at = datetime.now(UTC)
            db.commit()
            JOBS.labels(job.kind, "failed").inc()
        log.error("job failed", extra={"error": str(exc)[:300], "trace": traceback.format_exc()[-1500:]})
    finally:
        db.close()
        job_id_var.reset(token)
