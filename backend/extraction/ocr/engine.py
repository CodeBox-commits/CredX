"""OCR fallback for scanned PDFs and images.

Pages are rasterised with PyMuPDF (no poppler dependency) and recognised with
Tesseract (default) or PaddleOCR. Missing engines degrade gracefully: the
pipeline records a warning instead of failing the upload.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from functools import lru_cache

from config import get_settings
from core.logging import get_logger

logger = get_logger("credx.ocr")


@dataclass(slots=True)
class OcrResult:
    text: str
    confidence: float
    engine: str


class OcrUnavailable(RuntimeError):
    pass


def _preprocess(image):  # type: ignore[no-untyped-def]
    """Greyscale + autocontrast + light sharpening improves Tesseract accuracy on scans."""
    from PIL import ImageFilter, ImageOps

    image = ImageOps.grayscale(image)
    image = ImageOps.autocontrast(image)
    return image.filter(ImageFilter.SHARPEN)


@lru_cache
def _tesseract_available() -> bool:
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        return True
    except Exception:  # noqa: BLE001
        return False


@lru_cache
def _paddle():  # type: ignore[no-untyped-def]
    from paddleocr import PaddleOCR  # type: ignore[import-not-found]

    return PaddleOCR(use_angle_cls=True, lang="en", show_log=False)


def ocr_image_bytes(data: bytes) -> OcrResult:
    from PIL import Image

    image = _preprocess(Image.open(io.BytesIO(data)))
    engine = get_settings().ocr_engine

    if engine == "paddle":
        try:
            import numpy as np

            result = _paddle().ocr(np.array(image.convert("RGB")), cls=True)
            lines = [line[1][0] for block in result or [] for line in block or []]
            confs = [float(line[1][1]) for block in result or [] for line in block or []]
            return OcrResult("\n".join(lines), sum(confs) / len(confs) if confs else 0.0, "paddle")
        except Exception as exc:  # noqa: BLE001
            logger.warning("paddle_ocr_failed", extra={"error": str(exc)})

    if engine != "none" and _tesseract_available():
        import pytesseract

        data_out = pytesseract.image_to_data(image, config="--psm 6", output_type=pytesseract.Output.DICT)
        confs = [float(c) for c in data_out.get("conf", []) if str(c) not in {"-1", ""}]
        text = pytesseract.image_to_string(image, config="--psm 6")
        return OcrResult(text, (sum(confs) / len(confs) / 100) if confs else 0.0, "tesseract")

    raise OcrUnavailable("No OCR engine available (install tesseract-ocr or set CREDX_OCR_ENGINE=paddle)")


def ocr_pdf_page(pdf_bytes: bytes, page_index: int, dpi: int = 300) -> OcrResult:
    import fitz  # PyMuPDF

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        pix = doc[page_index].get_pixmap(dpi=dpi)
        return ocr_image_bytes(pix.tobytes("png"))


def ocr_available() -> bool:
    engine = get_settings().ocr_engine
    if engine == "none":
        return False
    if engine == "paddle":
        try:
            _paddle()
            return True
        except Exception:  # noqa: BLE001
            return _tesseract_available()
    return _tesseract_available()
