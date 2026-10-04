"""Exponential-backoff retry helper used by research providers and LLM clients."""

from __future__ import annotations

import random
import time
from collections.abc import Callable
from typing import TypeVar

from .logging import get_logger

T = TypeVar("T")
logger = get_logger("credx.retry")


def retry_call(
    fn: Callable[[], T],
    *,
    attempts: int = 3,
    base_delay: float = 0.5,
    max_delay: float = 6.0,
    retry_on: tuple[type[BaseException], ...] = (Exception,),
    label: str = "operation",
) -> T:
    last_exc: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except retry_on as exc:  # noqa: PERF203
            last_exc = exc
            if attempt == attempts:
                break
            delay = min(max_delay, base_delay * 2 ** (attempt - 1)) * (0.75 + random.random() / 2)
            logger.warning(
                "retrying", extra={"label": label, "attempt": attempt, "delay": round(delay, 2), "error": str(exc)}
            )
            time.sleep(delay)
    assert last_exc is not None
    raise last_exc
