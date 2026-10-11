"""OCR fallback for scanned pages and images (Tesseract via pytesseract).

A missing Tesseract binary degrades gracefully: the parser records a warning instead of failing.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from config import get_settings


@dataclass(slots=True)
class OcrResult:
    text: str
    confidence: float  # 0..1


@lru_cache
def _tesseract_available() -> bool:
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        return True
    except Exception:  # noqa: BLE001 - binary missing or not on PATH
        return False


def ocr_available() -> bool:
    return get_settings().ocr_engine != "none" and _tesseract_available()


def ocr_image(image) -> OcrResult:  # PIL.Image
    """Greyscale + autocontrast + sharpen, then Tesseract with word-level confidences."""
    import pytesseract
    from PIL import ImageFilter, ImageOps

    prepared = ImageOps.autocontrast(ImageOps.grayscale(image)).filter(ImageFilter.SHARPEN)
    data = pytesseract.image_to_data(prepared, config="--psm 6", output_type=pytesseract.Output.DICT)
    confs = [float(c) for c in data.get("conf", []) if str(c) not in {"-1", ""}]
    text = pytesseract.image_to_string(prepared, config="--psm 6")
    return OcrResult(text, round(sum(confs) / len(confs) / 100, 3) if confs else 0.0)
