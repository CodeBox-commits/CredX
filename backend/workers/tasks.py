"""Celery task wrappers. Business logic lives in services.pipeline; retries in workers.runner."""

from __future__ import annotations

from workers.celery_app import celery_app
from workers.runner import run_job


@celery_app.task(name="workers.tasks.run_job_task", ignore_result=True)
def run_job_task(job_id: str) -> None:
    run_job(job_id)
