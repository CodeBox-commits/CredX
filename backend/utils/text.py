from __future__ import annotations

import re
import unicodedata

_WS = re.compile(r"\s+")


def normalize_space(value: str) -> str:
    return _WS.sub(" ", value or "").strip()


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def safe_filename(name: str, max_len: int = 120) -> str:
    """Strip path components and unsafe characters from an uploaded filename."""
    name = name.replace("\\", "/").split("/")[-1]
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, ""
    stem = re.sub(r"[^A-Za-z0-9._ -]+", "_", stem).strip(" .") or "document"
    ext = re.sub(r"[^A-Za-z0-9]+", "", ext)[:8]
    return (stem[: max_len - len(ext) - 1] + (f".{ext}" if ext else "")).strip()


def truncate(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


def snippet_around(text: str, start: int, end: int, radius: int = 80) -> str:
    lo, hi = max(0, start - radius), min(len(text), end + radius)
    return normalize_space(("…" if lo else "") + text[lo:hi] + ("…" if hi < len(text) else ""))
