"""High-level AI tasks used by the API and the CAM generator."""

from __future__ import annotations

from typing import Any

from ai.orchestration.router import get_router
from ai.prompts.templates import CAM_NARRATIVE_SYSTEM, COPILOT_SYSTEM, RESEARCH_SUMMARY_SYSTEM, render
from ai.providers.base import ChatMessage, LLMError, LLMRequest, LLMResult


def answer_question(context: dict[str, Any], history: list[ChatMessage], question: str,
                    case_id: str | None, user_id: str | None) -> LLMResult:
    request = LLMRequest(
        system=render(COPILOT_SYSTEM, case_data=context),
        messages=[*history[-10:], ChatMessage("user", question)],
        max_tokens=1600,
        purpose="copilot",
        context=context,
    )
    return get_router().complete(request, case_id=case_id, user_id=user_id)


def cam_narrative(context: dict[str, Any], case_id: str | None, user_id: str | None) -> LLMResult:
    request = LLMRequest(
        system=render(CAM_NARRATIVE_SYSTEM, case_data=context),
        messages=[ChatMessage("user", "Write the CAM executive summary paragraph.")],
        max_tokens=700,
        purpose="cam_narrative",
        context=context,
    )
    return get_router().complete(request, case_id=case_id, user_id=user_id)


def research_summary(findings: list[dict[str, Any]], draft: str, case_id: str | None) -> tuple[str, str]:
    """LLM-polished research summary when a remote provider exists; deterministic draft otherwise."""
    request = LLMRequest(
        system=render(RESEARCH_SUMMARY_SYSTEM, findings=[{k: f.get(k) for k in ("title", "snippet", "source", "category", "severity")} for f in findings[:20]]),
        messages=[ChatMessage("user", "Summarise these findings.")],
        max_tokens=500,
        purpose="research_summary",
        context={"draft_summary": draft},
    )
    try:
        result = get_router().complete(request, case_id=case_id, allow_local=False)
        return result.text, result.provider
    except LLMError:
        return draft, "local"
