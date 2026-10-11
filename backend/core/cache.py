"""JSON cache: Redis when REDIS_URL is set and reachable, an in-process TTL dict otherwise."""

from __future__ import annotations

import hashlib
import json
import threading
import time
from typing import Any

from config import get_settings
from core.logging import get_logger

log = get_logger("credx.cache")


class Cache:
    def __init__(self) -> None:
        self._data: dict[str, tuple[float, str]] = {}
        self._lock = threading.Lock()
        self._redis = None
        if url := get_settings().redis_url:
            try:
                import redis

                client = redis.Redis.from_url(url, socket_timeout=2, socket_connect_timeout=2)
                client.ping()
                self._redis = client
            except Exception as exc:  # noqa: BLE001 - degrade to memory
                log.warning("redis unavailable, using in-memory cache", extra={"error": str(exc)[:200]})

    @staticmethod
    def make_key(namespace: str, *parts: object) -> str:
        digest = hashlib.sha256(json.dumps(parts, default=str, sort_keys=True).encode()).hexdigest()[:24]
        return f"credx:{namespace}:{digest}"

    def get_json(self, key: str) -> Any | None:
        if self._redis is not None:
            raw = self._redis.get(key)
            return json.loads(raw) if raw else None
        with self._lock:
            item = self._data.get(key)
            if not item or item[0] < time.time():
                self._data.pop(key, None)
                return None
            return json.loads(item[1])

    def set_json(self, key: str, value: Any, ttl_s: int) -> None:
        raw = json.dumps(value, default=str)
        if self._redis is not None:
            self._redis.setex(key, ttl_s, raw)
            return
        with self._lock:
            if len(self._data) > 4096:
                self._data.pop(min(self._data, key=lambda k: self._data[k][0]), None)
            self._data[key] = (time.time() + ttl_s, raw)


_cache: Cache | None = None


def get_cache() -> Cache:
    global _cache
    if _cache is None:
        _cache = Cache()
    return _cache
