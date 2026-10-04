from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Level = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
Sentiment = Literal["POSITIVE", "NEUTRAL", "NEGATIVE"]
Outlook = Literal["FAVORABLE", "STABLE", "WEAK"]


class ResearchQuery(BaseModel):
    company_name: str
    sector: str = "Manufacturing"
    promoters: list[str] = Field(default_factory=list)
    gstin: str | None = None
    cin: str | None = None
    city: str | None = None


class Article(BaseModel):
    title: str
    summary: str = ""
    url: str | None = None
    source: str = "Unknown"
    published_at: datetime | None = None
    provider: str = "offline"
    category_hint: str | None = None
    subject: str | None = None  # which query/entity surfaced this article


class Finding(BaseModel):
    category: Literal["news", "litigation", "regulatory", "mca", "sector", "promoter", "fraud"]
    title: str
    summary: str
    source_name: str
    url: str | None = None
    published_at: datetime | None = None
    sentiment: Sentiment = "NEUTRAL"
    sentiment_score: float = 0.0
    severity: Level = "LOW"
    relevance: float = 0.5
    entities: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    provider: str = "offline"


class ResearchResult(BaseModel):
    findings: list[Finding]
    litigation_risk: Level
    promoter_sentiment: Sentiment
    sector_outlook: Outlook
    regulatory_risk: Level
    mca_risk: Level
    external_risk_score: float
    summary: str
    key_points: list[str]
    sector_context: dict[str, Any]
    sentiment_timeline: list[dict[str, Any]]
    providers: list[str]
