"""ORM models. Importing this package registers every table on ``Base.metadata``."""

from models.core import Company, CreditCase, User
from models.documents import BankStatementSummary, Document, FinancialStatement, GstFiling
from models.intelligence import CamReport, CreditScore, FraudAlert, FraudAnalysis, ResearchFinding, ResearchReport
from models.workflow import AiUsage, AnalystNote, AuditLog, CopilotMessage, Escalation, Job, ManualOverride

__all__ = [
    "AiUsage",
    "AnalystNote",
    "AuditLog",
    "BankStatementSummary",
    "CamReport",
    "Company",
    "CopilotMessage",
    "CreditCase",
    "CreditScore",
    "Document",
    "Escalation",
    "FinancialStatement",
    "FraudAlert",
    "FraudAnalysis",
    "GstFiling",
    "Job",
    "ManualOverride",
    "ResearchFinding",
    "ResearchReport",
    "User",
]
