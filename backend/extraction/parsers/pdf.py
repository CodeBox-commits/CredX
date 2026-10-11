"""Text extraction with a layered strategy: pdfplumber -> PyMuPDF -> OCR (per page).

Each page records which method produced its text so confidence scoring and the UI can show
exactly where OCR was needed.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from pathlib import Path

from config import get_settings
from core.logging import get_logger
from extraction.ocr.engine import ocr_available, ocr_image

log = get_logger("credx.parsers")

# PyMuPDF (and pdfminer under pdfplumber) are not thread-safe: concurrent use from the in-process
# job pool corrupts the native heap. Every native PDF operation in the process holds this lock.
# Celery prefork workers are separate processes, so production throughput is unaffected.
PDF_LOCK = threading.RLock()


@dataclass
class PageText:
    number: int
    text: str
    method: str  # pdfplumber | pymupdf | ocr | text | none
    confidence: float


@dataclass
class ParsedDocument:
    pages: list[PageText] = field(default_factory=list)
    metadata: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    @property
    def text(self) -> str:
        return "\n\n".join(p.text for p in self.pages if p.text)

    @property
    def ocr_used(self) -> bool:
        return any(p.method == "ocr" for p in self.pages)

    @property
    def page_count(self) -> int:
        return len(self.pages)

    @property
    def text_confidence(self) -> float:
        scored = [p.confidence for p in self.pages if p.text.strip()]
        return round(sum(scored) / len(scored), 3) if scored else 0.0


def _clean(text: str) -> str:
    lines = [" ".join(line.split()) for line in text.replace("\x00", "").splitlines()]
    return "\n".join(line for line in lines if line)


def parse_pdf(path: Path, max_pages: int = 300) -> ParsedDocument:
    settings = get_settings()
    doc = ParsedDocument()
    plumber_pages: list[str] = []
    try:
        import pdfplumber

        with pdfplumber.open(path) as pdf:
            doc.metadata = {k: str(v) for k, v in (pdf.metadata or {}).items() if isinstance(v, str | int)}
            for page in pdf.pages[:max_pages]:
                plumber_pages.append(_clean(page.extract_text(x_tolerance=1.5, y_tolerance=3) or ""))
    except Exception as exc:
        doc.warnings.append(f"pdfplumber failed: {exc}")
        log.warning("pdfplumber failed", extra={"error": str(exc)})

    fitz_doc = None
    try:
        import fitz  # PyMuPDF

        fitz_doc = fitz.open(path)
    except Exception as exc:
        doc.warnings.append(f"PyMuPDF failed: {exc}")

    total = max(len(plumber_pages), fitz_doc.page_count if fitz_doc else 0)
    total = min(total, max_pages)
    for idx in range(total):
        text = plumber_pages[idx] if idx < len(plumber_pages) else ""
        method, conf = "pdfplumber", 0.97
        if len(text) < settings.ocr_min_chars_per_page and fitz_doc is not None:
            alt = _clean(fitz_doc[idx].get_text("text") or "")
            if len(alt) > len(text):
                text, method, conf = alt, "pymupdf", 0.95
        if len(text) < settings.ocr_min_chars_per_page and fitz_doc is not None:
            if ocr_available():
                from PIL import Image

                pix = fitz_doc[idx].get_pixmap(dpi=300)
                image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                result = ocr_image(image)
                if len(result.text) > len(text):
                    text, method, conf = _clean(result.text), "ocr", result.confidence * 0.9
            else:
                doc.warnings.append(f"Page {idx + 1} looks scanned but OCR (Tesseract) is not installed")
                method, conf = ("none" if not text else method), (0.2 if not text else conf)
        doc.pages.append(PageText(number=idx + 1, text=text, method=method, confidence=round(conf, 3)))
    if fitz_doc is not None:
        fitz_doc.close()
    return doc


def parse_image(path: Path) -> ParsedDocument:
    from PIL import Image

    doc = ParsedDocument()
    if not ocr_available():
        doc.warnings.append("Image uploaded but OCR (Tesseract) is not installed")
        doc.pages.append(PageText(1, "", "none", 0.0))
        return doc
    with Image.open(path) as img:
        frames = getattr(img, "n_frames", 1)
        for i in range(min(frames, 50)):
            img.seek(i)
            result = ocr_image(img.convert("RGB"))
            doc.pages.append(PageText(i + 1, _clean(result.text), "ocr", result.confidence * 0.9))
    return doc


def parse_text(path: Path) -> ParsedDocument:
    raw = path.read_text(encoding="utf-8", errors="replace")
    chunks = raw.split("\f") if "\f" in raw else [raw]
    return ParsedDocument(pages=[PageText(i + 1, _clean(c), "text", 1.0) for i, c in enumerate(chunks)])


def parse_any(path: Path) -> ParsedDocument:
    ext = path.suffix.lower()
    if ext == ".pdf":
        with PDF_LOCK:
            return parse_pdf(path)
    if ext in {".png", ".jpg", ".jpeg", ".tif", ".tiff"}:
        return parse_image(path)
    return parse_text(path)
