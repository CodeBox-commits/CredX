"""Exponential-backoff retry decorator for flaky network calls (research providers)."""

from __future__ import annotations

import functools
import random
import time
from collections.abc import Callable
from typing import ParamSpec, TypeVar

from core.logging import get_logger

P = ParamSpec("P")
T = TypeVar("T")
log = get_logger("credx.retry")


def retry(*, attempts: int = 3, base_delay: float = 0.5, max_delay: float = 6.0,
          retry_on: tuple[type[BaseException], ...] = (Exception,)) -> Callable[[Callable[P, T]], Callable[P, T]]:
    def decorator(fn: Callable[P, T]) -> Callable[P, T]:
        @functools.wraps(fn)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            for attempt in range(1, attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except retry_on as exc:
                    if attempt == attempts:
                        raise
                    delay = min(max_delay, base_delay * 2 ** (attempt - 1)) * (0.75 + random.random() / 2)
                    log.warning("retrying", extra={"fn": fn.__qualname__, "attempt": attempt, "delay_s": round(delay, 2),
                                                   "error": str(exc)[:200]})
                    time.sleep(delay)
            raise AssertionError("unreachable")

        return wrapper

    return decorator
