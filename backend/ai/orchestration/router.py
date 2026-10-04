"""Provider router: ordered fallback chain, retries on transient errors, token accounting."""

from __future__ import annotations

from collections.abc import Callable

from config import get_settings
from core.logging import get_logger
from core.metrics import LLM_TOKENS

from ..providers.anthropic_provider import AnthropicProvider
from ..providers.base import LLMProvider, LLMRequest, LLMResponse, ProviderError
from ..providers.http_providers import GeminiProvider, OpenAIProvider
from ..providers.local_provider import LocalProvider

logger = get_logger("credx.ai.router")
UsageRecorder = Callable[[LLMRequest, LLMResponse | None, str, str | None], None]

_REGISTRY: dict[str, type] = {
    "anthropic": AnthropicProvider, "openai": OpenAIProvider, "gemini": GeminiProvider, "local": LocalProvider,
}


class LLMRouter:
    def __init__(self, providers: list[LLMProvider] | None = None, recorder: UsageRecorder | None = None) -> None:
        if providers is None:
            order = get_settings().llm_provider_order
            providers = [_REGISTRY[name]() for name in order if name in _REGISTRY]
            if not any(p.name == "local" for p in providers):
                providers.append(LocalProvider())
        self.providers = providers
        self.recorder = recorder

    def generate(self, request: LLMRequest) -> LLMResponse:
        failed_from: str | None = None
        for provider in self.providers:
            if not provider.available():
                continue
            for attempt in range(2):
                try:
                    response = provider.complete(request)
                    response.fallback_from = failed_from
                    LLM_TOKENS.inc(response.prompt_tokens, provider=provider.name, direction="input")
                    LLM_TOKENS.inc(response.completion_tokens, provider=provider.name, direction="output")
                    if self.recorder:
                        self.recorder(request, response, provider.name, None)
                    return response
                except ProviderError as exc:
                    logger.warning("llm_provider_failed", extra={"provider": provider.name, "attempt": attempt, "error": str(exc)})
                    if self.recorder:
                        self.recorder(request, None, provider.name, str(exc))
                    if not exc.retryable:
                        break
            failed_from = failed_from or provider.name
        # LocalProvider is always available, so this is unreachable in practice.
        raise ProviderError("No LLM provider could complete the request")
