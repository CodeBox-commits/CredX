"""Analyst workflow (notes, overrides, escalations), jobs, audit and AI usage."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base, IdMixin, JSONType, TimestampMixin
from models.core import User
from models.enums import EscalationStatus, JobStatus, NoteKind, OverrideStatus


class AnalystNote(IdMixin, TimestampMixin, Base):
    __tablename__ = "analyst_notes"

    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("analyst_notes.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16), default=NoteKind.NOTE)
    category: Mapped[str] = mapped_column(String(24), default="general")
    body: Mapped[str] = mapped_column(Text)
    # Analyst may pin an explicit score impact; otherwise the overlay engine infers one.
    impact_points: Mapped[int | None] = mapped_column(Integer)
    inferred_impact: Mapped[int | None] = mapped_column(Integer)
    impact_rationale: Mapped[str | None] = mapped_column(Text)
    five_c: Mapped[str | None] = mapped_column(String(16))  # character|capacity|capital|collateral|conditions
    include_in_cam: Mapped[bool] = mapped_column(Boolean, default=True)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)

    author: Mapped[User | None] = relationship(lazy="joined")


class ManualOverride(IdMixin, TimestampMixin, Base):
    __tablename__ = "manual_overrides"

    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"), index=True)
    field: Mapped[str] = mapped_column(String(32))  # decision | recommended_amount | suggested_rate | credit_score
    original_value: Mapped[str | None] = mapped_column(String(80))
    new_value: Mapped[str] = mapped_column(String(80))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default=OverrideStatus.PENDING, index=True)
    requested_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_comment: Mapped[str | None] = mapped_column(Text)

    requested_by: Mapped[User | None] = relationship(foreign_keys=[requested_by_id], lazy="joined")
    reviewed_by: Mapped[User | None] = relationship(foreign_keys=[reviewed_by_id], lazy="joined")


class Escalation(IdMixin, TimestampMixin, Base):
    __tablename__ = "escalations"

    case_id: Mapped[str] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"), index=True)
    raised_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    to_role: Mapped[str] = mapped_column(String(32), default="credit_manager")
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default=EscalationStatus.OPEN, index=True)
    resolution: Mapped[str | None] = mapped_column(Text)
    resolved_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    raised_by: Mapped[User | None] = relationship(foreign_keys=[raised_by_id], lazy="joined")
    resolved_by: Mapped[User | None] = relationship(foreign_keys=[resolved_by_id], lazy="joined")


class Job(IdMixin, TimestampMixin, Base):
    __tablename__ = "jobs"
    __table_args__ = (Index("ix_jobs_case_kind", "case_id", "kind"),)

    kind: Mapped[str] = mapped_column(String(32), index=True)
    case_id: Mapped[str | None] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"))
    document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(16), default=JobStatus.QUEUED, index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    stage: Mapped[str | None] = mapped_column(String(64))
    message: Mapped[str | None] = mapped_column(String(500))
    steps: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    params: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONType)
    error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    backend: Mapped[str] = mapped_column(String(16), default="thread")
    external_id: Mapped[str | None] = mapped_column(String(64))
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)


class AuditLog(IdMixin, Base):
    """Append-only. Never updated or deleted by application code."""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_entity", "entity_type", "entity_id"),)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    actor_email: Mapped[str | None] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(64), index=True)
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str | None] = mapped_column(String(36))
    case_id: Mapped[str | None] = mapped_column(String(36), index=True)
    summary: Mapped[str | None] = mapped_column(String(500))
    details: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    request_id: Mapped[str | None] = mapped_column(String(36))


class CopilotMessage(IdMixin, TimestampMixin, Base):
    __tablename__ = "copilot_messages"

    case_id: Mapped[str | None] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    role: Mapped[str] = mapped_column(String(16))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    provider: Mapped[str | None] = mapped_column(String(32))
    citations: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)


class AiUsage(IdMixin, Base):
    __tablename__ = "ai_usage"

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    model: Mapped[str] = mapped_column(String(80))
    purpose: Mapped[str] = mapped_column(String(40))
    case_id: Mapped[str | None] = mapped_column(String(36), index=True)
    user_id: Mapped[str | None] = mapped_column(String(36))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[float] = mapped_column(Float, default=0)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error: Mapped[str | None] = mapped_column(String(500))
