"""Build the borrower's relationship graph as a NetworkX MultiDiGraph.

Node/edge labels follow a property-graph convention (``label``, ``key`` and typed
relationships) so the same graph can be written to Neo4j verbatim via
``fraud.graph.store.Neo4jGraphStore``.
"""

from __future__ import annotations

import re

import networkx as nx

from ..types import FraudInputs

NODE_LABELS = {
    "borrower": "Company",
    "company": "Company",
    "group_company": "Company",
    "supplier": "Company",
    "customer": "Company",
    "related_party": "Company",
    "director": "Person",
    "shareholder": "Person",
    "lender": "Lender",
}

MONEY_EDGES = {"SUPPLIES_TO", "PAYS"}


def node_key(name: str, identifier: str | None = None) -> str:
    if identifier:
        return identifier.upper()
    return "N:" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _add_node(g: nx.MultiDiGraph, key: str, name: str, kind: str, **attrs: object) -> None:
    if key in g:
        # Upgrade a generic company node to a more specific role when we learn more.
        if g.nodes[key].get("kind") in {"company", "unknown"} and kind not in {"company", "unknown"}:
            g.nodes[key]["kind"] = kind
        g.nodes[key].update({k: v for k, v in attrs.items() if v is not None})
        return
    g.add_node(key, name=name, kind=kind, label=NODE_LABELS.get(kind, "Entity"), **attrs)


def build_graph(inputs: FraudInputs) -> tuple[nx.MultiDiGraph, str]:
    g = nx.MultiDiGraph()
    borrower = node_key(inputs.borrower_name, inputs.borrower_gstin)
    _add_node(g, borrower, inputs.borrower_name, "borrower", gstin=inputs.borrower_gstin, pan=inputs.borrower_pan)

    for party in inputs.parties:
        key = node_key(party.name, party.identifier)
        _add_node(g, key, party.name, party.entity_type, identifier=party.identifier, **party.attributes)
        if party.entity_type == "director":
            g.add_edge(key, borrower, type="DIRECTOR_OF")
            for other in party.attributes.get("other_directorships", []) or []:
                other_key = node_key(other)
                _add_node(g, other_key, other, "company")
                g.add_edge(key, other_key, type="DIRECTOR_OF")
        elif party.entity_type == "shareholder":
            g.add_edge(key, borrower, type="SHAREHOLDER_OF", pct=party.attributes.get("holding_pct"))
        elif party.entity_type in {"related_party", "group_company"}:
            g.add_edge(borrower, key, type="RELATED_TO")
        elif party.entity_type == "lender":
            g.add_edge(key, borrower, type="LENDS_TO", amount=party.attributes.get("amount"))

    for flow in inputs.flows:
        src = node_key(flow.source_name, flow.source_gstin)
        dst = node_key(flow.target_name, flow.target_gstin)
        _add_node(g, src, flow.source_name, "company", gstin=flow.source_gstin)
        _add_node(g, dst, flow.target_name, "company", gstin=flow.target_gstin)
        g.add_edge(
            src, dst,
            type="PAYS" if flow.link_type == "payment" else "SUPPLIES_TO",
            amount=flow.amount, invoices=flow.invoice_count, period=flow.period,
        )
    # Same PAN behind two GSTINs ⇒ same legal entity / group concern.
    by_pan: dict[str, list[str]] = {}
    for key, data in g.nodes(data=True):
        gstin = data.get("gstin") or (key if re.fullmatch(r"\d{2}[A-Z]{5}\d{4}[A-Z]\w{3}", key) else None)
        if gstin:
            by_pan.setdefault(gstin[2:12], []).append(key)
    for keys in by_pan.values():
        for a in keys:
            for b in keys:
                if a < b:
                    g.add_edge(a, b, type="SAME_PAN")
    return g, borrower


def money_graph(g: nx.MultiDiGraph) -> nx.DiGraph:
    """Collapse parallel money edges into a weighted simple DiGraph."""
    dg = nx.DiGraph()
    for u, v, data in g.edges(data=True):
        if data.get("type") not in MONEY_EDGES:
            continue
        if dg.has_edge(u, v):
            dg[u][v]["amount"] += data.get("amount") or 0
            dg[u][v]["invoices"] += data.get("invoices") or 0
        else:
            dg.add_edge(u, v, amount=data.get("amount") or 0, invoices=data.get("invoices") or 0)
    return dg
