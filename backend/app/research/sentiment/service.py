from __future__ import annotations

from ...schemas.uploads import StructuredExtraction


def assess_promoter_sentiment(
    extracted: StructuredExtraction | None,
    analyst_note: str | None,
) -> str:
    note = (analyst_note or "").lower()
    indicators = extracted.risk_indicators if extracted else []
    if "fraud" in note or "weak" in note or "related-party" in " ".join(indicators).lower():
        return "NEGATIVE"
    if "improved" in note or "order book" in note:
        return "POSITIVE"
    return "NEUTRAL"
