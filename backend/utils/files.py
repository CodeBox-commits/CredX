"""Upload validation: size, extension allow-list and magic-byte sniffing."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

from config import get_settings
from core.errors import UploadRejectedError

from .text import safe_filename

_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    ".pdf": (b"%PDF-",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".tif": (b"II*\x00", b"MM\x00*"),
    ".tiff": (b"II*\x00", b"MM\x00*"),
}

_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
}

_TEXT_EXTS = {".txt", ".csv", ".json"}


@dataclass(slots=True)
class ValidatedUpload:
    filename: str
    extension: str
    content_type: str
    size: int
    sha256: str


def validate_upload(filename: str, data: bytes) -> ValidatedUpload:
    settings = get_settings()
    clean = safe_filename(filename or "document")
    ext = Path(clean).suffix.lower()
    if ext not in settings.allowed_upload_extensions:
        raise UploadRejectedError(
            f"File type '{ext or 'unknown'}' is not allowed",
            details={"allowed": settings.allowed_upload_extensions},
        )
    if not data:
        raise UploadRejectedError("Uploaded file is empty")
    if len(data) > settings.max_upload_bytes:
        raise UploadRejectedError(f"File exceeds the {settings.max_upload_mb} MB upload limit")

    signatures = _SIGNATURES.get(ext)
    if signatures and not any(data.startswith(sig) for sig in signatures):
        raise UploadRejectedError("File content does not match its extension")
    if ext in _TEXT_EXTS:
        if b"\x00" in data[:4096]:
            raise UploadRejectedError("Text upload contains binary content")
        try:
            data[:4096].decode("utf-8")
        except UnicodeDecodeError as exc:
            raise UploadRejectedError("Text uploads must be UTF-8 encoded") from exc
    if ext == ".pdf" and b"/JavaScript" in data[:200_000] and b"/OpenAction" in data[:200_000]:
        raise UploadRejectedError("PDFs with auto-executing JavaScript are not accepted")

    return ValidatedUpload(
        filename=clean,
        extension=ext,
        content_type=_CONTENT_TYPES.get(ext, "application/octet-stream"),
        size=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
    )
