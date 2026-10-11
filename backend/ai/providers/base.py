"""Provider-agnostic LLM contract shared by every provider and the router."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


class LLMError(RuntimeError):
    """A provider could not produce an answer (network, quota, refusal, empty output)."""


@dataclass
class ChatMessage:
    role: str  # "user" | "assistant"
    content: str


@dataclass
class LLMRequest:
    system: str
    messages: list[ChatMessage]
    max_tokens: int = 1200
    purpose: str = "general"  # copilot | cam_narrative | research_summary
    # Structured case context. Remote providers see it rendered in the system prompt;
    # the local provider reasons over it directly.
    context: dict[str, Any] = field(default_factory=dict)


@dataclass
class LLMResult:
    text: str
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0.0
    fallback_used: bool = False


class LLMProvider(Protocol):
    name: str

    def available(self) -> bool: ...
    def complete(self, request: LLMRequest) -> LLMResult: ...
