from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from .mixins import StringIdentifierMixin, TimestampMixin


class CaseAuditEvent(StringIdentifierMixin, TimestampMixin, Base):
    __tablename__ = "case_audit_events"
    __table_args__ = (
        Index("ix_case_audit_events_case_id", "case_id"),
        Index("ix_case_audit_events_action", "action"),
    )

    case_id: Mapped[str] = mapped_column(
        ForeignKey("underwriting_cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    actor: Mapped[str] = mapped_column(String(120), default="system")
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(80), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(80), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    previous_recommendation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    current_recommendation: Mapped[str | None] = mapped_column(String(120), nullable=True)

    case = relationship("UnderwritingCase", back_populates="audit_events")
