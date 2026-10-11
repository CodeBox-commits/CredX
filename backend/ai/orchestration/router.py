"""Multi-provider router: ordered fallback chain ending at the always-available local provider.

Every call is metered (Prometheus counters + an ``ai_usage`` row) so the dashboard can show
token spend per provider.
"""

from __future__ import annotations

from datetime import UTC, datetime
from functools import lru_cache

from ai.providers.anthropic_provider import AnthropicProvider
from ai.providers.base import LLMError, LLMProvider, LLMRequest, LLMResult
from ai.providers.gemini_provider import GeminiProvider
from ai.providers.local_provider import LocalProvider
from ai.providers.openai_provider import OpenAIProvider
from config import get_settings
from core.logging import get_logger
from core.metrics import LLM_CALLS, LLM_TOKENS

log = get_logger("credx.ai")

_REGISTRY: dict[str, type] = {
    "anthropic": AnthropicProvider, "openai": OpenAIProvider, "gemini": GeminiProvider, "local": LocalProvider,
}


class AIRouter:
    def __init__(self, order: list[str] | None = None) -> None:
        names = [n for n in (order or get_settings().llm_provider_order) if n in _REGISTRY and n != "local"]
        self.providers: list[LLMProvider] = [_REGISTRY[n]() for n in dict.fromkeys(names)]
        self.providers.append(LocalProvider())  # deterministic, grounded last resort

    def active_providers(self) -> list[str]:
        return [p.name for p in self.providers if p.available()]

    def complete(self, request: LLMRequest, *, case_id: str | None = None, user_id: str | None = None,
                 allow_local: bool = True) -> LLMResult:
        errors: list[str] = []
        for provider in self.providers:
            if provider.name == "local" and not allow_local:
                continue
            if not provider.available():
                continue
            try:
                result = provider.complete(request)
            except LLMError as exc:
                log.warning("llm provider failed", extra={"provider": provider.name, "error": str(exc)[:300]})
                LLM_CALLS.labels(provider.name, "error").inc()
                _record(request, provider.name, None, case_id, user_id, str(exc))
                errors.append(f"{provider.name}: {exc}")
                continue
            result.fallback_used = bool(errors)
            LLM_CALLS.labels(provider.name, "ok").inc()
            LLM_TOKENS.labels(provider.name, "input").inc(result.input_tokens)
            LLM_TOKENS.labels(provider.name, "output").inc(result.output_tokens)
            _record(request, provider.name, result, case_id, user_id, None)
            return result
        raise LLMError("; ".join(errors) or "no AI provider available")


def _record(request: LLMRequest, provider: str, result: LLMResult | None, case_id: str | None, user_id: str | None,
            error: str | None) -> None:
    """Best-effort usage accounting in its own transaction; never breaks the caller."""
    try:
        from database.session import session_scope
        from models import AiUsage

        with session_scope() as db:
            db.add(AiUsage(created_at=datetime.now(UTC), provider=provider, model=result.model if result else "",
                           purpose=request.purpose, case_id=case_id, user_id=user_id,
                           input_tokens=result.input_tokens if result else 0, output_tokens=result.output_tokens if result else 0,
                           latency_ms=result.latency_ms if result else 0, success=result is not None,
                           error=(error or "")[:500] or None))
    except Exception as exc:  # noqa: BLE001
        log.debug("ai usage not recorded", extra={"error": str(exc)[:200]})


@lru_cache
def get_router() -> AIRouter:
    return AIRouter()
