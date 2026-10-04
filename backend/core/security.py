"""Password hashing (PBKDF2-SHA256, stdlib) and JWT issuance/verification."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

import jwt

from config import get_settings

from .errors import AuthenticationError

_PBKDF2_ITERATIONS = 390_000
_SCHEME = "pbkdf2_sha256"


class Role(str, Enum):
    ADMIN = "admin"
    CREDIT_MANAGER = "credit_manager"
    ANALYST = "analyst"
    VIEWER = "viewer"


# Higher rank inherits the permissions of lower ranks.
ROLE_RANK = {Role.VIEWER: 0, Role.ANALYST: 1, Role.CREDIT_MANAGER: 2, Role.ADMIN: 3}


def role_at_least(role: str, minimum: Role) -> bool:
    try:
        return ROLE_RANK[Role(role)] >= ROLE_RANK[minimum]
    except ValueError:
        return False


def hash_password(password: str, *, iterations: int = _PBKDF2_ITERATIONS) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return "$".join(
        [_SCHEME, str(iterations), base64.b64encode(salt).decode(), base64.b64encode(digest).decode()]
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_b64, digest_b64 = stored.split("$")
    except ValueError:
        return False
    if scheme != _SCHEME:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt_b64), int(iterations))
    return hmac.compare_digest(digest, base64.b64decode(digest_b64))


def create_access_token(subject: str, *, role: str, extra: dict[str, Any] | None = None) -> tuple[str, int]:
    settings = get_settings()
    expires_in = settings.access_token_minutes * 60
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
        "iss": "credx",
        **(extra or {}),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), expires_in


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm], issuer="credx")
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Session expired, please sign in again") from exc
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Invalid authentication token") from exc
