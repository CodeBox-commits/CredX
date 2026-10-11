"""Dispatch strategy, chosen by JOB_BACKEND:

  celery  -> Redis broker + `celery -A workers.celery_app worker` (production, horizontally scalable)
  thread  -> in-process ThreadPoolExecutor (single-container demo / free-tier hosting, zero infra)
  inline  -> run synchronously (tests)
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from config import get_settings
from core.logging import get_logger

log = get_logger("credx.dispatch")
_pool: ThreadPoolExecutor | None = None


def _get_pool() -> ThreadPoolExecutor:
    global _pool
    if _pool is None:
        _pool = ThreadPoolExecutor(max_workers=get_settings().job_workers, thread_name_prefix="credx-job")
    return _pool


def dispatch(job_id: str) -> None:
    backend = get_settings().job_backend
    if backend == "celery":
        from workers.tasks import run_job_task

        run_job_task.delay(job_id)
    elif backend == "inline":
        from workers.runner import run_job

        run_job(job_id)
    else:
        from workers.runner import run_job

        _get_pool().submit(run_job, job_id)


def shutdown() -> None:
    if _pool is not None:
        _pool.shutdown(wait=False, cancel_futures=True)
