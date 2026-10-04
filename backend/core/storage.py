"""Object storage abstraction.

``LocalStorage`` is used in development and single-node deployments; ``S3Storage``
activates when ``CREDX_STORAGE_BACKEND=s3`` (requires ``boto3``). Callers only ever
deal in opaque storage keys such as ``uploads/<case>/<uuid>.pdf``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from config import get_settings

from .errors import ValidationFailedError


class ObjectStorage(Protocol):
    def put(self, key: str, data: bytes, content_type: str | None = None) -> str: ...
    def get(self, key: str) -> bytes: ...
    def local_path(self, key: str) -> Path: ...
    def exists(self, key: str) -> bool: ...


class LocalStorage:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents and path != self.root:
            raise ValidationFailedError("Invalid storage key")
        return path

    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        path = self._resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def get(self, key: str) -> bytes:
        return self._resolve(key).read_bytes()

    def local_path(self, key: str) -> Path:
        return self._resolve(key)

    def exists(self, key: str) -> bool:
        return self._resolve(key).exists()


class S3Storage:  # pragma: no cover - requires AWS credentials
    def __init__(self, bucket: str, region: str, cache_dir: Path) -> None:
        import boto3

        self.bucket = bucket
        self.client = boto3.client("s3", region_name=region)
        self.cache = LocalStorage(cache_dir)

    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        extra = {"ContentType": content_type} if content_type else {}
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ServerSideEncryption="AES256", **extra)
        self.cache.put(key, data)
        return key

    def get(self, key: str) -> bytes:
        if self.cache.exists(key):
            return self.cache.get(key)
        body = self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        self.cache.put(key, body)
        return body

    def local_path(self, key: str) -> Path:
        if not self.cache.exists(key):
            self.get(key)
        return self.cache.local_path(key)

    def exists(self, key: str) -> bool:
        if self.cache.exists(key):
            return True
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:  # noqa: BLE001
            return False


_storage: ObjectStorage | None = None


def get_storage() -> ObjectStorage:
    global _storage
    if _storage is None:
        settings = get_settings()
        if settings.storage_backend == "s3" and settings.s3_bucket:
            _storage = S3Storage(settings.s3_bucket, settings.s3_region, settings.storage_dir / "cache")
        else:
            _storage = LocalStorage(settings.storage_dir)
    return _storage


def reset_storage() -> None:
    global _storage
    _storage = None
