from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..api.router import api_router
from ..database.init_db import initialize_database
from .config import get_settings
from .errors import register_exception_handlers
from .logging import configure_logging

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if settings.auto_init_database:
            initialize_database()
        yield

    app = FastAPI(
        title=settings.app_name,
        description="AI-native corporate credit underwriting APIs for CredX.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "credx-backend"}

    return app
