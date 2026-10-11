"""Build the borrower's entity graph (NetworkX MultiDiGraph, property-graph conventions).

Nodes: ``Company`` / ``Person`` with identity attributes (PAN, GSTIN, address, incorporation, GST status).
Edges: ``INVOICES`` (goods), ``PAYS`` (money) carrying amount/count, and ``DIRECTOR_OF`` (person -> company).
Sources: the case's counterparty network (GSTN e-invoice / MCA enrichment), promoters, extracted
directors and bank-statement counterparties. The same graph exports to Neo4j via ``fraud.graph.store``.
"""

from __future__ import annotations

import re
from typing import Any

import networkx as nx

FLOW_TYPES = ("INVOICES", "PAYS")


def entity_id(name: str) -> str:
    return "c:" + re.sub(r"[^a-z0-9]+", "-", re.sub(r"\b(private|pvt|limited|ltd|llp)\b\.?", "", name.lower())).strip("-")


def person_id(name: str, din: str | None = None) -> str:
    return f"p:{din}" if din else "p:" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _company(g: nx.MultiDiGraph, name: str, **attrs: Any) -> str:
    nid = entity_id(name)
    if nid not in g:
        g.add_node(nid, name=name, label="Company")
    g.nodes[nid].update({k: v for k, v in attrs.items() if v is not None})
    return nid


def _person(g: nx.MultiDiGraph, name: str, din: str | None) -> str:
    pid = person_id(name, din)
    if pid not in g:
        g.add_node(pid, name=name, label="Person", din=din)
    return pid


def _director(g: nx.MultiDiGraph, name: str, din: str | None, company: str) -> None:
    pid = _person(g, name, din)
    if not any(d.get("type") == "DIRECTOR_OF" for d in (g.get_edge_data(pid, company) or {}).values()):
        g.add_edge(pid, company, type="DIRECTOR_OF")


def build_graph(borrower: dict[str, Any], facts: dict[str, Any] | None, network: dict[str, Any] | None) -> nx.MultiDiGraph:
    facts, network = facts or {}, network or {}
    g = nx.MultiDiGraph()
    bid = _company(g, borrower["name"], pan=borrower.get("pan"), gstin=borrower.get("gstin"), borrower=True)
    for p in borrower.get("promoters") or []:
        if p.get("name"):
            _director(g, p["name"], p.get("din"), bid)
    for d in facts.get("directors") or []:
        _director(g, d["name"], d.get("din"), bid)

    for e in network.get("entities") or []:
        cid = _company(g, e["name"], pan=e.get("pan"), gstin=e.get("gstin"), address=e.get("address"),
                       incorporated=e.get("incorporated"), gst_status=e.get("gst_status"), employees=e.get("employees"))
        for d in e.get("directors") or []:
            _director(g, d["name"], d.get("din"), cid)
    for t in network.get("transactions") or []:
        src, dst = _company(g, t["from"]), _company(g, t["to"])
        g.add_edge(src, dst, type="INVOICES" if t.get("kind") == "invoice" else "PAYS", amount=float(t.get("amount") or 0),
                   count=int(t.get("count") or 1), ref=t.get("ref"), source="network")

    # Bank-statement counterparties: money in from customers, out to suppliers.
    for bank in facts.get("bank") or []:
        for cp in bank.get("counterparties") or []:
            cid = _company(g, cp["name"])
            if cp.get("credits"):
                g.add_edge(cid, bid, type="PAYS", amount=float(cp["credits"]), count=int(cp.get("count") or 1), source="bank")
            if cp.get("debits"):
                g.add_edge(bid, cid, type="PAYS", amount=float(cp["debits"]), count=int(cp.get("count") or 1), source="bank")
    return g


def flow_graph(g: nx.MultiDiGraph, edge_type: str | None = None) -> nx.DiGraph:
    """Collapse parallel INVOICES/PAYS edges (optionally of one type) into a weighted simple DiGraph."""
    types = (edge_type,) if edge_type else FLOW_TYPES
    dg = nx.DiGraph()
    for u, v, d in g.edges(data=True):
        if d.get("type") not in types:
            continue
        if dg.has_edge(u, v):
            dg[u][v]["amount"] += d.get("amount") or 0
            dg[u][v]["count"] += d.get("count") or 0
        else:
            dg.add_edge(u, v, amount=d.get("amount") or 0, count=d.get("count") or 0)
    return dg
