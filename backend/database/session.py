"""Engine and session management.

``get_db`` (FastAPI dependency) commits when the request handler returns normally and rolls
back on error, so route handlers only ``flush`` when they need generated ids.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from config import get_settings

_engine: Engine | None = None
_factory: sessionmaker[Session] | None = None


def _build_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 30})

        @event.listens_for(engine, "connect")
        def _pragmas(dbapi_conn, _):  # pragma: no cover - trivial
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA busy_timeout=30000")
            cur.close()

        return engine
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=10, pool_recycle=1800)


def get_engine() -> Engine:
    global _engine, _factory
    if _engine is None:
        _engine = _build_engine(get_settings().database_url)
        _factory = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False)
    return _engine


def SessionLocal() -> Session:  # noqa: N802 - mirrors the SQLAlchemy idiom
    get_engine()
    assert _factory is not None
    return _factory()


def init_db() -> None:
    """Create any missing tables (dev/test/single-container). Production runs ``alembic upgrade head``."""
    import models  # noqa: F401 - registers every table
    from database.base import Base

    Base.metadata.create_all(get_engine())


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
