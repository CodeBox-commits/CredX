"""Append-only audit trail helper."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from core.logging import request_id_var
from models import AuditLog, User


def audit(
    db: Session,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    case_id: str | None = None,
    summary: str | None = None,
    details: dict[str, Any] | None = None,
    ip: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        created_at=datetime.now(UTC),
        actor_id=actor.id if actor else None,
        actor_email=actor.email if actor else "system",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        case_id=case_id,
        summary=(summary or "")[:500] or None,
        details=details or {},
        ip_address=ip,
        request_id=request_id_var.get(),
    )
    db.add(entry)
    return entry
