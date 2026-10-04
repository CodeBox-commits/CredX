from __future__ import annotations

from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from .mixins import StringIdentifierMixin, TimestampMixin


class Company(StringIdentifierMixin, TimestampMixin, Base):
    __tablename__ = "companies"
    __table_args__ = (
        Index("ix_companies_name", "name"),
        Index("ix_companies_cin", "cin"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cin: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)

    cases = relationship("UnderwritingCase", back_populates="company")
