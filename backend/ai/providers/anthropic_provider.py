"""Claude via the official Anthropic SDK (default model: claude-opus-5-5)."""

from __future__ import annotations

import time

from ai.providers.base import LLMError, LLMRequest, LLMResult
from config import get_settings


class AnthropicProvider:
    name = "anthropic"

    def __init__(self) -> None:
        self.settings = get_settings()
        self._client = None

    def available(self) -> bool:
        if not self.settings.anthropic_api_key:
            return False
        try:
            import anthropic  # noqa: F401
        except ImportError:
            return False
        return True

    def _get_client(self):
        if self._client is None:
            import anthropic

            # The SDK retries 408/409/429/5xx with backoff on its own.
            self._client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key, timeout=self.settings.ai_timeout_s,
                                               max_retries=2)
        return self._client

    def complete(self, request: LLMRequest) -> LLMResult:
        import anthropic

        started = time.perf_counter()
        try:
            response = self._get_client().messages.create(
                model=self.settings.anthropic_model,
                max_tokens=max(request.max_tokens, self.settings.llm_max_tokens),
                system=request.system,
                messages=[{"role": m.role, "content": m.content} for m in request.messages],
                output_config={"effort": self.settings.anthropic_effort},
            )
        except anthropic.APIError as exc:
            raise LLMError(f"anthropic error: {exc}") from exc
        if response.stop_reason == "refusal":
            raise LLMError("Claude declined the request")
        text = "".join(block.text for block in response.content if block.type == "text").strip()
        if not text:
            raise LLMError("anthropic returned no text")
        return LLMResult(text, self.name, response.model, response.usage.input_tokens, response.usage.output_tokens,
                         round((time.perf_counter() - started) * 1000, 1))
