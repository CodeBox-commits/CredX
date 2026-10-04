from __future__ import annotations

from typing import Protocol


class CopilotProvider(Protocol):
    name: str

    def answer(self, question: str, context: dict[str, object]) -> str:
        ...


class RuleBasedCopilot:
    name = "rule-based"

    def answer(self, question: str, context: dict[str, object]) -> str:
        normalized = question.lower()
        if "risk" in normalized:
            return (
                "CredX is weighting leverage, profitability, fraud flags, and external intelligence "
                "into a single underwriting trace. Review the negative contributions first."
            )
        if "cam" in normalized:
            return "The CAM layer converts extracted evidence, research findings, and analyst notes into committee-ready sections."
        if "fraud" in normalized:
            return "Fraud review currently checks GST mismatch, turnover inflation, circular trading cues, and related-party relationships."
        return "CredX can explain the score, summarize the borrower, or walk through the CAM narrative from the current case context."
