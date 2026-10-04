"""Serialise the fraud graph and risk heatmap for the frontend."""

from __future__ import annotations

from typing import Any

import networkx as nx

from ..types import FraudAlertData, GstCheck

_SEV_SCORE = {"LOW": 0.25, "MEDIUM": 0.5, "HIGH": 0.75, "CRITICAL": 1.0}


def graph_to_json(
    g: nx.MultiDiGraph,
    borrower: str,
    alerts: list[FraudAlertData],
    cycles: list[list[str]],
    centrality: dict[str, float],
) -> dict[str, Any]:
    node_risk: dict[str, float] = {}
    node_flags: dict[str, list[str]] = {}
    for alert in alerts:
        for entity in alert.entities:
            node_risk[entity] = max(node_risk.get(entity, 0.0), _SEV_SCORE[alert.severity])
            node_flags.setdefault(entity, []).append(alert.title)
    cycle_edges = {(u, v) for cycle in cycles for u, v in zip(cycle, cycle[1:] + cycle[:1])}
    max_c = max(centrality.values(), default=1.0) or 1.0

    nodes = [
        {
            "id": key,
            "label": data.get("name", key),
            "kind": "borrower" if key == borrower else data.get("kind", "company"),
            "group": data.get("label", "Entity"),
            "identifier": data.get("gstin") or data.get("identifier"),
            "risk": round(node_risk.get(key, 0.0), 2),
            "flags": node_flags.get(key, [])[:4],
            "centrality": round(centrality.get(key, 0.0) / max_c, 3),
            "in_cycle": any(key in c for c in cycles),
        }
        for key, data in g.nodes(data=True)
    ]
    edges = [
        {
            "id": f"{u}->{v}#{k}",
            "source": u,
            "target": v,
            "type": data.get("type", "RELATED_TO"),
            "amount": data.get("amount"),
            "invoices": data.get("invoices"),
            "suspicious": (u, v) in cycle_edges,
        }
        for u, v, k, data in g.edges(keys=True, data=True)
    ]
    return {
        "nodes": nodes,
        "edges": edges,
        "cycles": [[g.nodes[n].get("name", n) for n in c] for c in cycles],
        "cycle_node_ids": cycles,
        "borrower_id": borrower,
        "stats": {"nodes": g.number_of_nodes(), "edges": g.number_of_edges(), "cycles": len(cycles)},
    }


def build_heatmap(alerts: list[FraudAlertData], gst_checks: list[GstCheck]) -> dict[str, Any]:
    """Category × severity matrix plus per-check status cells."""
    categories = {
        "Circular trading": {"circular_trading", "doc_circular_trading", "pass_through_entity"},
        "Related parties": {"common_director", "director_network", "same_pan_counterparty"},
        "GST integrity": {"itc_mismatch", "gstr1_3b_gap", "gstr2a_3b_gap", "low_tax_rate", "filing_delays", "doc_gst_mismatch"},
        "Revenue quality": {"revenue_inflation", "unexplained_credits", "books_gst_gap", "customer_concentration", "doc_revenue_inflation"},
        "Governance": {"doc_wilful_defaulter", "doc_regulatory_action", "doc_auditor_resignation"},
    }
    severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    rows = []
    for category, types in categories.items():
        cells = {s: 0 for s in severities}
        for alert in alerts:
            if alert.alert_type in types:
                cells[alert.severity] += 1
        intensity = max((_SEV_SCORE[s] for s, n in cells.items() if n), default=0.0)
        rows.append({"category": category, "cells": cells, "intensity": intensity})
    checks = [{"code": c.code, "label": c.label, "status": c.status, "value": c.value} for c in gst_checks]
    return {"severities": severities, "rows": rows, "checks": checks}
