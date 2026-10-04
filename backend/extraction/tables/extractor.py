"""Table extraction: pdfplumber first, Camelot (lattice → stream) as an upgrade path.

Also recovers "text tables" from plain-text/OCR output by splitting on runs of
two or more spaces, so financial statements in .txt exports still parse.
"""

from __future__ import annotations

import io
import re

from config import get_settings
from core.logging import get_logger

from ..normalization.schema import ExtractedTable

logger = get_logger("credx.tables")

_COLUMN_SPLIT = re.compile(r"\s{2,}|\t|\s\|\s|\|")
_NUMERIC_CELL = re.compile(r"^[(\-₹Rs.\s]*\d[\d,]*(\.\d+)?\)?\s*(%|cr|crore|lakh|lakhs)?$", re.I)


def _clean_cell(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _normalise_rows(rows: list[list[object]]) -> list[list[str]]:
    cleaned = [[_clean_cell(c) for c in row] for row in rows if row]
    cleaned = [row for row in cleaned if any(cell for cell in row)]
    if not cleaned:
        return []
    width = max(len(row) for row in cleaned)
    return [row + [""] * (width - len(row)) for row in cleaned]


def _is_numeric_row(row: list[str]) -> bool:
    numeric = sum(1 for cell in row[1:] if cell and _NUMERIC_CELL.match(cell))
    return numeric >= 1


def _to_table(rows: list[list[str]], page: int, method: str) -> ExtractedTable | None:
    rows = _normalise_rows(rows)
    if len(rows) < 2 or len(rows[0]) < 2:
        return None
    header_idx = next((i for i, row in enumerate(rows[:3]) if not _is_numeric_row(row)), 0)
    header = rows[header_idx]
    body = rows[header_idx + 1 :]
    if not any(_is_numeric_row(row) for row in body):
        return None
    return ExtractedTable(page=page, method=method, header=header, rows=body)


def _pdfplumber_tables(data: bytes) -> list[ExtractedTable]:
    import pdfplumber

    tables: list[ExtractedTable] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for index, page in enumerate(pdf.pages):
            strategies = [
                {},
                {"vertical_strategy": "text", "horizontal_strategy": "text", "snap_tolerance": 3},
            ]
            for settings in strategies:
                found = [t for t in (page.extract_tables(settings) or []) if t]
                parsed = [tbl for raw in found if (tbl := _to_table(raw, index + 1, "pdfplumber"))]
                if parsed:
                    tables.extend(parsed)
                    break
    return tables


def _camelot_tables(path: str) -> list[ExtractedTable]:
    import camelot  # type: ignore[import-untyped]

    tables: list[ExtractedTable] = []
    for flavor in ("lattice", "stream"):
        try:
            found = camelot.read_pdf(path, pages="all", flavor=flavor, suppress_stdout=True)
        except Exception as exc:  # noqa: BLE001 - ghostscript/opencv may be missing
            logger.debug("camelot_failed", extra={"flavor": flavor, "error": str(exc)})
            continue
        for table in found:
            rows = table.df.values.tolist()
            parsed = _to_table(rows, int(table.page), f"camelot:{flavor}")
            if parsed and table.parsing_report.get("accuracy", 0) >= 70:
                tables.append(parsed)
        if tables:
            break
    return tables


def text_tables(page_text: str, page: int) -> list[ExtractedTable]:
    """Recover tables from whitespace-aligned text blocks."""
    tables: list[ExtractedTable] = []
    block: list[list[str]] = []

    def flush() -> None:
        if len(block) >= 3:
            table = _to_table(block, page, "text")
            if table:
                tables.append(table)
        block.clear()

    for line in page_text.splitlines():
        cells = [c for c in _COLUMN_SPLIT.split(line.strip()) if c.strip()]
        if len(cells) >= 2:
            block.append(cells)
        else:
            flush()
    flush()
    return tables


def extract_tables(data: bytes | None, *, pdf_path: str | None, page_texts: list[str]) -> list[ExtractedTable]:
    tables: list[ExtractedTable] = []
    if data is not None:
        try:
            tables = _pdfplumber_tables(data)
        except Exception as exc:  # noqa: BLE001
            logger.warning("pdfplumber_tables_failed", extra={"error": str(exc)})
        if not tables and pdf_path and get_settings().enable_camelot:
            tables = _camelot_tables(pdf_path)
    if not tables:
        for index, text in enumerate(page_texts):
            tables.extend(text_tables(text, index + 1))
    return tables[:40]
