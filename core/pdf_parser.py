"""PDF parsing module using LlamaParse for structured financial documents."""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from llama_parse import LlamaParse


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ParsedPage:
    """Represents parsed content for a single page."""

    text: str
    page_number: Optional[int]
    source_file: str
    metadata: Dict[str, Any]


@dataclass(frozen=True)
class ParsedDocument:
    """Represents parsed content for an entire document."""

    pages: List[ParsedPage]

    @property
    def combined_text(self) -> str:
        """Return the concatenated text across all pages."""
        return "\n\n".join(page.text for page in self.pages)


def _init_parser() -> LlamaParse:
    """Initialize and return a configured LlamaParse client."""
    # Load .env if present; required for LLAMA_CLOUD_API_KEY.
    load_dotenv()

    api_key = os.getenv("LLAMA_CLOUD_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "LLAMA_CLOUD_API_KEY is not set. Please configure it in your environment or .env file."
        )

    return LlamaParse(
        api_key=api_key,
        result_type="markdown",
        # Ensure page boundaries are preserved for traceability.
        split_by_page=True,
    )


def _normalize_metadata(
    doc_meta: Optional[Dict[str, Any]],
    file_path: str,
) -> Dict[str, Any]:
    """Normalize metadata and ensure source file information is present."""
    metadata: Dict[str, Any] = dict(doc_meta or {})
    metadata.setdefault("source_file", os.path.basename(file_path))
    return metadata


def _to_parsed_page(doc: Any, file_path: str) -> ParsedPage:
    """Convert a LlamaParse document into a ParsedPage."""
    metadata = _normalize_metadata(getattr(doc, "metadata", None), file_path)
    page_number = metadata.get("page_number")
    source_file = metadata.get("source_file", os.path.basename(file_path))

    return ParsedPage(
        text=getattr(doc, "text", "") or "",
        page_number=page_number if isinstance(page_number, int) else None,
        source_file=source_file,
        metadata=metadata,
    )


async def parse_financial_pdf(file_path: str) -> ParsedDocument:
    """
    Parse a financial PDF using LlamaParse and return page-level results.

    Args:
        file_path: Path to the PDF file on disk.

    Returns:
        ParsedDocument with page-level text and metadata.

    Raises:
        FileNotFoundError: If the input file does not exist.
        EnvironmentError: If LLAMA_CLOUD_API_KEY is not configured.
        Exception: For unexpected parsing errors.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    parser = _init_parser()

    try:
        docs = await parser.aparse(file_path)
        pages = [_to_parsed_page(doc, file_path) for doc in docs]
        return ParsedDocument(pages=pages)
    except Exception as exc:  # noqa: BLE001 - needed for robust pipeline behavior
        logger.exception("Failed to parse PDF: %s", file_path)
        raise exc


async def _demo() -> None:
    """Run a demo parse for local testing."""
    test_file = "sample_annual_report.pdf"
    result = await parse_financial_pdf(test_file)

    print(result.combined_text[:500])
    if result.pages:
        print(
            {
                "page_number": result.pages[0].page_number,
                "source_file": result.pages[0].source_file,
                "metadata": result.pages[0].metadata,
            }
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_demo())
