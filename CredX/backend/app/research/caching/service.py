from __future__ import annotations

from time import time
from typing import Callable, TypeVar

T = TypeVar("T")


class ResearchCache:
    def __init__(self, ttl_seconds: int = 300) -> None:
        self.ttl_seconds = ttl_seconds
        self._store: dict[str, tuple[float, T]] = {}

    def get_or_compute(self, key: str, compute: Callable[[], T]) -> T:
        now = time()
        cached = self._store.get(key)
        if cached is not None and now - cached[0] <= self.ttl_seconds:
            return cached[1]

        value = compute()
        self._store[key] = (now, value)
        return value
