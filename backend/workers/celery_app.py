"""Celery application. Start a worker with:

    celery -A workers.celery_app worker --loglevel=INFO --concurrency=2 -Q ingestion,analysis,default
"""

from __future__ import annotations

from celery import Celery

from config import get_settings
from core.logging import configure_logging

settings = get_settings()
configure_logging(settings.log_level, settings.log_json)

broker = settings.redis_url or "redis://localhost:6379/0"
celery_app = Celery("credx", broker=broker, backend=broker, include=["workers.tasks"])
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_expires=3600,
    task_acks_late=True,  # a crashed worker re-delivers the job
    worker_prefetch_multiplier=1,  # OCR/ML jobs are long; don't hoard them
    task_default_queue="default",
    task_routes={"workers.tasks.run_job_task": {"queue": "default"}},
    broker_transport_options={"visibility_timeout": 3600},
    broker_connection_retry_on_startup=True,
)
