from __future__ import annotations

from typing import Any

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base, IdMixin, JSONType, TimestampMixin


class CreditAssessment(IdMixin, TimestampMixin, Base):
    """Versioned, immutable credit decision snapshot (one row per scoring run)."""

    __tablename__ = "credit_assessments"

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    model_version: Mapped[str] = mapped_column(String(48))

    credit_score: Mapped[int] = mapped_column(Integer)
    grade: Mapped[str] = mapped_column(String(8))
    risk_level: Mapped[str] = mapped_column(String(12), index=True)
    probability_of_default: Mapped[float] = mapped_column(Float)
    approval_probability: Mapped[float] = mapped_column(Float)
    decision: Mapped[str] = mapped_column(String(32), index=True)
    recommended_amount: Mapped[float] = mapped_column(Float)
    suggested_rate: Mapped[float] = mapped_column(Float)

    ml_score: Mapped[int] = mapped_column(Integer)
    overlay_points: Mapped[float] = mapped_column(Float, default=0.0)

    features: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    shap_values: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    overlays: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    policy_checks: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    five_cs: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    pricing: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    loan_sizing: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    top_risk_factors: Mapped[list[str]] = mapped_column(JSONType, default=list)
    strengths: Mapped[list[str]] = mapped_column(JSONType, default=list)
    conditions: Mapped[list[str]] = mapped_column(JSONType, default=list)
    narrative: Mapped[str] = mapped_column(Text, default="")

    overridden: Mapped[bool] = mapped_column(Boolean, default=False)
    override_decision: Mapped[str | None] = mapped_column(String(32))
    override_amount: Mapped[float | None] = mapped_column(Float)
    override_rate: Mapped[float | None] = mapped_column(Float)
    override_reason: Mapped[str | None] = mapped_column(Text)
    overridden_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
