from __future__ import annotations

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from .mixins import StringIdentifierMixin, TimestampMixin


class AnalystNote(StringIdentifierMixin, TimestampMixin, Base):
    __tablename__ = "analyst_notes"
    __table_args__ = (
        Index("ix_analyst_notes_case_id", "case_id"),
    )

    case_id: Mapped[str] = mapped_column(
        ForeignKey("underwriting_cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    source: Mapped[str] = mapped_column(String(80), default="analyst")
    note: Mapped[str] = mapped_column(Text, nullable=False)

    case = relationship("UnderwritingCase", back_populates="notes")
