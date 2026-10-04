"""Google Gemini provider via the public REST endpoint (optional, no extra SDK dependency)."""

from __future__ import annotations

import time

import httpx

from ai.providers.base import LLMError, LLMRequest, LLMResult
from config import get_settings


class GeminiProvider:
    name = "gemini"

    def __init__(self) -> None:
        self.settings = get_settings()

    def available(self) -> bool:
        return bool(self.settings.gemini_api_key)

    def complete(self, request: LLMRequest) -> LLMResult:
        started = time.perf_counter()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.settings.gemini_model}:generateContent"
        body = {
            "systemInstruction": {"parts": [{"text": request.system}]},
            "contents": [
                {"role": "model" if m.role == "assistant" else "user", "parts": [{"text": m.content}]}
                for m in request.messages
            ],
            "generationConfig": {"maxOutputTokens": request.max_tokens},
        }
        try:
            resp = httpx.post(url, json=body, headers={"x-goog-api-key": self.settings.gemini_api_key or ""},
                              timeout=self.settings.ai_timeout_s)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise LLMError(f"gemini error: {exc}") from exc
        data = resp.json()
        try:
            text = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"]).strip()
        except (KeyError, IndexError) as exc:
            raise LLMError("gemini returned no candidates") from exc
        usage = data.get("usageMetadata", {})
        return LLMResult(text, self.name, self.settings.gemini_model, usage.get("promptTokenCount", 0),
                         usage.get("candidatesTokenCount", 0), round((time.perf_counter() - started) * 1000, 1))
