"""Domain exceptions and the API error envelope.

Every error leaves the API as::

    {"error": {"code": "not_found", "message": "...", "details": {...}, "request_id": "..."}}
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from core.logging import get_logger, request_id_var

log = get_logger("credx.errors")


class CredXError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}
        if code:
            self.code = code


class AuthError(CredXError):
    status_code = 401
    code = "unauthorized"


class ForbiddenError(CredXError):
    status_code = 403
    code = "forbidden"


class NotFoundError(CredXError):
    status_code = 404
    code = "not_found"


class ConflictError(CredXError):
    status_code = 409
    code = "conflict"


class ValidationFailed(CredXError):
    status_code = 422
    code = "validation_failed"


class UpstreamError(CredXError):
    status_code = 502
    code = "upstream_error"


_HTTP_CODES = {
    400: "bad_request", 401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "method_not_allowed",
    409: "conflict", 413: "payload_too_large", 429: "rate_limited",
}


def _envelope(status: int, code: str, message: str, details: Any = None) -> JSONResponse:
    body: dict[str, Any] = {"error": {"code": code, "message": message, "request_id": request_id_var.get()}}
    if details:
        body["error"]["details"] = details
    return JSONResponse(status_code=status, content=body)


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(CredXError)
    async def _domain(_: Request, exc: CredXError) -> JSONResponse:
        if exc.status_code >= 500:
            log.error("domain error", extra={"code": exc.code, "error": exc.message})
        return _envelope(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _envelope(exc.status_code, _HTTP_CODES.get(exc.status_code, "http_error"), str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        issues = [
            {"field": ".".join(str(p) for p in err.get("loc", []) if p != "body"), "message": err.get("msg")}
            for err in exc.errors()
        ]
        message = "; ".join(f"{i['field']}: {i['message']}" if i["field"] else str(i["message"]) for i in issues[:3])
        return _envelope(422, "validation_failed", message or "Request validation failed", {"issues": issues})

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled exception", extra={"error_type": type(exc).__name__})
        return _envelope(500, "internal_error", "An unexpected error occurred. It has been logged.")
