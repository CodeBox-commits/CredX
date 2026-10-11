"""Dependency-free Prometheus metrics (text exposition format at ``/metrics``).

Mirrors the slice of the prometheus_client API we use:
``METRIC.labels(*values).inc()`` and ``METRIC.labels(*values).observe(seconds)``.
"""

from __future__ import annotations

import threading
from collections import defaultdict

_DEFAULT_BUCKETS = (0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0)
CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8"


def _fmt(names: tuple[str, ...], values: tuple[str, ...], extra: dict[str, str] | None = None) -> str:
    pairs = [*zip(names, values), *(extra or {}).items()]
    if not pairs:
        return ""
    return "{" + ",".join(f'{k}="{str(v).replace(chr(34), "")}"' for k, v in pairs) + "}"


class _Metric:
    kind = ""

    def __init__(self, name: str, help_text: str, labelnames: tuple[str, ...] = ()) -> None:
        self.name, self.help, self.labelnames = name, help_text, labelnames
        self._lock = threading.Lock()

    def _key(self, values: tuple[object, ...]) -> tuple[str, ...]:
        if len(values) != len(self.labelnames):
            raise ValueError(f"{self.name} expects labels {self.labelnames}")
        return tuple(str(v) for v in values)

    def header(self) -> list[str]:
        return [f"# HELP {self.name} {self.help}", f"# TYPE {self.name} {self.kind}"]


class Counter(_Metric):
    kind = "counter"

    def __init__(self, name: str, help_text: str, labelnames: tuple[str, ...] = ()) -> None:
        super().__init__(name, help_text, labelnames)
        self._values: dict[tuple[str, ...], float] = defaultdict(float)

    def labels(self, *values: object) -> _CounterChild:
        return _CounterChild(self, self._key(values))

    def render(self) -> list[str]:
        return self.header() + [f"{self.name}{_fmt(self.labelnames, k)} {v}" for k, v in self._values.items()]


class _CounterChild:
    def __init__(self, parent: Counter, key: tuple[str, ...]) -> None:
        self.parent, self.key = parent, key

    def inc(self, amount: float = 1.0) -> None:
        with self.parent._lock:
            self.parent._values[self.key] += amount


class Histogram(_Metric):
    kind = "histogram"

    def __init__(self, name: str, help_text: str, labelnames: tuple[str, ...] = (),
                 buckets: tuple[float, ...] = _DEFAULT_BUCKETS) -> None:
        super().__init__(name, help_text, labelnames)
        self.buckets = buckets
        self._counts: dict[tuple[str, ...], list[int]] = {}
        self._sums: dict[tuple[str, ...], float] = defaultdict(float)

    def labels(self, *values: object) -> _HistogramChild:
        return _HistogramChild(self, self._key(values))

    def render(self) -> list[str]:
        lines = self.header()
        for key, counts in self._counts.items():
            for bound, count in zip(self.buckets, counts):
                lines.append(f"{self.name}_bucket{_fmt(self.labelnames, key, {'le': str(bound)})} {count}")
            lines.append(f"{self.name}_bucket{_fmt(self.labelnames, key, {'le': '+Inf'})} {counts[-1]}")
            lines.append(f"{self.name}_sum{_fmt(self.labelnames, key)} {self._sums[key]}")
            lines.append(f"{self.name}_count{_fmt(self.labelnames, key)} {counts[-1]}")
        return lines


class _HistogramChild:
    def __init__(self, parent: Histogram, key: tuple[str, ...]) -> None:
        self.parent, self.key = parent, key

    def observe(self, value: float) -> None:
        p = self.parent
        with p._lock:
            counts = p._counts.setdefault(self.key, [0] * (len(p.buckets) + 1))
            for i, bound in enumerate(p.buckets):
                if value <= bound:
                    counts[i] += 1
            counts[-1] += 1
            p._sums[self.key] += value


HTTP_REQUESTS = Counter("credx_http_requests_total", "HTTP requests by method, route and status", ("method", "path", "status"))
HTTP_LATENCY = Histogram("credx_http_request_duration_seconds", "HTTP request latency", ("method", "path"))
JOBS = Counter("credx_jobs_total", "Background jobs by kind and final status", ("kind", "status"))
JOB_LATENCY = Histogram("credx_job_duration_seconds", "Background job duration", ("kind",),
                        (0.5, 1, 2.5, 5, 10, 30, 60, 120, 300))
DOCUMENTS = Counter("credx_documents_total", "Ingested documents by type and outcome", ("doc_type", "status"))
LLM_TOKENS = Counter("credx_llm_tokens_total", "LLM tokens by provider and direction", ("provider", "direction"))
LLM_CALLS = Counter("credx_llm_calls_total", "LLM calls by provider and outcome", ("provider", "outcome"))

_ALL = (HTTP_REQUESTS, HTTP_LATENCY, JOBS, JOB_LATENCY, DOCUMENTS, LLM_TOKENS, LLM_CALLS)


def render_metrics() -> tuple[str, str]:
    lines: list[str] = []
    for metric in _ALL:
        lines.extend(metric.render())
    return "\n".join(lines) + "\n", CONTENT_TYPE
