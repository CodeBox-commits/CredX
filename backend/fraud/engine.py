"""Fraud analysis orchestration: graph -> detectors -> GST rules -> score -> UI graph + heatmap."""

from __future__ import annotations

import math
from collections.abc import Callable
from typing import Any

from fraud.detection.detectors import (
    detect_common_directors,
    detect_cycles,
    detect_invoice_anomalies,
    detect_pass_through,
    detect_shell_indicators,
)
from fraud.graph.builder import build_graph, entity_id
from fraud.graph.store import NetworkXGraphStore
from fraud.risk_rules.gst_rules import run_gst_checks
from fraud.visualization.serializer import heatmap, to_ui_graph

ProgressFn = Callable[[int, str, str], None]

DOC_FLAG_IMPACT = {
    "Circular trading / round-tripping suspicion": 10,
    "Possible revenue inflation": 10,
    "GST evasion / show-cause notice": 8,
    "Investigative agency action": 15,
    "Wilful defaulter reference": 20,
}


def run_fraud_analysis(borrower: dict[str, Any], facts: dict[str, Any], network: dict[str, Any] | None,
                       revenue: float | None, progress: ProgressFn | None = None) -> dict[str, Any]:
    report = progress or (lambda p, s, m: None)
    report(10, "graph", "Building entity graph")
    g = build_graph(borrower, facts, network)
    bid = entity_id(borrower["name"])

    report(35, "detection", "Searching for cycles and shared control")
    alerts = []
    alerts += detect_cycles(g, bid, revenue)
    alerts += detect_common_directors(g, bid)
    alerts += detect_shell_indicators(g, bid)
    alerts += detect_pass_through(g, bid)
    alerts += detect_invoice_anomalies(g, bid)

    report(65, "gst", "Running GST forensic checks")
    gst_checks, max_mismatch = run_gst_checks(facts, revenue)
    for flag in facts.get("red_flags") or []:
        if flag["label"] in DOC_FLAG_IMPACT:
            alerts.append({"alert_type": "document_red_flag", "severity": flag["severity"], "title": flag["label"],
                           "description": flag.get("evidence", ""), "entities": [bid],
                           "evidence": {"document": flag.get("filename")}, "score_impact": DOC_FLAG_IMPACT[flag["label"]]})

    raw = sum(a["score_impact"] for a in alerts) + sum(c["score_impact"] for c in gst_checks)
    fraud_score = round(100 * (1 - math.exp(-raw / 55)))
    level = "CRITICAL" if fraud_score >= 75 else "HIGH" if fraud_score >= 50 else "MEDIUM" if fraud_score >= 25 else "LOW"

    report(85, "visualization", "Preparing graph visualisation")
    ui = to_ui_graph(g, bid, alerts)
    company_nodes = sum(1 for _, d in g.nodes(data=True) if d.get("label") == "Company")
    cycles = [a for a in alerts if a["alert_type"] == "circular_trading"]
    failed = [c for c in gst_checks if c["status"] == "fail"]
    summary_bits = [f"Graph of {company_nodes} companies and {g.number_of_edges()} relationships analysed."]
    summary_bits.append(f"{len(cycles)} circular flow(s) detected." if cycles else "No circular trading loops found.")
    if any(a["alert_type"] == "common_director" for a in alerts):
        summary_bits.append("Shared directors link the borrower to trading counterparties.")
    summary_bits.append(f"{len(failed)} GST check(s) failed." if failed else "GST reconciliation within tolerance.")
    report(100, "complete", "Fraud analysis complete")
    return {
        "fraud_score": fraud_score,
        "risk_level": level,
        "summary": " ".join(summary_bits),
        "alerts": sorted(alerts, key=lambda a: -a["score_impact"]),
        "gst_checks": gst_checks,
        "max_mismatch_pct": max_mismatch,
        "graph": ui,
        "heatmap": heatmap(g, bid, alerts, gst_checks),
        "stats": {
            "nodes": g.number_of_nodes(), "edges": g.number_of_edges(), "companies": company_nodes,
            "people": sum(1 for _, d in g.nodes(data=True) if d.get("label") == "Person"),
            "cycles": len(cycles), "raw_points": raw,
            "graph_store": NetworkXGraphStore().save("", g),
        },
    }
