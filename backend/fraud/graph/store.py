"""Graph persistence and Neo4j export.

``NetworkXGraphStore`` serialises the graph to node-link JSON stored with the fraud analysis, so the
graph can be reloaded without re-running detection. ``to_cypher`` emits idempotent Cypher that
reproduces the graph in Neo4j (downloadable per case), which is the migration path to a graph DB.
"""

from __future__ import annotations

import json
from typing import Any

import networkx as nx


class NetworkXGraphStore:
    def save(self, case_id: str, g: nx.MultiDiGraph) -> dict[str, Any]:
        data = nx.node_link_data(g, edges="links")
        return {**json.loads(json.dumps(data, default=str)), "case_id": case_id}

    def load(self, case_id: str, data: dict[str, Any]) -> nx.MultiDiGraph:
        payload = {k: v for k, v in data.items() if k != "case_id"}
        payload.setdefault("directed", True)
        payload.setdefault("multigraph", True)
        payload.setdefault("graph", {})
        return nx.node_link_graph(payload, edges="links")


def _props(attrs: dict[str, Any], skip: set[str]) -> str:
    clean = {k: v for k, v in attrs.items() if k not in skip and isinstance(v, str | int | float | bool)}
    return json.dumps(clean, ensure_ascii=False)


def to_cypher(g: nx.MultiDiGraph, case_id: str) -> str:
    lines = [f"// CredX entity graph for case {case_id}", "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE;"]
    for nid, d in g.nodes(data=True):
        label = d.get("label", "Company")
        lines.append(f"MERGE (n:Entity:{label} {{id: {json.dumps(nid)}}}) SET n += {_props(d, {'label'})};")
    for u, v, d in g.edges(data=True):
        rel = d.get("type", "RELATED_TO")
        lines.append(f"MATCH (a:Entity {{id: {json.dumps(u)}}}), (b:Entity {{id: {json.dumps(v)}}}) "
                     f"MERGE (a)-[r:{rel} {{case_id: {json.dumps(case_id)}, ref: {json.dumps(d.get('ref') or '')}}}]->(b) "
                     f"SET r += {_props(d, {'type'})};")
    return "\n".join(lines) + "\n"
