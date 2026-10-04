from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, IdMixin, JSONType, TimestampMixin

if TYPE_CHECKING:
    from .company import Company
    from .document import Document
    from .user import User


class CaseStatus(str, Enum):
    DRAFT = "DRAFT"
    INGESTING = "INGESTING"
    ANALYZING = "ANALYZING"
    IN_REVIEW = "IN_REVIEW"
    ESCALATED = "ESCALATED"
    APPROVED = "APPROVED"
    CONDITIONAL = "CONDITIONAL"
    REJECTED = "REJECTED"


class UnderwritingCase(IdMixin, TimestampMixin, Base):
    __tablename__ = "underwriting_cases"

    reference_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    facility_type: Mapped[str] = mapped_column(String(60), default="Term Loan")
    purpose: Mapped[str | None] = mapped_column(Text)
    requested_amount: Mapped[float] = mapped_column(Float)
    tenure_months: Mapped[int] = mapped_column(Integer, default=60)
    collateral_description: Mapped[str | None] = mapped_column(Text)
    collateral_value: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(24), default=CaseStatus.DRAFT.value, index=True)
    priority: Mapped[str] = mapped_column(String(12), default="NORMAL")
    assigned_to_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    # Denormalised, recomputed snapshot of merged document intelligence (see services.profile_service).
    profile: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    final_decision: Mapped[str | None] = mapped_column(String(32))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tags: Mapped[list[str]] = mapped_column(JSONType, default=list)
    is_demo: Mapped[bool] = mapped_column(default=False)

    company: Mapped[Company] = relationship(back_populates="cases", lazy="joined")
    assigned_to: Mapped[User | None] = relationship(foreign_keys=[assigned_to_id], lazy="joined")
    documents: Mapped[list[Document]] = relationship(
        back_populates="case", cascade="all, delete-orphan", order_by="Document.created_at.desc()"
    )
