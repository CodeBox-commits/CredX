from __future__ import annotations

from pathlib import Path
from typing import Any


def extract_tables(file_path: Path) -> list[dict[str, Any]]:
    suffix = file_path.suffix.lower()
    if suffix != ".pdf":
        return []

    try:
        import camelot
    except Exception:
        return []

    try:
        tables = camelot.read_pdf(str(file_path), pages="all", flavor="stream")
    except Exception:
        return []

    extracted: list[dict[str, Any]] = []
    for index, table in enumerate(tables, start=1):
        try:
            rows = table.df.fillna("").values.tolist()
        except Exception:
            rows = []
        if not rows:
            continue
        extracted.append(
            {
                "table_index": index,
                "page": getattr(table, "page", None),
                "rows": rows[:8],
            }
        )
    return extracted
