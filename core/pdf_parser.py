"""PDF parsing utilities for structured financial documents."""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Callable


logger = logging.getLogger(__name__)

PageRecord = dict[str, Any]
ParserFn = Callable[[str], list[PageRecord]]


def _build_page_record(
    *,
    text: str,
    file_path: str,
    page_number: int | None,
    parser_name: str,
) -> PageRecord:
    return {
        "text": text,
        "metadata": {
            "page_number": page_number,
            "source_file": Path(file_path).name,
            "parser": parser_name,
        },
    }


def _parse_with_pymupdf4llm(file_path: str) -> list[PageRecord]:
    import pymupdf4llm

    page_chunks = pymupdf4llm.to_markdown(file_path, page_chunks=True)
    records: list[PageRecord] = []

    for index, chunk in enumerate(page_chunks, start=1):
        raw_page_number = chunk.get("page_number")
        page_number = raw_page_number if isinstance(raw_page_number, int) else index
        records.append(
            _build_page_record(
                text=chunk.get("text", "") or "",
                file_path=file_path,
                page_number=page_number,
                parser_name="pymupdf4llm",
            )
        )

    return records


def _load_pdf_reader() -> tuple[type[Any], str]:
    try:
        from pypdf import PdfReader

        return PdfReader, "pypdf"
    except ModuleNotFoundError as first_error:
        try:
            from PyPDF2 import PdfReader

            return PdfReader, "PyPDF2"
        except ModuleNotFoundError:
            raise first_error


def _parse_with_pypdf(file_path: str) -> list[PageRecord]:
    pdf_reader_cls, parser_name = _load_pdf_reader()
    reader = pdf_reader_cls(file_path)

    records: list[PageRecord] = []
    for index, page in enumerate(reader.pages, start=1):
        extracted_text = page.extract_text() or ""
        records.append(
            _build_page_record(
                text=extracted_text,
                file_path=file_path,
                page_number=index,
                parser_name=parser_name,
            )
        )

    return records


def _parse_financial_pdf_sync(file_path: str) -> list[PageRecord]:
    """
    Synchronously parse a financial PDF into page-level text chunks.

    The parser prefers `pymupdf4llm` when available and falls back to
    `pypdf`/`PyPDF2` for environments where richer PDF tooling is not installed.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    backend_errors: list[str] = []
    parser_backends: tuple[tuple[str, ParserFn], ...] = (
        ("pymupdf4llm", _parse_with_pymupdf4llm),
        ("pypdf", _parse_with_pypdf),
    )

    for backend_name, parser_backend in parser_backends:
        try:
            records = parser_backend(file_path)
        except ModuleNotFoundError as exc:
            backend_errors.append(f"{backend_name}: {exc}")
            continue
        except Exception as exc:  # noqa: BLE001 - parser failures vary by document
            logger.exception("Failed to parse PDF with %s: %s", backend_name, file_path)
            backend_errors.append(f"{backend_name}: {exc}")
            continue

        if not records:
            backend_errors.append(f"{backend_name}: no pages extracted")
            continue

        if not any((record.get("text") or "").strip() for record in records):
            backend_errors.append(f"{backend_name}: extracted pages were empty")
            continue

        return records

    attempted_backends = "; ".join(backend_errors) or "no parser backends were attempted"
    raise RuntimeError(
        "Unable to parse PDF locally. Install `pypdf` or `pymupdf4llm`. "
        f"Details: {attempted_backends}"
    )


async def parse_financial_pdf(file_path: str) -> list[PageRecord]:
    """Parse a financial PDF and return page-level text with metadata."""
    return await asyncio.to_thread(_parse_financial_pdf_sync, file_path)


async def _demo() -> None:
    """Run a demo parse for local testing."""
    test_file = "sample_annual_report.pdf"
    pages = await parse_financial_pdf(test_file)

    if pages:
        print(pages[0]["text"][:500])
        print(pages[0]["metadata"])


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_demo())
