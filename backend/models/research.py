from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base, IdMixin, JSONType, TimestampMixin, utcnow


class ResearchFinding(IdMixin, TimestampMixin, Base):
    __tablename__ = "research_findings"

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    # news | litigation | regulatory | mca | sector | promoter | fraud
    category: Mapped[str] = mapped_column(String(24), index=True)
    title: Mapped[str] = mapped_column(String(500))
    summary: Mapped[str | None] = mapped_column(Text)
    source_name: Mapped[str] = mapped_column(String(160))
    url: Mapped[str | None] = mapped_column(String(1000))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    sentiment: Mapped[str] = mapped_column(String(12), default="NEUTRAL")
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.0)
    severity: Mapped[str] = mapped_column(String(12), default="LOW", index=True)
    relevance: Mapped[float] = mapped_column(Float, default=0.5)
    entities: Mapped[list[str]] = mapped_column(JSONType, default=list)
    tags: Mapped[list[str]] = mapped_column(JSONType, default=list)
    provider: Mapped[str] = mapped_column(String(32), default="offline")


class ResearchReport(IdMixin, TimestampMixin, Base):
    __tablename__ = "research_reports"

    case_id: Mapped[str] = mapped_column(ForeignKey("underwriting_cases.id", ondelete="CASCADE"), index=True)
    litigation_risk: Mapped[str] = mapped_column(String(12), default="LOW")
    promoter_sentiment: Mapped[str] = mapped_column(String(12), default="NEUTRAL")
    sector_outlook: Mapped[str] = mapped_column(String(12), default="STABLE")
    regulatory_risk: Mapped[str] = mapped_column(String(12), default="LOW")
    mca_risk: Mapped[str] = mapped_column(String(12), default="LOW")
    external_risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    summary: Mapped[str] = mapped_column(Text, default="")
    key_points: Mapped[list[str]] = mapped_column(JSONType, default=list)
    sector_context: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    sentiment_timeline: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    sources_count: Mapped[int] = mapped_column(Integer, default=0)
    providers: Mapped[list[str]] = mapped_column(JSONType, default=list)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
