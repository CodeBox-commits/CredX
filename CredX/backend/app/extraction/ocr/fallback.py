from __future__ import annotations

from pathlib import Path


def run_ocr_fallback(file_path: Path) -> tuple[str, int]:
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except Exception:
        return "", 0

    try:
        images = convert_from_path(str(file_path), dpi=200)
        text_parts = [pytesseract.image_to_string(image) for image in images]
        text = "\n".join(part.strip() for part in text_parts if part.strip())
        return text, len(images)
    except Exception:
        return "", 0
