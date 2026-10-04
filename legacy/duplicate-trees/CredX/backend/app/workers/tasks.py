from __future__ import annotations

from celery.utils.log import get_task_logger

from .celery_app import celery_app

logger = get_task_logger(__name__)


@celery_app.task(name="credx.ingestion.sync_case_analysis")
def sync_case_analysis_task(case_id: str) -> dict[str, str]:
    logger.info("sync_case_analysis_task received for case_id=%s", case_id)
    return {
        "case_id": case_id,
        "status": "accepted",
        "detail": "Celery worker scaffold is ready for asynchronous case analysis orchestration.",
    }


@celery_app.task(name="credx.ingestion.process_document")
def process_document_task(document_id: str) -> dict[str, str]:
    logger.info("process_document_task received for document_id=%s", document_id)
    return {
        "document_id": document_id,
        "status": "accepted",
        "detail": "Document-processing task scaffold is ready for OCR and extraction workloads.",
    }
