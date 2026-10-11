"""Object storage: local filesystem by default, S3 when STORAGE_BACKEND=s3 (requires boto3).

Callers only deal in opaque keys such as ``documents/<case>/<doc>.pdf``.
"""

from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Protocol

from config import get_settings
from core.errors import ValidationFailed


class ObjectStorage(Protocol):
    def put(self, key: str, data: bytes, content_type: str | None = None) -> str: ...
    def get(self, key: str) -> bytes: ...
    def exists(self, key: str) -> bool: ...
    def local_path(self, key: str) -> Path | None: ...


class LocalStorage:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise ValidationFailed("Invalid storage key")
        return path

    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def get(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path(key).exists()

    def local_path(self, key: str) -> Path | None:
        return self._path(key)


class S3Storage:  # pragma: no cover - needs AWS credentials
    def __init__(self, bucket: str, region: str, endpoint_url: str | None = None) -> None:
        import boto3

        self.bucket = bucket
        self.client = boto3.client("s3", region_name=region, endpoint_url=endpoint_url or None)

    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        extra = {"ContentType": content_type} if content_type else {}
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ServerSideEncryption="AES256", **extra)
        return key

    def get(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:  # noqa: BLE001
            return False

    def local_path(self, key: str) -> Path | None:
        return None


_storage: ObjectStorage | None = None


def get_storage() -> ObjectStorage:
    global _storage
    if _storage is None:
        s = get_settings()
        _storage = S3Storage(s.s3_bucket, s.s3_region, s.s3_endpoint_url) if s.storage_backend == "s3" else LocalStorage(s.storage_dir)
    return _storage


@contextmanager
def materialize(key: str, suffix: str = "") -> Iterator[Path]:
    """Yield a local filesystem path for a stored object (a temp copy for remote backends)."""
    storage = get_storage()
    local = storage.local_path(key)
    if local is not None:
        yield local
        return
    fd, tmp = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(storage.get(key))
        yield Path(tmp)
    finally:
        Path(tmp).unlink(missing_ok=True)
