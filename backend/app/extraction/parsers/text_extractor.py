from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ..ocr.fallback import run_ocr_fallback


@dataclass(slots=True)
class ExtractedPage:
    page_number: int
    text: str


@dataclass(slots=True)
class TextExtractionResult:
    text: str
    pages: list[ExtractedPage]
    extraction_method: str
    page_count: int
    table_count: int
    used_ocr: bool


def _extract_pdf_with_pdfplumber(file_path: Path) -> TextExtractionResult | None:
    try:
        import pdfplumber
    except Exception:
        return None

    try:
        pages: list[ExtractedPage] = []
        table_count = 0
        with pdfplumber.open(file_path) as pdf:
            for index, page in enumerate(pdf.pages, start=1):
                page_text = (page.extract_text() or "").strip()
                pages.append(ExtractedPage(page_number=index, text=page_text))
                table_count += len(page.extract_tables() or [])

        text = "\n\n".join(page.text for page in pages if page.text).strip()
        if not text:
            return None

        return TextExtractionResult(
            text=text,
            pages=pages,
            extraction_method="pdfplumber",
            page_count=len(pages),
            table_count=table_count,
            used_ocr=False,
        )
    except Exception:
        return None


def _extract_pdf_with_pymupdf(file_path: Path) -> TextExtractionResult | None:
    try:
        import fitz
    except Exception:
        return None

    try:
        document = fitz.open(file_path)
        pages = [
            ExtractedPage(page_number=index + 1, text=page.get_text("text").strip())
            for index, page in enumerate(document)
        ]
        text = "\n\n".join(page.text for page in pages if page.text).strip()
        if not text:
            return None
        return TextExtractionResult(
            text=text,
            pages=pages,
            extraction_method="pymupdf",
            page_count=len(pages),
            table_count=0,
            used_ocr=False,
        )
    except Exception:
        return None


def extract_text(file_path: Path) -> TextExtractionResult:
    suffix = file_path.suffix.lower()

    if suffix in {".txt", ".md", ".json", ".csv"}:
        text = file_path.read_text(encoding="utf-8", errors="ignore")
        return TextExtractionResult(
            text=text,
            pages=[ExtractedPage(page_number=1, text=text)],
            extraction_method="plain-text",
            page_count=1,
            table_count=0,
            used_ocr=False,
        )

    if suffix == ".pdf":
        result = _extract_pdf_with_pdfplumber(file_path) or _extract_pdf_with_pymupdf(file_path)
        if result is not None:
            return result

        ocr_text, page_count = run_ocr_fallback(file_path)
        if ocr_text:
            pages = [
                ExtractedPage(page_number=index + 1, text=page_text.strip())
                for index, page_text in enumerate(ocr_text.split("\f"))
            ]
            return TextExtractionResult(
                text=ocr_text,
                pages=pages or [ExtractedPage(page_number=1, text=ocr_text)],
                extraction_method="tesseract-ocr",
                page_count=page_count or max(len(pages), 1),
                table_count=0,
                used_ocr=True,
            )

    binary_text = file_path.read_text(encoding="utf-8", errors="ignore")
    return TextExtractionResult(
        text=binary_text,
        pages=[ExtractedPage(page_number=1, text=binary_text)],
        extraction_method="generic-text",
        page_count=1,
        table_count=0,
        used_ocr=False,
    )
