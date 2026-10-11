"""Shared API dependencies: DB session, current user, role guards, client IP, login rate limiting."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.errors import AuthError, CredXError, ForbiddenError, NotFoundError
from core.security import Role, decode_access_token, role_at_least
from database.session import get_db
from models import CreditCase, User

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise AuthError("Authentication required")
    claims = decode_access_token(creds.credentials)
    user = db.get(User, claims["sub"])
    if user is None or not user.is_active:
        raise AuthError("User not found or disabled")
    return user


def require_role(minimum: Role):
    def guard(user: User = Depends(get_current_user)) -> User:
        if not role_at_least(user.role, minimum):
            raise ForbiddenError(f"Requires {minimum.value.replace('_', ' ')} role or higher")
        return user
    return guard


Analyst = Depends(require_role(Role.ANALYST))
Manager = Depends(require_role(Role.CREDIT_MANAGER))
Admin = Depends(require_role(Role.ADMIN))
AnyUser = Depends(get_current_user)


def get_case_or_404(db: Session, case_id: str) -> CreditCase:
    case = db.get(CreditCase, case_id)
    if case is None:
        raise NotFoundError("Case not found")
    return case


def client_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None)


class RateLimitError(CredXError):
    status_code = 429
    code = "rate_limited"


class SlidingWindowLimiter:
    """Per-key in-memory limiter (per-instance; put a Redis limiter in front for multi-replica)."""

    def __init__(self, limit: int, window_s: float) -> None:
        self.limit, self.window = limit, window_s
        self.hits: dict[str, deque[float]] = defaultdict(deque)
        self.lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self.lock:
            q = self.hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                raise RateLimitError("Too many attempts, please wait a minute")
            q.append(now)


login_limiter = SlidingWindowLimiter(limit=10, window_s=60)
