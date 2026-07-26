from __future__ import annotations

SECTOR_OUTLOOK = {
    "infrastructure": "WEAK",
    "construction": "WEAK",
    "real estate": "WEAK",
    "textiles": "WEAK",
    "nbfc": "STABLE",
    "manufacturing": "STABLE",
    "renewable energy": "FAVORABLE",
    "pharma": "FAVORABLE",
    "it": "FAVORABLE",
}


def assess_sector_outlook(sector: str) -> str:
    lowered = sector.lower()
    for key, value in SECTOR_OUTLOOK.items():
        if key in lowered:
            return value
    return "STABLE"
