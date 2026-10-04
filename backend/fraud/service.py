"""Fraud engine façade: inputs → graph → detectors → score → explainable result."""

from __future__ import annotations

from .detection.graph_patterns import (
    centrality_scores,
    detect_circular_trading,
    detect_common_directors,
    detect_invoice_chains,
)
from .detection.gst_checks import run_gst_checks
from .graph.builder import build_graph
from .risk_rules.engine import document_signal_alerts, score_alerts
from .types import FraudInputs, FraudResult
from .visualization.serializer import build_heatmap, graph_to_json

_SEV_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


def analyze_fraud(inputs: FraudInputs) -> FraudResult:
    graph, borrower = build_graph(inputs)

    cycle_alerts, cycles = detect_circular_trading(graph, borrower, inputs.revenue)
    alerts = [
        *cycle_alerts,
        *detect_common_directors(graph, borrower),
        *detect_invoice_chains(graph, borrower, inputs.revenue),
    ]
    gst_checks, gst_alerts = run_gst_checks(inputs.gst, inputs.bank, inputs.revenue)
    alerts.extend(gst_alerts)
    # Only add document-sourced signals when structured detectors didn't already prove them.
    proven = {a.alert_type for a in alerts}
    doc_codes = [c for c in inputs.document_risk_codes if not (c == "circular_trading" and "circular_trading" in proven)]
    alerts.extend(document_signal_alerts(doc_codes))
    alerts.sort(key=lambda a: (_SEV_ORDER[a.severity], -a.score_impact))

    score, level = score_alerts(alerts)
    centrality = centrality_scores(graph)
    graph_json = graph_to_json(graph, borrower, alerts, cycles, centrality)

    top = [a.title for a in alerts[:3]]
    summary = (
        f"Fraud risk {level} ({score:.0f}/100). "
        + (f"Key observations: {'; '.join(top)}." if top else "No material fraud indicators were detected across graph, GST and document checks.")
    )
    return FraudResult(
        fraud_risk_score=score,
        risk_level=level,
        alerts=alerts,
        gst_checks=gst_checks,
        graph=graph_json,
        heatmap=build_heatmap(alerts, gst_checks),
        metrics={
            "nodes": graph.number_of_nodes(),
            "edges": graph.number_of_edges(),
            "cycles": len(cycles),
            "counterparties": sum(1 for _, d in graph.nodes(data=True) if d.get("kind") in {"company", "supplier", "customer"}),
            "alerts_by_severity": {s: sum(1 for a in alerts if a.severity == s) for s in _SEV_ORDER},
        },
        summary=summary,
    )
