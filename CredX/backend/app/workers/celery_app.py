from __future__ import annotations

from celery import Celery

from ..core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "credx",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
)

celery_app.autodiscover_tasks(["app.workers"])
