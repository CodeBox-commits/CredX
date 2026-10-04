from __future__ import annotations

from fastapi import APIRouter

from ...ai.orchestration.copilot import generate_copilot_response
from ...schemas.platform import CopilotRequest, CopilotResponse

router = APIRouter()


@router.post("/chat", response_model=CopilotResponse)
def copilot_chat(request: CopilotRequest) -> CopilotResponse:
    return generate_copilot_response(request.question, request.context)
