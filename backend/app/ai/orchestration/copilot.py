from __future__ import annotations

from ...schemas.platform import CopilotResponse
from ..providers.base import RuleBasedCopilot


def generate_copilot_response(question: str, context: dict[str, object]) -> CopilotResponse:
    provider = RuleBasedCopilot()
    answer = provider.answer(question, context)
    token_estimate = max(24, len(question.split()) + len(answer.split()))
    return CopilotResponse(
        answer=answer,
        provider=provider.name,
        tokens_used=token_estimate,
    )
