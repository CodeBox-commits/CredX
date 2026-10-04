"""Aggregate alerts into a bounded, explainable fraud-risk score (0–100)."""

from __future__ import annotations

from ..types import FraudAlertData, Severity

# Document red-flags that also count as fraud evidence (from the ingestion engine).
DOCUMENT_SIGNAL_RULES: dict[str, tuple[str, Severity, float, str]] = {
    "circular_trading": ("Circular trading flagged in documents", "HIGH", 12, "Source documents explicitly reference circular trading or round-tripping."),
    "revenue_inflation": ("Revenue inflation flagged in documents", "HIGH", 10, "Reviewer notes in the source documents mention possible inflated revenue."),
    "gst_mismatch": ("GST mismatch disclosed in documents", "MEDIUM", 6, "A GSTR mismatch is disclosed in the uploaded documents."),
    "wilful_defaulter": ("Wilful defaulter reference", "CRITICAL", 25, "The borrower or a promoter is referenced in a wilful-defaulter context."),
    "regulatory_action": ("Investigative / regulatory action", "CRITICAL", 20, "Documents reference ED/SFIO/CBI/SEBI action."),
    "auditor_resignation": ("Auditor resignation", "HIGH", 10, "Mid-term auditor resignations are a strong governance red flag."),
}


def document_signal_alerts(codes: list[str]) -> list[FraudAlertData]:
    alerts = []
    for code in codes:
        if code in DOCUMENT_SIGNAL_RULES:
            title, severity, impact, description = DOCUMENT_SIGNAL_RULES[code]
            alerts.append(FraudAlertData(alert_type=f"doc_{code}", severity=severity, title=title,
                                         description=description, score_impact=impact))
    return alerts


def score_alerts(alerts: list[FraudAlertData]) -> tuple[float, Severity]:
    """Diminishing-returns aggregation: the strongest signals dominate, repeated weak ones saturate."""
    impacts = sorted((a.score_impact for a in alerts), reverse=True)
    score = 0.0
    for rank, impact in enumerate(impacts):
        score += impact * (0.85 ** rank)
    score = round(min(100.0, score), 1)
    if any(a.severity == "CRITICAL" for a in alerts) and score < 60:
        score = 60.0
    level: Severity = "CRITICAL" if score >= 75 else "HIGH" if score >= 50 else "MEDIUM" if score >= 25 else "LOW"
    return score, level
