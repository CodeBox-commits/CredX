from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from .mixins import StringIdentifierMixin, TimestampMixin


class WorkflowJob(StringIdentifierMixin, TimestampMixin, Base):
    __tablename__ = "workflow_jobs"
    __table_args__ = (
        Index("ix_workflow_jobs_case_id", "case_id"),
        Index("ix_workflow_jobs_status", "status"),
        Index("ix_workflow_jobs_job_type", "job_type"),
    )

    case_id: Mapped[str] = mapped_column(
        ForeignKey("underwriting_cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    job_type: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="queued")
    stage: Mapped[str] = mapped_column(String(80), default="queued")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    completed_at: Mapped[str | None] = mapped_column(String(64), nullable=True)

    case = relationship("UnderwritingCase", back_populates="jobs")
