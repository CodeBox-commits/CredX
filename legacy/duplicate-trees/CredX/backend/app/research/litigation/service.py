from __future__ import annotations

from ...schemas.uploads import StructuredExtraction


def assess_litigation_risk(extracted: StructuredExtraction | None, analyst_note: str | None) -> str:
    indicators = extracted.risk_indicators if extracted else []
    note = (analyst_note or "").lower()
    if any("litigation" in indicator.lower() for indicator in indicators) or "nclt" in note or "court" in note:
        return "HIGH"
    if note or indicators:
        return "MEDIUM"
    return "LOW"
