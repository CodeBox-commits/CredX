from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base, IdMixin, JSONType, TimestampMixin, utcnow


class FraudAssessment(IdMixin, TimestampMixin, Base):
    __tablename__ = "fraud_assessments"

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    fraud_risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(12), default="LOW")
    graph: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    heatmap: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    gst_checks: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    summary: Mapped[str] = mapped_column(Text, default="")
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class FraudAlert(IdMixin, TimestampMixin, Base):
    __tablename__ = "fraud_alerts"

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    assessment_id: Mapped[str | None] = mapped_column(ForeignKey("fraud_assessments.id", ondelete="CASCADE"))
    alert_type: Mapped[str] = mapped_column(String(48), index=True)
    severity: Mapped[str] = mapped_column(String(12), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    entities: Mapped[list[str]] = mapped_column(JSONType, default=list)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    score_impact: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(16), default="OPEN", index=True)
    resolved_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolution_note: Mapped[str | None] = mapped_column(Text)
