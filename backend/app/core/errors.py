from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": "validation_error",
                "detail": exc.errors(),
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(
        _request: Request,
        exc: HTTPException,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "http_error", "detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        _request: Request,
        exc: Exception,
    ) -> JSONResponse:
        logger.exception("Unhandled backend exception")
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_server_error",
                "detail": str(exc),
            },
        )
