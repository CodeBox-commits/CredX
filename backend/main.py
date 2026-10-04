"""CredX API entrypoint:  uvicorn main:app --reload --port 8000"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from api.router import api_router
from api.routes.platform import public
from config import get_settings
from core.errors import install_exception_handlers
from core.logging import configure_logging, get_logger
from database.session import init_db
from middleware.request_context import RequestContextMiddleware

settings = get_settings()
configure_logging(settings.log_level, settings.log_json)
log = get_logger("credx")


def _init_sentry() -> None:
    if not settings.sentry_dsn:
        return
    try:  # optional dependency
        import sentry_sdk

        sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment, traces_sample_rate=0.1)
        log.info("sentry enabled")
    except ImportError:
        log.warning("SENTRY_DSN set but sentry-sdk is not installed")


@asynccontextmanager
async def lifespan(_: FastAPI):
    _init_sentry()
    if settings.auto_create_tables:
        init_db()
    if settings.job_backend == "thread":
        _recover_orphaned_jobs()
    log.info("CredX API started", extra={"env": settings.environment, "jobs": settings.job_backend, "db": settings.database_url.split(":")[0]})
    yield
    from workers.dispatcher import shutdown

    shutdown()


def _recover_orphaned_jobs() -> None:
    """In thread mode a restart kills running jobs; mark them failed so the UI can retry."""
    from sqlalchemy import update

    from database.session import session_scope
    from models import Document, Job
    from models.enums import DocumentStatus, JobStatus

    with session_scope() as db:
        db.execute(update(Job).where(Job.status.in_([JobStatus.QUEUED, JobStatus.RUNNING]))
                   .values(status=JobStatus.FAILED, error="Interrupted by server restart", message="Interrupted"))
        db.execute(update(Document).where(Document.status == DocumentStatus.PROCESSING)
                   .values(status=DocumentStatus.FAILED, error="Interrupted by server restart"))


def create_app() -> FastAPI:
    app = FastAPI(
        title="CredX API",
        version="1.0.0",
        description="AI-powered corporate credit underwriting: ingestion, research, fraud graph, explainable scoring, CAM, copilot.",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    install_exception_handlers(app)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "Content-Disposition"],
    )
    app.include_router(public)
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
