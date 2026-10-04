"""Turn raw bytes (PDF, image, text) into per-page text with layout preserved.

Strategy for PDFs:
1. ``pdfplumber`` (best layout fidelity for digital statements),
2. ``PyMuPDF`` when pdfplumber fails or yields garbage,
3. OCR for any page whose text layer is too thin (scanned page).
"""

from __future__ import annotations

import io
import json
from dataclasses import dataclass, field

from config import get_settings
from core.logging import get_logger

from ..ocr.engine import OcrUnavailable, ocr_available, ocr_image_bytes, ocr_pdf_page
from .preprocess import clean_page_text

logger = get_logger("credx.parser")


@dataclass(slots=True)
class PageText:
    number: int
    text: str
    method: str  # pdfplumber | pymupdf | ocr:tesseract | text
    ocr_confidence: float | None = None


@dataclass(slots=True)
class ParsedDocument:
    pages: list[PageText] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    ocr_used: bool = False
    is_pdf: bool = False

    @property
    def page_count(self) -> int:
        return len(self.pages)

    @property
    def full_text(self) -> str:
        return "\n\n".join(page.text for page in self.pages)

    @property
    def text_quality(self) -> float:
        """0..1 heuristic: share of pages with a meaningful text layer, weighted by OCR confidence."""
        if not self.pages:
            return 0.0
        scores = []
        for page in self.pages:
            density = min(1.0, len(page.text.strip()) / 400)
            scores.append(density * (page.ocr_confidence if page.ocr_confidence is not None else 1.0))
        return round(sum(scores) / len(scores), 3)


def _pdfplumber_pages(data: bytes) -> list[str]:
    import pdfplumber

    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return [(page.extract_text(layout=False, x_tolerance=1.5, y_tolerance=3) or "") for page in pdf.pages]


def _pymupdf_pages(data: bytes) -> list[str]:
    import fitz

    with fitz.open(stream=data, filetype="pdf") as doc:
        return [page.get_text("text", sort=True) or "" for page in doc]


def parse_pdf(data: bytes) -> ParsedDocument:
    settings = get_settings()
    parsed = ParsedDocument(is_pdf=True)
    method = "pdfplumber"
    try:
        raw_pages = _pdfplumber_pages(data)
    except Exception as exc:  # noqa: BLE001
        logger.warning("pdfplumber_failed", extra={"error": str(exc)})
        parsed.warnings.append("pdfplumber could not read this PDF; used PyMuPDF instead")
        raw_pages, method = [], "pymupdf"

    if not raw_pages or sum(len(p.strip()) for p in raw_pages) < 20:
        try:
            alt = _pymupdf_pages(data)
            if sum(len(p.strip()) for p in alt) > sum(len(p.strip()) for p in raw_pages):
                raw_pages, method = alt, "pymupdf"
        except Exception as exc:  # noqa: BLE001
            parsed.warnings.append(f"PyMuPDF failed: {exc}")

    can_ocr = ocr_available()
    ocr_skipped = 0
    for index, text in enumerate(raw_pages):
        if len(text.strip()) >= settings.ocr_min_chars_per_page:
            parsed.pages.append(PageText(index + 1, clean_page_text(text), method))
            continue
        if not can_ocr:
            ocr_skipped += 1
            parsed.pages.append(PageText(index + 1, clean_page_text(text), method, ocr_confidence=0.3))
            continue
        try:
            result = ocr_pdf_page(data, index)
            parsed.ocr_used = True
            parsed.pages.append(
                PageText(index + 1, clean_page_text(result.text), f"ocr:{result.engine}", result.confidence)
            )
        except Exception as exc:  # noqa: BLE001
            parsed.warnings.append(f"OCR failed on page {index + 1}: {exc}")
            parsed.pages.append(PageText(index + 1, clean_page_text(text), method, ocr_confidence=0.3))

    if ocr_skipped:
        parsed.warnings.append(
            f"{ocr_skipped} page(s) look scanned but no OCR engine is installed — install tesseract-ocr for full coverage"
        )
    return parsed


def parse_image(data: bytes) -> ParsedDocument:
    parsed = ParsedDocument()
    try:
        result = ocr_image_bytes(data)
        parsed.ocr_used = True
        parsed.pages.append(PageText(1, clean_page_text(result.text), f"ocr:{result.engine}", result.confidence))
    except OcrUnavailable as exc:
        parsed.warnings.append(str(exc))
        parsed.pages.append(PageText(1, "", "ocr:unavailable", 0.0))
    return parsed


def parse_text(data: bytes, extension: str) -> ParsedDocument:
    text = data.decode("utf-8", errors="replace")
    if extension == ".json":
        try:
            text = json.dumps(json.loads(text), indent=2)
        except json.JSONDecodeError:
            pass
    if extension == ".csv":
        text = "\n".join("  ".join(cell.strip() for cell in line.split(",")) for line in text.splitlines())
    # Treat form-feeds as page breaks so multi-page text exports keep page numbers.
    chunks = text.split("\f") if "\f" in text else [text]
    return ParsedDocument(pages=[PageText(i + 1, clean_page_text(c), "text") for i, c in enumerate(chunks)])


def parse_document(data: bytes, extension: str) -> ParsedDocument:
    extension = extension.lower()
    if extension == ".pdf":
        return parse_pdf(data)
    if extension in {".png", ".jpg", ".jpeg", ".tif", ".tiff"}:
        return parse_image(data)
    return parse_text(data, extension)
