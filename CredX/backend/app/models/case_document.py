from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from .mixins import StringIdentifierMixin, TimestampMixin


class CaseDocument(StringIdentifierMixin, TimestampMixin, Base):
    __tablename__ = "case_documents"
    __table_args__ = (
        Index("ix_case_documents_case_id", "case_id"),
        Index("ix_case_documents_remote_document_id", "remote_document_id"),
    )

    case_id: Mapped[str] = mapped_column(
        ForeignKey("underwriting_cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    remote_document_id: Mapped[str] = mapped_column(String(64), nullable=False)
    company_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    document_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_at: Mapped[str] = mapped_column(String(64), nullable=False)
    parse_summary_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    case = relationship("UnderwritingCase", back_populates="documents")
