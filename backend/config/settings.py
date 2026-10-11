"""Centralised, environment-driven configuration.

Modules never read ``os.environ`` directly. Values come from the process environment first,
then from ``.env`` files (repo root and ``backend/``). See ``backend/.env.example``.
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
    for path in (BACKEND_DIR / ".env", REPO_DIR / ".env"):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            value = value.strip()
            if value[:1] in ('"', "'"):
                value = value[1:].split(value[0], 1)[0]
            else:
                value = value.split(" #", 1)[0].strip()  # inline comment
            os.environ.setdefault(key.strip(), value)


def _env(*keys: str, default: str = "") -> str:
    for key in keys:
        value = os.getenv(key)
        if value not in (None, ""):
            return value
    return default


def _bool(*keys: str, default: bool) -> bool:
    raw = _env(*keys)
    return default if raw == "" else raw.strip().lower() in {"1", "true", "yes", "on"}


def _list(*keys: str, default: str) -> list[str]:
    return [item.strip() for item in _env(*keys, default=default).split(",") if item.strip()]


class Settings(BaseModel):
    # --- application ---
    environment: Literal["development", "test", "staging", "production"] = Field(
        default_factory=lambda: _env("ENVIRONMENT", default="development"))  # type: ignore[arg-type]
    api_prefix: str = "/api/v1"
    log_level: str = Field(default_factory=lambda: _env("LOG_LEVEL", default="INFO"))
    log_json: bool = Field(default_factory=lambda: _bool("LOG_JSON", default=False))
    cors_origins: list[str] = Field(default_factory=lambda: _list(
        "CORS_ORIGINS", default="http://localhost:3000,http://127.0.0.1:3000"))
    sentry_dsn: str = Field(default_factory=lambda: _env("SENTRY_DSN"))

    # --- persistence ---
    database_url: str = Field(default_factory=lambda: _env(
        "DATABASE_URL", default=f"sqlite:///{(BACKEND_DIR / 'storage' / 'credx.db').as_posix()}"))
    auto_create_tables: bool = Field(default_factory=lambda: _bool("AUTO_CREATE_TABLES", default=True))

    # --- background jobs ---
    job_backend: Literal["celery", "thread", "inline"] = Field(
        default_factory=lambda: _env("JOB_BACKEND", default="thread"))  # type: ignore[arg-type]
    job_workers: int = Field(default_factory=lambda: int(_env("JOB_WORKERS", default="2")))
    redis_url: str = Field(default_factory=lambda: _env("REDIS_URL"))

    # --- security ---
    jwt_secret: str = Field(default_factory=lambda: _env("JWT_SECRET", default="dev-only-insecure-jwt-secret-change-me"))
    jwt_algorithm: str = Field(default_factory=lambda: _env("JWT_ALGORITHM", default="HS256"))
    access_token_minutes: int = Field(default_factory=lambda: int(_env("ACCESS_TOKEN_MINUTES", default="720")))
    allow_self_signup: bool = Field(default_factory=lambda: _bool("ALLOW_SELF_SIGNUP", default=True))

    # --- storage & uploads ---
    storage_backend: Literal["local", "s3"] = Field(
        default_factory=lambda: _env("STORAGE_BACKEND", default="local"))  # type: ignore[arg-type]
    storage_dir: Path = Field(default_factory=lambda: Path(_env("STORAGE_DIR", default=str(BACKEND_DIR / "storage"))))
    s3_bucket: str = Field(default_factory=lambda: _env("S3_BUCKET"))
    s3_region: str = Field(default_factory=lambda: _env("S3_REGION", "AWS_REGION", default="ap-south-1"))
    s3_endpoint_url: str = Field(default_factory=lambda: _env("S3_ENDPOINT_URL"))  # R2 / Supabase Storage / MinIO
    max_upload_mb: int = Field(default_factory=lambda: int(_env("MAX_UPLOAD_MB", default="25")))
    allowed_upload_extensions: list[str] = Field(default_factory=lambda: _list(
        "ALLOWED_UPLOAD_EXTENSIONS", default=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.txt,.csv,.json"))

    # --- document AI ---
    ocr_engine: Literal["tesseract", "none"] = Field(
        default_factory=lambda: _env("OCR_ENGINE", default="tesseract"))  # type: ignore[arg-type]
    ocr_min_chars_per_page: int = Field(default_factory=lambda: int(_env("OCR_MIN_CHARS_PER_PAGE", default="60")))
    enable_camelot: bool = Field(default_factory=lambda: _bool("ENABLE_CAMELOT", default=True))

    # --- secondary research ---
    research_live: bool = Field(default_factory=lambda: _bool("RESEARCH_LIVE", default=False))
    newsapi_key: str = Field(default_factory=lambda: _env("NEWSAPI_KEY", "NEWSAPI_API_KEY"))
    serpapi_key: str = Field(default_factory=lambda: _env("SERPAPI_KEY", "SERPAPI_API_KEY"))
    research_timeout_s: float = Field(default_factory=lambda: float(_env("RESEARCH_TIMEOUT_S", default="12")))
    research_cache_ttl_s: int = Field(default_factory=lambda: int(_env("RESEARCH_CACHE_TTL_S", default="21600")))

    # --- AI providers ---
    llm_provider_order: list[str] = Field(default_factory=lambda: _list(
        "AI_PROVIDER_ORDER", default="anthropic,openai,gemini,local"))
    anthropic_api_key: str = Field(default_factory=lambda: _env("ANTHROPIC_API_KEY"))
    anthropic_model: str = Field(default_factory=lambda: _env("ANTHROPIC_MODEL", default="claude-opus-5-5"))
    anthropic_effort: Literal["low", "medium", "high"] = Field(
        default_factory=lambda: _env("ANTHROPIC_EFFORT", default="medium"))  # type: ignore[arg-type]
    openai_api_key: str = Field(default_factory=lambda: _env("OPENAI_API_KEY"))
    openai_model: str = Field(default_factory=lambda: _env("OPENAI_MODEL", default="gpt-4o-mini"))
    gemini_api_key: str = Field(default_factory=lambda: _env("GEMINI_API_KEY", "GOOGLE_API_KEY"))
    gemini_model: str = Field(default_factory=lambda: _env("GEMINI_MODEL", default="gemini-2.0-flash"))
    ai_timeout_s: float = Field(default_factory=lambda: float(_env("AI_TIMEOUT_S", default="90")))
    llm_max_tokens: int = Field(default_factory=lambda: int(_env("LLM_MAX_TOKENS", default="4000")))

    # --- credit policy ---
    repo_rate: float = Field(default_factory=lambda: float(_env("RBI_REPO_RATE", default="5.50")))
    base_lending_rate: float = Field(default_factory=lambda: float(_env("BASE_LENDING_RATE", default="9.25")))
    model_dir: Path = Field(default_factory=lambda: Path(_env(
        "MODEL_DIR", default=str(BACKEND_DIR / "scoring" / "models" / "artifacts"))))

    @field_validator("database_url")
    @classmethod
    def _driver(cls, value: str) -> str:
        # Supabase / Railway / Render hand out ``postgres://`` URLs; SQLAlchemy needs an explicit driver.
        if value.startswith("postgres://"):
            value = "postgresql://" + value[len("postgres://"):]
        if value.startswith("postgresql://"):
            value = "postgresql+psycopg://" + value[len("postgresql://"):]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    def ensure_dirs(self) -> None:
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.model_dir.mkdir(parents=True, exist_ok=True)

    def production_problems(self) -> list[str]:
        problems: list[str] = []
        if self.jwt_secret.startswith("dev-only") or len(self.jwt_secret) < 32:
            problems.append("JWT_SECRET must be a random secret of at least 32 characters")
        if "*" in self.cors_origins:
            problems.append("CORS_ORIGINS must list explicit origins")
        return problems


@lru_cache
def get_settings() -> Settings:
    _load_dotenv()
    settings = Settings()
    settings.ensure_dirs()
    if settings.is_production and (problems := settings.production_problems()):
        raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))
    return settings
