"""ORM models. Importing this package registers every table on ``Base.metadata``."""

from .cam import CamReport
from .case import CaseStatus, UnderwritingCase
from .company import Company, CompanyRelation
from .document import Document, DocumentStatus
from .financials import FINANCIAL_FIELDS, BankMonthly, FinancialStatement, GstReturn, TradeLink
from .fraud import FraudAlert, FraudAssessment
from .ops import AuditLog, CopilotMessage, Job, JobStatus, LlmUsage
from .research import ResearchFinding, ResearchReport
from .scoring import CreditAssessment
from .user import User
from .workspace import AnalystNote, CaseComment, Escalation

__all__ = [
    "FINANCIAL_FIELDS",
    "AnalystNote",
    "AuditLog",
    "BankMonthly",
    "CamReport",
    "CaseComment",
    "CaseStatus",
    "Company",
    "CompanyRelation",
    "CopilotMessage",
    "CreditAssessment",
    "Document",
    "DocumentStatus",
    "Escalation",
    "FinancialStatement",
    "FraudAlert",
    "FraudAssessment",
    "GstReturn",
    "Job",
    "JobStatus",
    "LlmUsage",
    "ResearchFinding",
    "ResearchReport",
    "TradeLink",
    "UnderwritingCase",
    "User",
]
