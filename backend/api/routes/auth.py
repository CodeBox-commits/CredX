from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.deps import Admin, AnyUser, client_ip, login_limiter
from config import get_settings
from core.errors import AuthError, ConflictError, ForbiddenError, NotFoundError
from core.security import Role, create_access_token, hash_password, verify_password
from database.session import get_db
from models import User
from schemas.common import LoginRequest, RegisterRequest, TokenOut, UserCreate, UserOut, UserUpdate
from services.audit import audit

router = APIRouter(tags=["auth"])


def _token(user: User) -> TokenOut:
    token, expires = create_access_token(user.id, user.role, {"email": user.email})
    return TokenOut(access_token=token, expires_in=expires, user=UserOut.model_validate(user))


@router.post("/auth/login", response_model=TokenOut)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    ip = client_ip(request)
    login_limiter.check(f"{ip}:{body.email.lower()}")
    user = db.scalars(select(User).where(func.lower(User.email) == body.email.lower())).first()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise AuthError("Invalid email or password", code="invalid_credentials")
    if not user.is_active:
        raise ForbiddenError("Account disabled")
    user.last_login_at = datetime.now(UTC)
    audit(db, user, "auth.login", "user", user.id, summary="Signed in", ip=ip)
    return _token(user)


@router.post("/auth/register", response_model=TokenOut, status_code=201)
def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    if not get_settings().allow_self_signup:
        raise ForbiddenError("Self sign-up is disabled; ask an administrator for an account")
    login_limiter.check(f"register:{client_ip(request)}")
    if db.scalars(select(User).where(func.lower(User.email) == body.email.lower())).first():
        raise ConflictError("An account with this email already exists")
    first_user = db.scalar(select(func.count()).select_from(User)) == 0
    user = User(email=body.email.lower(), full_name=body.full_name, hashed_password=hash_password(body.password),
                role=Role.ADMIN if first_user else Role.ANALYST)
    db.add(user)
    db.flush()
    audit(db, user, "auth.register", "user", user.id, summary=f"Registered as {user.role}", ip=client_ip(request))
    return _token(user)


@router.get("/auth/me", response_model=UserOut)
def me(user: User = AnyUser) -> User:
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Admin) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at)).all())


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db), actor: User = Admin) -> User:
    if db.scalars(select(User).where(func.lower(User.email) == body.email.lower())).first():
        raise ConflictError("An account with this email already exists")
    user = User(email=body.email.lower(), full_name=body.full_name, hashed_password=hash_password(body.password), role=body.role)
    db.add(user)
    db.flush()
    audit(db, actor, "user.create", "user", user.id, summary=f"Created {user.email} as {user.role}")
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: str, body: UserUpdate, db: Session = Depends(get_db), actor: User = Admin) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found")
    changes = body.model_dump(exclude_none=True)
    if user.id == actor.id and ("role" in changes or changes.get("is_active") is False):
        raise ForbiddenError("You cannot change your own role or disable yourself")
    for k, v in changes.items():
        setattr(user, k, v)
    audit(db, actor, "user.update", "user", user.id, summary=f"Updated {user.email}", details=changes)
    return user
