from __future__ import annotations

from ...schemas.platform import FraudAlert, FraudAnalysisRequest, FraudAnalysisResponse
from ..graph.service import build_relationship_graph
from ..risk_rules.gst import evaluate_gst_rules


def build_fraud_analysis(request: FraudAnalysisRequest) -> FraudAnalysisResponse:
    gst_alerts = evaluate_gst_rules(
        gstr_2a_amount=request.gstr_2a_amount,
        gstr_3b_amount=request.gstr_3b_amount,
        declared_turnover=request.declared_turnover or (request.extracted.revenue if request.extracted else None),
        bank_credits=request.bank_credits,
        supplier_gstins=request.supplier_gstins,
        customer_gstins=request.customer_gstins,
    )

    alerts = [
        FraudAlert(
            label=label,
            severity="high" if weight >= 24 else "medium",
            detail=detail,
        )
        for label, detail, weight in gst_alerts
    ]

    if request.extracted and "Promoter linkage" in request.extracted.risk_indicators:
        alerts.append(
            FraudAlert(
                label="Related-party concentration",
                severity="medium",
                detail="Uploaded evidence references promoter-linked or group-entity relationships.",
            )
        )

    fraud_risk_score = min(100, int(sum(18 if alert.severity == "high" else 10 for alert in alerts)))
    risk_level = "LOW"
    if fraud_risk_score >= 50:
        risk_level = "HIGH"
    elif fraud_risk_score >= 24:
        risk_level = "MEDIUM"

    graph = build_relationship_graph(request.company_name, request.extracted)
    summary = (
        f"Fraud review for {request.company_name} raised {len(alerts)} alert(s) and produced a "
        f"{risk_level.lower()} graph-risk posture."
        if alerts
        else f"Fraud review for {request.company_name} did not surface major GST or relationship anomalies."
    )

    return FraudAnalysisResponse(
        fraud_risk_score=fraud_risk_score,
        risk_level=risk_level,
        suspicious_cycle_alerts=alerts,
        graph=graph,
        summary=summary,
    )
