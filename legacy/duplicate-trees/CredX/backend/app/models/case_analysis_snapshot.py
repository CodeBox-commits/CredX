from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from .mixins import StringIdentifierMixin, TimestampMixin


class CaseAnalysisSnapshot(StringIdentifierMixin, TimestampMixin, Base):
    __tablename__ = "case_analysis_snapshots"
    __table_args__ = (
        Index("ix_case_analysis_snapshots_case_id", "case_id"),
        Index("ix_case_analysis_snapshots_synced_at", "synced_at"),
    )

    case_id: Mapped[str] = mapped_column(
        ForeignKey("underwriting_cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    sync_status: Mapped[str] = mapped_column(String(40), default="synced")
    synced_at: Mapped[str] = mapped_column(String(64), nullable=False)
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    extracted_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    research_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    fraud_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    decision_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cam_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    case = relationship("UnderwritingCase", back_populates="snapshots")
