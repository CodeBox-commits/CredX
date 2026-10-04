"""OpenAI provider (optional)."""

from __future__ import annotations

import time

from ai.providers.base import LLMError, LLMRequest, LLMResult
from config import get_settings


class OpenAIProvider:
    name = "openai"

    def __init__(self) -> None:
        self.settings = get_settings()

    def available(self) -> bool:
        if not self.settings.openai_api_key:
            return False
        try:
            import openai  # noqa: F401
        except ImportError:
            return False
        return True

    def complete(self, request: LLMRequest) -> LLMResult:
        import openai

        started = time.perf_counter()
        client = openai.OpenAI(api_key=self.settings.openai_api_key, timeout=self.settings.ai_timeout_s, max_retries=2)
        try:
            resp = client.chat.completions.create(
                model=self.settings.openai_model,
                max_tokens=request.max_tokens,
                messages=[{"role": "system", "content": request.system}]
                + [{"role": m.role, "content": m.content} for m in request.messages],
            )
        except openai.OpenAIError as exc:
            raise LLMError(f"openai error: {exc}") from exc
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            raise LLMError("openai returned no content")
        usage = resp.usage
        return LLMResult(text, self.name, resp.model, usage.prompt_tokens if usage else 0,
                         usage.completion_tokens if usage else 0, round((time.perf_counter() - started) * 1000, 1))
