"""Domain enums. Stored as strings so schema changes never need ALTER TYPE migrations."""

from __future__ import annotations

from enum import StrEnum


class CaseStatus(StrEnum):
    DRAFT = "draft"
    INGESTING = "ingesting"
    ANALYZING = "analyzing"
    IN_REVIEW = "in_review"
    ESCALATED = "escalated"
    APPROVED = "approved"
    REJECTED = "rejected"


class DocumentType(StrEnum):
    ANNUAL_REPORT = "annual_report"
    FINANCIAL_STATEMENT = "financial_statement"
    GST_RETURN = "gst_return"
    BANK_STATEMENT = "bank_statement"
    LEGAL_NOTICE = "legal_notice"
    SANCTION_LETTER = "sanction_letter"
    SHAREHOLDING_PATTERN = "shareholding_pattern"
    MCA_FILING = "mca_filing"
    RATING_REPORT = "rating_report"
    OTHER = "other"


class DocumentStatus(StrEnum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class JobKind(StrEnum):
    INGEST_DOCUMENT = "ingest_document"
    RESEARCH = "research"
    FRAUD = "fraud"
    SCORE = "score"
    CAM = "cam"
    FULL_ANALYSIS = "full_analysis"


class RiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Decision(StrEnum):
    APPROVE = "APPROVE"
    APPROVE_WITH_CONDITIONS = "APPROVE_WITH_CONDITIONS"
    REFER = "REFER"
    DECLINE = "DECLINE"


class NoteKind(StrEnum):
    NOTE = "note"
    COMMENT = "comment"


class NoteCategory(StrEnum):
    SITE_VISIT = "site_visit"
    MANAGEMENT = "management"
    OPERATIONS = "operations"
    FINANCIAL = "financial"
    COLLATERAL = "collateral"
    COMPLIANCE = "compliance"
    GENERAL = "general"


class OverrideStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class EscalationStatus(StrEnum):
    OPEN = "open"
    RESOLVED = "resolved"


class AlertStatus(StrEnum):
    OPEN = "open"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"
