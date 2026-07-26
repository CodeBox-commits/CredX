"""PDF parsing module using pymupdf4llm for structured financial documents."""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List

import pymupdf4llm


logger = logging.getLogger(__name__)


def _build_page_records(
    page_chunks: List[Dict[str, Any]],
    file_path: str,
) -> List[Dict[str, Any]]:
    """Normalize pymupdf4llm page chunks into the required output shape."""
    source_file = os.path.basename(file_path)
    records: List[Dict[str, Any]] = []
    for chunk in page_chunks:
        page_number = chunk.get("page_number")
        metadata = {
            "page_number": page_number if isinstance(page_number, int) else None,
            "source_file": source_file,
        }
        records.append(
            {
                "text": chunk.get("text", "") or "",
                "metadata": metadata,
            }
        )
    return records


def _parse_financial_pdf_sync(file_path: str) -> List[Dict[str, Any]]:
    """
    Synchronously parse a financial PDF into page-level Markdown chunks.

    Args:
        file_path: Path to the PDF file on disk.

    Returns:
        A list of dictionaries with `text` and `metadata` keys.

    Raises:
        FileNotFoundError: If the input file does not exist.
        ValueError: If the PDF yields no parseable content.
        Exception: For unexpected parsing errors (e.g., corrupted PDFs).
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    try:
        page_chunks = pymupdf4llm.to_markdown(
            file_path,
            page_chunks=True,
        )
    except Exception as exc:  # noqa: BLE001 - robust handling for corrupted PDFs
        logger.exception("Failed to parse PDF: %s", file_path)
        raise exc

    if not page_chunks:
        raise ValueError(f"No content extracted from PDF: {file_path}")

    return _build_page_records(page_chunks, file_path)


async def parse_financial_pdf(file_path: str) -> List[Dict[str, Any]]:
    """
    Parse a financial PDF using pymupdf4llm and return page-level results.

    Args:
        file_path: Path to the PDF file on disk.

    Returns:
        A list of dictionaries with page-level Markdown text and metadata.

    Raises:
        FileNotFoundError: If the input file does not exist.
        ValueError: If the PDF yields no parseable content.
        Exception: For unexpected parsing errors (e.g., corrupted PDFs).
    """
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
