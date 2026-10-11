"""Serialise the fraud graph (force-directed UI) and the entity × risk-dimension heatmap."""

from __future__ import annotations

import math
from typing import Any

import networkx as nx

from fraud.graph.builder import flow_graph

_SEVERITY = {"LOW": 0.3, "MEDIUM": 0.55, "HIGH": 0.8, "CRITICAL": 1.0}
# heatmap column -> alert types feeding it
DIMENSIONS = {
    "Circularity": {"circular_trading"},
    "Shared control": {"common_director", "shared_identity"},
    "Shell signals": {"shell_indicator"},
    "Pass-through": {"pass_through"},
    "Invoice anomalies": {"unpaid_invoice_chain", "round_value_invoices"},
}


def _node_risk(alerts: list[dict[str, Any]]) -> dict[str, float]:
    risk: dict[str, float] = {}
    for a in alerts:
        for e in a.get("entities") or []:
            risk[e] = max(risk.get(e, 0.0), _SEVERITY.get(a["severity"], 0.3))
    return risk


def _flagged_pairs(alerts: list[dict[str, Any]]) -> set[tuple[str, str]]:
    pairs: set[tuple[str, str]] = set()
    for a in alerts:
        ents = a.get("entities") or []
        if a["alert_type"] == "circular_trading":
            pairs |= {(u, v) for u, v in zip(ents, ents[1:] + ents[:1])} | {(v, u) for u, v in zip(ents, ents[1:] + ents[:1])}
        elif a["alert_type"] in ("pass_through", "unpaid_invoice_chain", "common_director"):
            pairs |= {(u, v) for u in ents for v in ents if u != v}
    return pairs


def to_ui_graph(g: nx.MultiDiGraph, borrower_id: str, alerts: list[dict[str, Any]]) -> dict[str, Any]:
    risk = _node_risk(alerts)
    flagged = _flagged_pairs(alerts)
    volume: dict[str, float] = {}
    for u, v, d in flow_graph(g).edges(data=True):
        volume[u] = volume.get(u, 0) + d["amount"]
        volume[v] = volume.get(v, 0) + d["amount"]
    top = max((vol for n, vol in volume.items() if n != borrower_id), default=1.0) or 1.0
    nodes = []
    for nid, d in g.nodes(data=True):
        kind = "borrower" if nid == borrower_id else ("person" if d.get("label") == "Person" else "company")
        size = 26 if kind == "borrower" else 13 if kind == "person" else round(12 + 10 * math.sqrt(volume.get(nid, 0) / top), 1)
        meta = {k: str(d[k]) for k in ("pan", "gstin", "din", "address", "incorporated", "gst_status", "employees") if d.get(k) is not None}
        nodes.append({"id": nid, "label": d.get("name", nid), "type": kind, "risk": round(risk.get(nid, 0.0), 2),
                      "flagged": nid in risk and nid != borrower_id, "size": size, "meta": meta})
    links: dict[tuple[str, str, str], dict[str, Any]] = {}
    for u, v, d in g.edges(data=True):
        key = (u, v, d.get("type", "PAYS"))
        link = links.setdefault(key, {"source": u, "target": v, "type": key[2], "amount": None, "count": None,
                                      "flagged": (u, v) in flagged})
        if d.get("amount") is not None:
            link["amount"] = (link["amount"] or 0) + d["amount"]
            link["count"] = (link["count"] or 0) + (d.get("count") or 0)
    return {"nodes": nodes, "links": list(links.values()), "borrower_id": borrower_id}


def heatmap(g: nx.MultiDiGraph, borrower_id: str, alerts: list[dict[str, Any]], gst_checks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Rows: the borrower plus every counterparty touched by an alert; cells 0-100 per risk dimension."""
    entities = [borrower_id] + sorted({e for a in alerts for e in a.get("entities") or []
                                       if e != borrower_id and g.nodes.get(e, {}).get("label") == "Company"})
    gst_fail = max((_SEVERITY["HIGH"] if c["status"] == "fail" else _SEVERITY["LOW"] if c["status"] == "warn" else 0.0)
                   for c in gst_checks) if gst_checks else 0.0
    rows = []
    for e in entities[:10]:
        row: dict[str, Any] = {"entity": g.nodes[e].get("name", e), "id": e}
        for dim, types in DIMENSIONS.items():
            hits = [_SEVERITY[a["severity"]] for a in alerts if a["alert_type"] in types and e in (a.get("entities") or [])]
            row[dim] = round(100 * max(hits, default=0.0))
        row["GST integrity"] = round(100 * gst_fail) if e == borrower_id else 0
        rows.append(row)
    return rows
