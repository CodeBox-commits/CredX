from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/platform")
def platform_overview() -> dict[str, object]:
    return {
        "name": "CredX",
        "capabilities": [
            "document-ingestion",
            "research-intelligence",
            "fraud-graph",
            "credit-decisioning",
            "cam-preview",
            "copilot",
        ],
        "mode": "foundation",
    }
