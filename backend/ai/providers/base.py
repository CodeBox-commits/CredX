"""Provider-agnostic LLM interface."""

from __future__ import annotations

from typing import Any, Literal, Protocol

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class LLMRequest(BaseModel):
    purpose: str  # copilot | cam_narrative | risk_explanation | document_summary | research_summary
    system: str
    messages: list[ChatMessage]
    max_tokens: int | None = None
    # Structured case context; LLM providers see it rendered inside the prompt,
    # the local provider reasons over it directly.
    context: dict[str, Any] = Field(default_factory=dict)
    case_id: str | None = None
    user_id: str | None = None


class LLMResponse(BaseModel):
    text: str
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0
    fallback_from: str | None = None
    citations: list[dict[str, Any]] = Field(default_factory=list)


class ProviderError(RuntimeError):
    def __init__(self, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


class LLMProvider(Protocol):
    name: str
    model: str

    def available(self) -> bool: ...
    def complete(self, request: LLMRequest) -> LLMResponse: ...
