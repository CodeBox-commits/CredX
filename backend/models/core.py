"""Users, companies and credit cases."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base, IdMixin, JSONType, TimestampMixin
from models.enums import CaseStatus

if TYPE_CHECKING:
    from models.documents import Document


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="analyst", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Company(IdMixin, TimestampMixin, Base):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(255), index=True)
    cin: Mapped[str | None] = mapped_column(String(21), unique=True)
    pan: Mapped[str | None] = mapped_column(String(10), index=True)
    gstin: Mapped[str | None] = mapped_column(String(15), index=True)
    sector: Mapped[str | None] = mapped_column(String(80), index=True)
    sub_sector: Mapped[str | None] = mapped_column(String(120))
    constitution: Mapped[str | None] = mapped_column(String(60))  # Pvt Ltd / Public Ltd / LLP
    incorporation_year: Mapped[int | None] = mapped_column(Integer)
    city: Mapped[str | None] = mapped_column(String(80))
    state: Mapped[str | None] = mapped_column(String(80))
    website: Mapped[str | None] = mapped_column(String(255))
    promoters: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    external_rating: Mapped[str | None] = mapped_column(String(40))  # e.g. "CRISIL BBB+/Stable"
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    cases: Mapped[list[CreditCase]] = relationship(back_populates="company")


class CreditCase(IdMixin, TimestampMixin, Base):
    __tablename__ = "credit_cases"

    reference: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    facility_type: Mapped[str] = mapped_column(String(60), default="Term Loan")
    requested_amount: Mapped[float] = mapped_column(Float)
    tenure_months: Mapped[int] = mapped_column(Integer, default=60)
    purpose: Mapped[str | None] = mapped_column(Text)
    collateral_type: Mapped[str | None] = mapped_column(String(120))
    collateral_value: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(24), default=CaseStatus.DRAFT, index=True)
    priority: Mapped[str] = mapped_column(String(16), default="normal")
    assigned_to_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    final_decision: Mapped[str | None] = mapped_column(String(32))
    decided_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_rationale: Mapped[str | None] = mapped_column(Text)
    # Denormalised headline numbers so list views never need to join score history.
    latest_score: Mapped[int | None] = mapped_column(Integer)
    latest_risk_level: Mapped[str | None] = mapped_column(String(16))
    latest_fraud_score: Mapped[int | None] = mapped_column(Integer)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    # Counterparty enrichment for the fraud graph (GSTN invoice network / MCA registry lookups):
    # {"entities": [...], "transactions": [...], "source": "..."}
    network: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)

    company: Mapped[Company] = relationship(back_populates="cases", lazy="joined")
    documents: Mapped[list[Document]] = relationship(
        back_populates="case", cascade="all, delete-orphan", order_by="Document.created_at"
    )
    assigned_to: Mapped[User | None] = relationship(foreign_keys=[assigned_to_id], lazy="joined")
