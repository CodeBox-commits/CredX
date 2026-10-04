from ai.orchestration.router import AIRouter
from ai.providers.base import ChatMessage, LLMError, LLMRequest, LLMResult


class Failing:
    name = "anthropic"

    def available(self):
        return True

    def complete(self, request):
        raise LLMError("simulated outage")


class Working:
    name = "openai"

    def available(self):
        return True

    def complete(self, request):
        return LLMResult("remote answer", "openai", "test-model", 10, 5, 1.0)


def _req():
    return LLMRequest(system="s", messages=[ChatMessage("user", "summarise")], context={"company": {"name": "X Ltd"}})


def test_router_falls_back_in_order():
    router = AIRouter(order=["local"])
    router.providers = [Failing(), Working(), *router.providers]
    result = router.complete(_req())
    assert result.provider == "openai" and result.fallback_used


def test_router_ends_at_local_provider():
    router = AIRouter(order=["local"])
    router.providers = [Failing(), *router.providers]
    result = router.complete(_req())
    assert result.provider == "local" and result.output_tokens > 0


def test_local_only_disallowed_raises():
    router = AIRouter(order=["local"])
    try:
        router.complete(_req(), allow_local=False)
    except LLMError:
        return
    raise AssertionError("expected LLMError")
