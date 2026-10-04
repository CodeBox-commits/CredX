"""Small cache abstraction: Redis when configured, in-process TTL dict otherwise."""

from __future__ import annotations

import json
import threading
import time
from typing import Any, Protocol

from config import get_settings

from .logging import get_logger

logger = get_logger("credx.cache")


class Cache(Protocol):
    def get(self, key: str) -> Any | None: ...
    def set(self, key: str, value: Any, ttl: int) -> None: ...
    def delete(self, key: str) -> None: ...


class MemoryCache:
    def __init__(self, max_items: int = 2048) -> None:
        self._data: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()
        self._max = max_items

    def get(self, key: str) -> Any | None:
        with self._lock:
            item = self._data.get(key)
            if not item:
                return None
            expires, value = item
            if expires < time.time():
                self._data.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl: int) -> None:
        with self._lock:
            if len(self._data) >= self._max:
                oldest = min(self._data.items(), key=lambda kv: kv[1][0])[0]
                self._data.pop(oldest, None)
            self._data[key] = (time.time() + ttl, value)

    def delete(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)


class RedisCache:
    def __init__(self, url: str) -> None:
        import redis

        self._client = redis.Redis.from_url(url, socket_timeout=2, socket_connect_timeout=2)
        self._client.ping()

    def get(self, key: str) -> Any | None:
        raw = self._client.get(f"credx:{key}")
        return json.loads(raw) if raw else None

    def set(self, key: str, value: Any, ttl: int) -> None:
        self._client.setex(f"credx:{key}", ttl, json.dumps(value, default=str))

    def delete(self, key: str) -> None:
        self._client.delete(f"credx:{key}")


_cache: Cache | None = None


def get_cache() -> Cache:
    global _cache
    if _cache is None:
        url = get_settings().redis_url
        if url:
            try:
                _cache = RedisCache(url)
                logger.info("cache_backend", extra={"backend": "redis"})
            except Exception as exc:  # noqa: BLE001 - degrade gracefully
                logger.warning("redis_unavailable_falling_back", extra={"error": str(exc)})
        if _cache is None:
            _cache = MemoryCache()
    return _cache
