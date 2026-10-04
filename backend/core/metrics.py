"""Dependency-free Prometheus metrics registry.

Exposes counters and histograms in the Prometheus text format at ``/metrics`` so a
Prometheus/Grafana stack can scrape CredX without extra packages.
"""

from __future__ import annotations

import threading
from collections import defaultdict

_DEFAULT_BUCKETS = (0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0)


def _labels(labels: dict[str, str]) -> str:
    if not labels:
        return ""
    inner = ",".join(f'{k}="{str(v).replace(chr(34), "")}"' for k, v in sorted(labels.items()))
    return "{" + inner + "}"


class Counter:
    def __init__(self, name: str, help_text: str) -> None:
        self.name, self.help = name, help_text
        self._values: dict[tuple, float] = defaultdict(float)
        self._lock = threading.Lock()

    def inc(self, amount: float = 1.0, **labels: str) -> None:
        with self._lock:
            self._values[tuple(sorted(labels.items()))] += amount

    def render(self) -> list[str]:
        lines = [f"# HELP {self.name} {self.help}", f"# TYPE {self.name} counter"]
        for key, value in self._values.items():
            lines.append(f"{self.name}{_labels(dict(key))} {value}")
        return lines


class Histogram:
    def __init__(self, name: str, help_text: str, buckets: tuple[float, ...] = _DEFAULT_BUCKETS) -> None:
        self.name, self.help, self.buckets = name, help_text, buckets
        self._counts: dict[tuple, list[int]] = {}
        self._sums: dict[tuple, float] = defaultdict(float)
        self._lock = threading.Lock()

    def observe(self, value: float, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        with self._lock:
            counts = self._counts.setdefault(key, [0] * (len(self.buckets) + 1))
            for i, bound in enumerate(self.buckets):
                if value <= bound:
                    counts[i] += 1
            counts[-1] += 1
            self._sums[key] += value

    def render(self) -> list[str]:
        lines = [f"# HELP {self.name} {self.help}", f"# TYPE {self.name} histogram"]
        for key, counts in self._counts.items():
            labels = dict(key)
            for bound, count in zip(self.buckets, counts):
                lines.append(f"{self.name}_bucket{_labels({**labels, 'le': str(bound)})} {count}")
            lines.append(f"{self.name}_bucket{_labels({**labels, 'le': '+Inf'})} {counts[-1]}")
            lines.append(f"{self.name}_sum{_labels(labels)} {self._sums[key]}")
            lines.append(f"{self.name}_count{_labels(labels)} {counts[-1]}")
        return lines


HTTP_REQUESTS = Counter("credx_http_requests_total", "HTTP requests by method, route and status")
HTTP_LATENCY = Histogram("credx_http_request_duration_seconds", "HTTP request latency")
JOBS = Counter("credx_jobs_total", "Background jobs by kind and final status")
JOB_LATENCY = Histogram("credx_job_duration_seconds", "Background job duration", (0.5, 1, 2.5, 5, 10, 30, 60, 120))
LLM_TOKENS = Counter("credx_llm_tokens_total", "LLM tokens consumed by provider and direction")
EXTRACTIONS = Counter("credx_document_extractions_total", "Document extractions by type and OCR usage")

_ALL = [HTTP_REQUESTS, HTTP_LATENCY, JOBS, JOB_LATENCY, LLM_TOKENS, EXTRACTIONS]


def render_metrics() -> str:
    lines: list[str] = []
    for metric in _ALL:
        lines.extend(metric.render())
    return "\n".join(lines) + "\n"
