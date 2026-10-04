"""Centralised, environment-driven configuration.

Every tunable lives here so modules never read ``os.environ`` directly. Values are
loaded from process env first, then from ``.env`` files (repo root and ``backend/``).
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent


def _load_dotenv() -> None:
    """Minimal .env loader (python-dotenv is used when available)."""
    candidates = [REPO_DIR / ".env", BACKEND_DIR / ".env"]
    try:
        from dotenv import load_dotenv

        for path in candidates:
            if path.exists():
                load_dotenv(path, override=False)
        return
    except ImportError:  # pragma: no cover - fallback path
        pass
    for path in candidates:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


def _env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(key: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(key, default).split(",") if item.strip()]


class Settings(BaseModel):
    # --- Application ---
    app_name: str = "CredX"
    app_version: str = "2.0.0"
    environment: Literal["development", "test", "staging", "production"] = Field(
        default_factory=lambda: _env("CREDX_ENV", "development")  # type: ignore[arg-type]
    )
    api_prefix: str = "/api/v1"
    log_level: str = Field(default_factory=lambda: _env("CREDX_LOG_LEVEL", "INFO"))
    log_json: bool = Field(default_factory=lambda: _env_bool("CREDX_LOG_JSON", False))
    allowed_origins: list[str] = Field(
        default_factory=lambda: _env_list(
            "CREDX_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        )
    )

    # --- Persistence ---
    database_url: str = Field(
        default_factory=lambda: _env(
            "DATABASE_URL", f"sqlite:///{(BACKEND_DIR / 'storage' / 'credx.db').as_posix()}"
        )
    )
    auto_create_schema: bool = Field(
        default_factory=lambda: _env_bool("CREDX_AUTO_CREATE_SCHEMA", True)
    )
    seed_demo_on_startup: bool = Field(
        default_factory=lambda: _env_bool("CREDX_SEED_DEMO", False)
    )

    # --- Async jobs ---
    redis_url: str = Field(default_factory=lambda: _env("REDIS_URL", ""))
    task_mode: Literal["inline", "thread", "celery"] = Field(
        default_factory=lambda: _env("CREDX_TASK_MODE", "thread")  # type: ignore[arg-type]
    )
    celery_broker_url: str = Field(
        default_factory=lambda: _env("CELERY_BROKER_URL", _env("REDIS_URL", "redis://localhost:6379/0"))
    )
    celery_result_backend: str = Field(
        default_factory=lambda: _env("CELERY_RESULT_BACKEND", _env("REDIS_URL", "redis://localhost:6379/1"))
    )

    # --- Security ---
    jwt_secret: str = Field(default_factory=lambda: _env("JWT_SECRET", "dev-only-change-me-credx-secret"))
    jwt_algorithm: str = Field(default_factory=lambda: _env("JWT_ALGORITHM", "HS256"))
    access_token_minutes: int = Field(default_factory=lambda: int(_env("JWT_ACCESS_MINUTES", "720")))
    rate_limit_per_minute: int = Field(default_factory=lambda: int(_env("CREDX_RATE_LIMIT_PER_MINUTE", "240")))
    allow_registration: bool = Field(default_factory=lambda: _env_bool("CREDX_ALLOW_REGISTRATION", True))

    # --- Storage ---
    storage_backend: Literal["local", "s3"] = Field(
        default_factory=lambda: _env("CREDX_STORAGE_BACKEND", "local")  # type: ignore[arg-type]
    )
    storage_dir: Path = Field(
        default_factory=lambda: Path(_env("CREDX_STORAGE_DIR", str(BACKEND_DIR / "storage")))
    )
    s3_bucket: str = Field(default_factory=lambda: _env("S3_BUCKET"))
    s3_region: str = Field(default_factory=lambda: _env("AWS_REGION", "ap-south-1"))
    max_upload_mb: int = Field(default_factory=lambda: int(_env("CREDX_MAX_UPLOAD_MB", "25")))
    allowed_upload_extensions: list[str] = Field(
        default_factory=lambda: _env_list(
            "CREDX_ALLOWED_EXTENSIONS", ".pdf,.png,.jpg,.jpeg,.tif,.tiff,.txt,.csv,.json"
        )
    )

    # --- Document AI ---
    ocr_engine: Literal["tesseract", "paddle", "none"] = Field(
        default_factory=lambda: _env("CREDX_OCR_ENGINE", "tesseract")  # type: ignore[arg-type]
    )
    ocr_min_chars_per_page: int = Field(default_factory=lambda: int(_env("CREDX_OCR_MIN_CHARS", "60")))
    enable_camelot: bool = Field(default_factory=lambda: _env_bool("CREDX_ENABLE_CAMELOT", True))

    # --- Research ---
    newsapi_key: str = Field(default_factory=lambda: _env("NEWSAPI_API_KEY"))
    serpapi_key: str = Field(default_factory=lambda: _env("SERPAPI_API_KEY"))
    enable_live_research: bool = Field(default_factory=lambda: _env_bool("CREDX_LIVE_RESEARCH", False))
    research_cache_ttl_seconds: int = Field(default_factory=lambda: int(_env("CREDX_RESEARCH_TTL", "21600")))

    # --- AI providers ---
    llm_provider_order: list[str] = Field(
        default_factory=lambda: _env_list("CREDX_LLM_PROVIDERS", "anthropic,openai,gemini,local")
    )
    anthropic_api_key: str = Field(default_factory=lambda: _env("ANTHROPIC_API_KEY"))
    anthropic_model: str = Field(default_factory=lambda: _env("ANTHROPIC_MODEL", "claude-opus-5-5"))
    openai_api_key: str = Field(default_factory=lambda: _env("OPENAI_API_KEY"))
    openai_model: str = Field(default_factory=lambda: _env("OPENAI_MODEL", "gpt-4o-mini"))
    gemini_api_key: str = Field(default_factory=lambda: _env("GOOGLE_API_KEY"))
    gemini_model: str = Field(default_factory=lambda: _env("GEMINI_MODEL", "gemini-1.5-flash"))
    llm_timeout_seconds: float = Field(default_factory=lambda: float(_env("CREDX_LLM_TIMEOUT", "120")))
    # Thinking tokens count toward max_tokens on current Claude models — don't lowball it.
    llm_max_tokens: int = Field(default_factory=lambda: int(_env("CREDX_LLM_MAX_TOKENS", "16000")))
    anthropic_effort: str = Field(default_factory=lambda: _env("ANTHROPIC_EFFORT", "medium"))

    # --- Credit policy ---
    base_lending_rate: float = Field(default_factory=lambda: float(_env("CREDX_BASE_RATE", "9.25")))
    model_dir: Path = Field(
        default_factory=lambda: Path(_env("CREDX_MODEL_DIR", str(BACKEND_DIR / "scoring" / "models" / "artifacts")))
    )

    # --- Observability ---
    sentry_dsn: str = Field(default_factory=lambda: _env("SENTRY_DSN"))
    enable_metrics: bool = Field(default_factory=lambda: _env_bool("CREDX_ENABLE_METRICS", True))

    @field_validator("database_url")
    @classmethod
    def _normalise_db_url(cls, value: str) -> str:
        # Supabase / Railway / Render hand out ``postgres://`` URLs; SQLAlchemy needs a driver.
        if value.startswith("postgres://"):
            value = "postgresql://" + value[len("postgres://") :]
        if value.startswith("postgresql://"):
            value = "postgresql+psycopg://" + value[len("postgresql://") :]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def uploads_dir(self) -> Path:
        return self.storage_dir / "uploads"

    @property
    def reports_dir(self) -> Path:
        return self.storage_dir / "reports"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    def ensure_dirs(self) -> None:
        for path in (self.storage_dir, self.uploads_dir, self.reports_dir, self.model_dir):
            path.mkdir(parents=True, exist_ok=True)

    def validate_for_production(self) -> list[str]:
        problems: list[str] = []
        if self.jwt_secret.startswith("dev-only") or len(self.jwt_secret) < 32:
            problems.append("JWT_SECRET must be a strong secret (>= 32 chars) in production")
        if self.is_sqlite:
            problems.append("DATABASE_URL should point to PostgreSQL in production")
        if "*" in self.allowed_origins:
            problems.append("CREDX_ALLOWED_ORIGINS must not contain '*' in production")
        return problems


@lru_cache
def get_settings() -> Settings:
    _load_dotenv()
    settings = Settings()
    settings.ensure_dirs()
    return settings
