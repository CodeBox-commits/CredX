"""Table detection: pdfplumber first, Camelot (optional, ENABLE_CAMELOT) when pdfplumber finds nothing."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from config import get_settings
from core.logging import get_logger
from extraction.parsers.pdf import PDF_LOCK

log = get_logger("credx.tables")


def _clean(cell: object) -> str:
    return " ".join(str(cell or "").split())


def _table(raw: list[list[object]], page: int, method: str, accuracy: float) -> dict[str, Any] | None:
    rows = [[_clean(c) for c in r] for r in raw if any(_clean(c) for c in r)]
    if len(rows) < 2 or len(rows[0]) < 2:
        return None
    return {"page": page, "method": method, "header": rows[0], "rows": rows[1:], "accuracy": round(accuracy, 3)}


def extract_tables(path: Path, max_pages: int = 60) -> list[dict[str, Any]]:
    if path.suffix.lower() != ".pdf":
        return []
    tables: list[dict[str, Any]] = []
    with PDF_LOCK:
        try:
            import pdfplumber

            with pdfplumber.open(path) as pdf:
                for i, page in enumerate(pdf.pages[:max_pages]):
                    for raw in page.extract_tables():
                        if t := _table(raw, i + 1, "pdfplumber", 0.9):
                            tables.append(t)
        except Exception as exc:  # noqa: BLE001 - tables are best-effort
            log.warning("pdfplumber tables failed", extra={"error": str(exc)[:200]})
        if not tables and get_settings().enable_camelot:
            try:
                import camelot

                for t in camelot.read_pdf(str(path), pages="1-end", flavor="stream"):
                    if parsed := _table(t.df.values.tolist(), int(t.page), "camelot", (t.parsing_report.get("accuracy") or 0) / 100):
                        tables.append(parsed)
            except Exception as exc:  # noqa: BLE001
                log.info("camelot unavailable or failed", extra={"error": str(exc)[:200]})
    return tables
