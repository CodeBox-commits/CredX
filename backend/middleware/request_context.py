"""Request middleware: correlation id, access log, latency metrics, security headers."""

from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.logging import get_logger, request_id_var
from core.metrics import HTTP_LATENCY, HTTP_REQUESTS

log = get_logger("credx.http")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        token = request_id_var.set(rid)
        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
        finally:
            elapsed = time.perf_counter() - start
            route = request.scope.get("route")
            path = getattr(route, "path", "unmatched")
            HTTP_REQUESTS.labels(request.method, path, str(status)).inc()
            HTTP_LATENCY.labels(request.method, path).observe(elapsed)
            if path not in ("/health", "/metrics"):
                log.info("request", extra={"method": request.method, "path": path, "status": status, "ms": round(elapsed * 1000, 1)})
            request_id_var.reset(token)
        response.headers["X-Request-ID"] = rid
        response.headers["Server-Timing"] = f"app;dur={elapsed * 1000:.1f}"
        for k, v in SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        return response
