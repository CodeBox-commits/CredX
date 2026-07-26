from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseModel):
    app_name: str = "CredX Backend"
    api_prefix: str = "/api/v1"
    environment: str = Field(default_factory=lambda: os.getenv("CREDX_ENV", "development"))
    database_url: str = Field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL",
            f"sqlite:///{(BASE_DIR / 'storage' / 'credx.db').as_posix()}",
        )
    )
    redis_url: str = Field(
        default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379/0")
    )
    celery_broker_url: str = Field(
        default_factory=lambda: os.getenv(
            "CELERY_BROKER_URL",
            os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        )
    )
    celery_result_backend: str = Field(
        default_factory=lambda: os.getenv(
            "CELERY_RESULT_BACKEND",
            "redis://localhost:6379/1",
        )
    )
    auto_init_database: bool = Field(
        default_factory=lambda: os.getenv("CREDX_AUTO_INIT_DATABASE", "true").lower()
        == "true"
    )
    allowed_origins: list[str] = Field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv(
                "CREDX_ALLOWED_ORIGINS",
                "http://localhost:8080,http://127.0.0.1:8080,http://localhost:3000",
            ).split(",")
            if origin.strip()
        ]
    )
    storage_dir: Path = Field(
        default_factory=lambda: Path(
            os.getenv("CREDX_STORAGE_DIR", BASE_DIR / "storage" / "uploads")
        )
    )
    parsed_dir: Path = Field(
        default_factory=lambda: Path(
            os.getenv("CREDX_PARSED_DIR", BASE_DIR / "storage" / "parsed")
        )
    )
    reports_dir: Path = Field(
        default_factory=lambda: Path(
            os.getenv("CREDX_REPORTS_DIR", BASE_DIR / "storage" / "reports")
        )
    )
    max_upload_mb: int = Field(
        default_factory=lambda: int(os.getenv("CREDX_MAX_UPLOAD_MB", "25"))
    )
    default_currency: str = "INR"
    enable_legacy_llamaparse: bool = Field(
        default_factory=lambda: os.getenv("CREDX_ENABLE_LEGACY_LLAMAPARSE", "false").lower()
        == "true"
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    settings.parsed_dir.mkdir(parents=True, exist_ok=True)
    settings.reports_dir.mkdir(parents=True, exist_ok=True)
    return settings
