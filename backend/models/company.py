from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, IdMixin, JSONType, TimestampMixin

if TYPE_CHECKING:
    from .case import UnderwritingCase


class Company(IdMixin, TimestampMixin, Base):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(255), index=True)
    cin: Mapped[str | None] = mapped_column(String(21), unique=True)
    pan: Mapped[str | None] = mapped_column(String(10), index=True)
    primary_gstin: Mapped[str | None] = mapped_column(String(15), index=True)
    sector: Mapped[str] = mapped_column(String(80), index=True, default="Manufacturing")
    industry: Mapped[str | None] = mapped_column(String(120))
    constitution: Mapped[str | None] = mapped_column(String(60))
    incorporation_year: Mapped[int | None] = mapped_column(Integer)
    registered_state: Mapped[str | None] = mapped_column(String(60))
    city: Mapped[str | None] = mapped_column(String(80))
    website: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    external_rating: Mapped[str | None] = mapped_column(String(32))

    relations: Mapped[list[CompanyRelation]] = relationship(
        back_populates="company", cascade="all, delete-orphan", order_by="CompanyRelation.entity_type"
    )
    cases: Mapped[list[UnderwritingCase]] = relationship(back_populates="company")


class CompanyRelation(IdMixin, TimestampMixin, Base):
    """A typed edge from the borrower to a person or entity.

    Mirrors a labelled-property-graph edge so the same rows can be projected into
    NetworkX today and Neo4j later (see ``fraud.graph.store``).
    """

    __tablename__ = "company_relations"

    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(255))
    identifier: Mapped[str | None] = mapped_column(String(40), index=True)
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    source: Mapped[str] = mapped_column(String(32), default="manual")
    confidence: Mapped[float] = mapped_column(Float, default=1.0)

    company: Mapped[Company] = relationship(back_populates="relations")
