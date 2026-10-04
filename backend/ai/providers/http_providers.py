"""OpenAI and Gemini providers over plain HTTPS (no extra SDK dependencies)."""

from __future__ import annotations

import time

import httpx

from config import get_settings

from .base import LLMRequest, LLMResponse, ProviderError


def _raise_for(resp: httpx.Response, provider: str) -> None:
    if resp.status_code >= 400:
        raise ProviderError(
            f"{provider} error {resp.status_code}: {resp.text[:200]}",
            retryable=resp.status_code == 429 or resp.status_code >= 500,
        )


class OpenAIProvider:
    name = "openai"

    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.openai_model
        self._key = settings.openai_api_key

    def available(self) -> bool:
        return bool(self._key)

    def complete(self, request: LLMRequest) -> LLMResponse:
        settings = get_settings()
        started = time.perf_counter()
        try:
            resp = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self._key}"},
                json={
                    "model": self.model,
                    "max_tokens": min(request.max_tokens or settings.llm_max_tokens, 4096),
                    "messages": [{"role": "system", "content": request.system}]
                    + [m.model_dump() for m in request.messages],
                },
                timeout=settings.llm_timeout_seconds,
            )
        except httpx.HTTPError as exc:
            raise ProviderError(f"OpenAI connection error: {exc}", retryable=True) from exc
        _raise_for(resp, "OpenAI")
        body = resp.json()
        usage = body.get("usage", {})
        return LLMResponse(
            text=body["choices"][0]["message"]["content"].strip(),
            provider=self.name,
            model=body.get("model", self.model),
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            latency_ms=int((time.perf_counter() - started) * 1000),
        )


class GeminiProvider:
    name = "gemini"

    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.gemini_model
        self._key = settings.gemini_api_key

    def available(self) -> bool:
        return bool(self._key)

    def complete(self, request: LLMRequest) -> LLMResponse:
        settings = get_settings()
        started = time.perf_counter()
        contents = [
            {"role": "model" if m.role == "assistant" else "user", "parts": [{"text": m.content}]}
            for m in request.messages
        ]
        try:
            resp = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
                params={"key": self._key},
                json={
                    "systemInstruction": {"parts": [{"text": request.system}]},
                    "contents": contents,
                    "generationConfig": {"maxOutputTokens": min(request.max_tokens or settings.llm_max_tokens, 8192)},
                },
                timeout=settings.llm_timeout_seconds,
            )
        except httpx.HTTPError as exc:
            raise ProviderError(f"Gemini connection error: {exc}", retryable=True) from exc
        _raise_for(resp, "Gemini")
        body = resp.json()
        try:
            text = "".join(p.get("text", "") for p in body["candidates"][0]["content"]["parts"]).strip()
        except (KeyError, IndexError) as exc:
            raise ProviderError("Gemini returned no content", retryable=False) from exc
        usage = body.get("usageMetadata", {})
        return LLMResponse(
            text=text,
            provider=self.name,
            model=self.model,
            prompt_tokens=usage.get("promptTokenCount", 0),
            completion_tokens=usage.get("candidatesTokenCount", 0),
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
