"""Analyst collaboration: notes, threaded comments and escalations."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, IdMixin, JSONType, TimestampMixin

if TYPE_CHECKING:
    from .user import User


class AnalystNote(IdMixin, TimestampMixin, Base):
    __tablename__ = "analyst_notes"

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    # site_visit | management | financial | collateral | compliance | general
    category: Mapped[str] = mapped_column(String(24), default="general")
    content: Mapped[str] = mapped_column(Text)
    # Qualitative signals parsed from the note, each with an explainable score impact.
    signals: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    score_impact: Mapped[float] = mapped_column(Float, default=0.0)
    include_in_cam: Mapped[bool] = mapped_column(Boolean, default=True)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)

    author: Mapped[User | None] = relationship(lazy="joined")


class CaseComment(IdMixin, TimestampMixin, Base):
    __tablename__ = "case_comments"

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("case_comments.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    section: Mapped[str | None] = mapped_column(String(40))

    author: Mapped[User | None] = relationship(lazy="joined")


class Escalation(IdMixin, TimestampMixin, Base):
    __tablename__ = "escalations"

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    raised_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    assigned_role: Mapped[str] = mapped_column(String(32), default="credit_manager")
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="OPEN", index=True)
    resolution: Mapped[str | None] = mapped_column(Text)
    resolved_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    raised_by: Mapped[User | None] = relationship(foreign_keys=[raised_by_id], lazy="joined")
