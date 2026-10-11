from __future__ import annotations

import re

_WS = re.compile(r"\s+")


def normalize_space(value: str) -> str:
    return _WS.sub(" ", value or "").strip()


def safe_filename(name: str, max_len: int = 120) -> str:
    """Strip path components and unsafe characters from an uploaded filename."""
    name = name.replace("\\", "/").split("/")[-1]
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, ""
    stem = re.sub(r"[^A-Za-z0-9._ -]", "_", stem).strip(" .") or "document"
    ext = re.sub(r"[^A-Za-z0-9]+", "", ext)[:8]
    return (stem[: max_len - len(ext) - 1] + (f".{ext}" if ext else "")).strip()
