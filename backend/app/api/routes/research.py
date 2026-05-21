from __future__ import annotations

from fastapi import APIRouter

from ...research.summarization.service import build_research_intelligence
from ...schemas.platform import (
    ResearchIntelligenceRequest,
    ResearchIntelligenceResponse,
)

router = APIRouter()


@router.post("/intelligence", response_model=ResearchIntelligenceResponse)
def research_intelligence(
    request: ResearchIntelligenceRequest,
) -> ResearchIntelligenceResponse:
    return build_research_intelligence(request)
