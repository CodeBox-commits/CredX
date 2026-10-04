"""Graph-based fraud detectors. Each returns alerts with evidence and a bounded score impact."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

import networkx as nx

from fraud.graph.builder import flow_graph
from utils.india import format_inr_short, is_valid_gstin


def _alert(alert_type: str, severity: str, title: str, description: str, entities: list[str],
           evidence: dict[str, Any], impact: int) -> dict[str, Any]:
    return {"alert_type": alert_type, "severity": severity, "title": title, "description": description,
            "entities": entities, "evidence": evidence, "score_impact": impact}


def detect_cycles(g: nx.MultiDiGraph, borrower_id: str, revenue: float | None, max_len: int = 6) -> list[dict[str, Any]]:
    """Circular trading: goods (invoices) or money (payments) that leave the borrower and return to it
    through intermediaries. Each flow type is searched separately — an invoice one way and a payment
    the other way is ordinary trade, not a loop. A loop present in both flows is reported once."""
    found: dict[frozenset[str], dict[str, Any]] = {}
    for edge_type, noun in (("INVOICES", "goods/invoices"), ("PAYS", "funds")):
        flows = flow_graph(g, edge_type)
        if borrower_id not in flows:
            continue
        for cycle in nx.simple_cycles(flows, length_bound=max_len):
            if len(cycle) < 3 or borrower_id not in cycle:
                continue  # 2-node loops are usually refunds/returns; real rings need an intermediary
            i = cycle.index(borrower_id)
            cycle = cycle[i:] + cycle[:i]
            edges = list(zip(cycle, cycle[1:] + cycle[:1], strict=True))
            amounts = [flows[u][v]["amount"] for u, v in edges]
            key = frozenset(cycle)
            entry = found.setdefault(key, {"cycle": cycle, "flows": [], "value": 0.0, "amounts": {}})
            entry["flows"].append(noun)
            entry["value"] = max(entry["value"], min(amounts))
            entry["amounts"][noun] = [round(a) for a in amounts]
    alerts = []
    for entry in found.values():
        cycle, value = entry["cycle"], entry["value"]
        materiality = value / revenue if revenue else None
        both = len(entry["flows"]) > 1
        severity = "CRITICAL" if both or (materiality or 0) > 0.05 or value > 1e7 else "HIGH" if value > 1e6 else "MEDIUM"
        names = [g.nodes[n].get("name", n) for n in cycle]
        alerts.append(_alert(
            "circular_trading", severity,
            f"Circular {' & '.join(entry['flows'])} through {len(cycle)} entities",
            f"{' and '.join(entry['flows']).capitalize()} loop {' → '.join(names + [names[0]])}; at least {format_inr_short(value)} "
            "round-trips" + (f" ({materiality * 100:.1f}% of revenue)." if materiality else "."),
            cycle, {"path": names, "flows": entry["flows"], "edge_amounts": entry["amounts"], "cycle_value": round(value),
                    "materiality": round(materiality, 4) if materiality else None},
            {"CRITICAL": 30, "HIGH": 18, "MEDIUM": 8}[severity],
        ))
    return sorted(alerts, key=lambda a: -a["evidence"]["cycle_value"])[:10]


def detect_common_directors(g: nx.MultiDiGraph, borrower_id: str) -> list[dict[str, Any]]:
    """Directors who sit on the borrower *and* on a counterparty it transacts with (undisclosed RPT)."""
    flows = flow_graph(g)
    trading_partners = set(flows.predecessors(borrower_id)) | set(flows.successors(borrower_id)) if borrower_id in flows else set()
    borrower_directors = {u for u, _, d in g.in_edges(borrower_id, data=True) if d.get("type") == "DIRECTOR_OF"}
    alerts = []
    for person in borrower_directors:
        other = [v for _, v, d in g.out_edges(person, data=True) if d.get("type") == "DIRECTOR_OF" and v != borrower_id]
        linked = [c for c in other if c in trading_partners or any(c in nx.descendants(flows, t) for t in trading_partners if t in flows)]
        if not linked:
            continue
        volume = sum(flows[u][v]["amount"] for u, v in flows.edges() if borrower_id in (u, v) and (u in linked or v in linked))
        names = [g.nodes[c]["name"] for c in linked]
        alerts.append(_alert(
            "common_director", "HIGH" if volume > 1e7 else "MEDIUM",
            f"Common director: {g.nodes[person]['name']}",
            f"{g.nodes[person]['name']} is a director of the borrower and of {', '.join(names)}, which trade with it "
            f"(direct volume {format_inr_short(volume)}). Treat as related-party until disclosed and arm's length is evidenced.",
            [person, *linked], {"director": g.nodes[person]["name"], "din": g.nodes[person].get("din"), "companies": names,
                                "volume": round(volume)},
            12 if volume > 1e7 else 6,
        ))
    return alerts


def detect_shell_indicators(g: nx.MultiDiGraph, borrower_id: str) -> list[dict[str, Any]]:
    """Counterparties sharing PAN/address/directors with each other, newly incorporated, or with
    cancelled/invalid GST registrations — classic accommodation-entry markers."""
    alerts = []
    companies = [n for n, d in g.nodes(data=True) if d.get("label") == "Company" and n != borrower_id]
    by_key: dict[tuple[str, str], list[str]] = defaultdict(list)
    for n in companies:
        d = g.nodes[n]
        if d.get("pan"):
            by_key[("PAN", d["pan"])].append(n)
        if d.get("address"):
            by_key[("address", d["address"].lower())].append(n)
    for (kind, value), nodes in by_key.items():
        if len(nodes) >= 2:
            names = [g.nodes[n]["name"] for n in nodes]
            alerts.append(_alert("shared_identity", "HIGH", f"{len(nodes)} counterparties share the same {kind}",
                                 f"{', '.join(names)} share {kind} '{value}'. Distinct trading partners rarely do.",
                                 nodes, {"attribute": kind, "value": value, "companies": names}, 10))
    for n in companies:
        d = g.nodes[n]
        reasons = []
        if d.get("gst_status") in ("cancelled", "suspended"):
            reasons.append(f"GST registration {d['gst_status']}")
        if d.get("gstin") and not is_valid_gstin(d["gstin"]):
            reasons.append("GSTIN fails checksum validation")
        if d.get("incorporated") and int(str(d["incorporated"])[:4]) >= 2023:
            reasons.append(f"incorporated {d['incorporated']}")
        if d.get("employees") is not None and d["employees"] <= 2:
            reasons.append(f"{d['employees']} employee(s)")
        if len(reasons) >= 2 or any("GST registration" in r for r in reasons):
            alerts.append(_alert("shell_indicator", "HIGH" if len(reasons) >= 2 else "MEDIUM",
                                 f"Shell-company indicators: {d['name']}", "; ".join(reasons).capitalize() + ".",
                                 [n], {"reasons": reasons}, 8 if len(reasons) >= 2 else 4))
    return alerts


def detect_pass_through(g: nx.MultiDiGraph, borrower_id: str) -> list[dict[str, Any]]:
    """Intermediaries whose inflow ≈ outflow (forwarding money with no value addition)."""
    flows = flow_graph(g, "PAYS")
    alerts = []
    for n in flows.nodes():
        if n == borrower_id or g.nodes[n].get("label") != "Company":
            continue
        inflow = sum(d["amount"] for _, _, d in flows.in_edges(n, data=True))
        outflow = sum(d["amount"] for _, _, d in flows.out_edges(n, data=True))
        if inflow > 5e6 and outflow > 0 and 0.9 <= outflow / inflow <= 1.05 and flows.in_degree(n) and flows.out_degree(n):
            alerts.append(_alert("pass_through", "MEDIUM", f"Pass-through entity: {g.nodes[n]['name']}",
                                 f"Receives {format_inr_short(inflow)} and forwards {format_inr_short(outflow)} "
                                 f"({outflow / inflow * 100:.0f}%) — consistent with an accommodation conduit.",
                                 [n], {"inflow": round(inflow), "outflow": round(outflow)}, 6))
    return alerts


def detect_invoice_anomalies(g: nx.MultiDiGraph, borrower_id: str) -> list[dict[str, Any]]:
    """Invoices with no matching payment, and suspiciously round invoice values."""
    invoices = flow_graph(g, "INVOICES")
    payments = flow_graph(g, "PAYS")
    alerts = []
    for u, v, d in invoices.edges(data=True):
        paid = payments[v][u]["amount"] if payments.has_edge(v, u) else 0.0
        if d["amount"] > 5e6 and paid < 0.3 * d["amount"]:
            alerts.append(_alert("unpaid_invoice_chain", "HIGH" if paid == 0 else "MEDIUM",
                                 f"Invoices without settlement: {g.nodes[u]['name']} → {g.nodes[v]['name']}",
                                 f"{format_inr_short(d['amount'])} invoiced but only {format_inr_short(paid)} paid back — possible "
                                 "fake invoicing to inflate turnover or pass ITC.",
                                 [u, v], {"invoiced": round(d["amount"]), "paid": round(paid), "count": d["count"]},
                                 10 if paid == 0 else 5))
    round_edges = [(u, v, data) for u, v, data in g.edges(data=True)
                   if data.get("type") == "INVOICES" and data.get("amount", 0) >= 1e6 and data["amount"] % 1e5 == 0]
    if len(round_edges) >= 3:
        alerts.append(_alert("round_value_invoices", "LOW", f"{len(round_edges)} round-value invoices",
                             "Multiple invoices in exact lakh multiples; genuine trade invoices rarely are.",
                             list({u for u, _, _ in round_edges}), {"count": len(round_edges)}, 3))
    return alerts
