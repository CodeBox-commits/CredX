"""Structured logging with request / job correlation ids.

``request_id_var`` is set by the request-context middleware and ``job_id_var`` by the job
runner, so every log line emitted while serving a request or running a job carries its id.
"""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
job_id_var: ContextVar[str | None] = ContextVar("job_id", default=None)

_RESERVED = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {"message", "asctime", "request_id", "job_id"}


class _ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        record.job_id = job_id_var.get()
        return True


def _extras(record: logging.LogRecord) -> dict[str, object]:
    return {k: v for k, v in record.__dict__.items() if k not in _RESERVED and not k.startswith("_")}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key in ("request_id", "job_id"):
            if value := getattr(record, key, None):
                payload[key] = value
        payload.update(_extras(record))
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class ConsoleFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        cid = getattr(record, "request_id", None) or getattr(record, "job_id", None)
        prefix = f"[{cid[:8]}] " if cid else ""
        extras = " ".join(f"{k}={v}" for k, v in _extras(record).items())
        return f"{prefix}{base}" + (f" | {extras}" if extras else "")


_configured = False


def configure_logging(level: str = "INFO", json_logs: bool = False) -> None:
    global _configured
    if _configured:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_ContextFilter())
    handler.setFormatter(
        JsonFormatter() if json_logs else ConsoleFormatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s", "%H:%M:%S")
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
    for noisy in ("pdfminer", "camelot", "PIL", "httpx", "httpcore", "urllib3", "matplotlib", "numba", "fontTools"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    _configured = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
