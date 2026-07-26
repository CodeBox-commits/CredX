from __future__ import annotations

from .base import Base
from .session import get_engine
from .. import models  # noqa: F401


def initialize_database() -> None:
    Base.metadata.create_all(bind=get_engine())
