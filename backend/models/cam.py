from __future__ import annotations

from typing import Any

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base, IdMixin, JSONType, TimestampMixin


class CamReport(IdMixin, TimestampMixin, Base):
    __tablename__ = "cam_reports"

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    assessment_id: Mapped[str | None] = mapped_column(ForeignKey("credit_assessments.id", ondelete="SET NULL"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(16), default="DRAFT", index=True)
    title: Mapped[str] = mapped_column(String(255))
    recommendation: Mapped[str] = mapped_column(String(32))
    sections: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    analyst_comments: Mapped[dict[str, str]] = mapped_column(JSONType, default=dict)
    pdf_key: Mapped[str | None] = mapped_column(String(512))
    docx_key: Mapped[str | None] = mapped_column(String(512))
    generated_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
