from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/platform")
def platform_overview() -> dict[str, object]:
    return {
        "name": "CredX",
        "capabilities": [
            "document-ingestion",
            "case-persistence",
            "research-intelligence",
            "fraud-graph",
            "credit-decisioning",
            "cam-preview",
            "copilot",
            "workflow-jobs",
        ],
        "mode": "durable-foundation",
    }
