"""Claude via the official Anthropic Python SDK.

Defaults: ``claude-opus-5-5`` (adaptive thinking is always on for this model;
depth is controlled with ``output_config.effort``) and server-side refusal
fallbacks (``fallbacks="default"``) so a safety decline is re-routed instead of
failing the copilot turn.
"""

from __future__ import annotations

import time

from config import get_settings

from .base import LLMRequest, LLMResponse, ProviderError


class AnthropicProvider:
    name = "anthropic"

    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.anthropic_model
        self._client = None
        if settings.anthropic_api_key:
            try:
                import anthropic

                self._client = anthropic.Anthropic(
                    api_key=settings.anthropic_api_key,
                    timeout=settings.llm_timeout_seconds,
                    max_retries=2,  # SDK retries 408/409/429/5xx with backoff
                )
            except ImportError:
                self._client = None

    def available(self) -> bool:
        return self._client is not None

    def complete(self, request: LLMRequest) -> LLMResponse:
        import anthropic

        settings = get_settings()
        assert self._client is not None
        started = time.perf_counter()
        try:
            response = self._client.beta.messages.create(
                model=self.model,
                max_tokens=request.max_tokens or settings.llm_max_tokens,
                system=request.system,
                messages=[m.model_dump() for m in request.messages],
                output_config={"effort": settings.anthropic_effort},
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
        except anthropic.RateLimitError as exc:
            raise ProviderError(f"Anthropic rate limited: {exc.message}", retryable=True) from exc
        except anthropic.APIStatusError as exc:
            raise ProviderError(f"Anthropic API error {exc.status_code}: {exc.message}",
                                retryable=exc.status_code >= 500) from exc
        except anthropic.APIConnectionError as exc:
            raise ProviderError("Anthropic connection error", retryable=True) from exc

        if response.stop_reason == "refusal":
            category = getattr(response.stop_details, "category", None) if response.stop_details else None
            raise ProviderError(f"Claude declined the request (category: {category})", retryable=False)

        text = "".join(block.text for block in response.content if block.type == "text").strip()
        if not text:
            raise ProviderError("Claude returned no text content", retryable=True)
        return LLMResponse(
            text=text,
            provider=self.name,
            model=response.model,
            prompt_tokens=response.usage.input_tokens,
            completion_tokens=response.usage.output_tokens,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
