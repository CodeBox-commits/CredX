"""Graph persistence behind a small interface.

Today the graph is rebuilt per analysis in NetworkX and serialised to JSON on the
``fraud_assessments`` row. ``Neo4jGraphStore`` implements the same interface for
the planned migration: set ``NEO4J_URI``/``NEO4J_USER``/``NEO4J_PASSWORD`` and
install the ``neo4j`` driver — no detection code changes.
"""

from __future__ import annotations

import json
import os
from typing import Protocol

import networkx as nx


class GraphStore(Protocol):
    def save(self, case_id: str, graph: nx.MultiDiGraph) -> None: ...
    def load(self, case_id: str) -> nx.MultiDiGraph | None: ...


class InMemoryGraphStore:
    def __init__(self) -> None:
        self._graphs: dict[str, nx.MultiDiGraph] = {}

    def save(self, case_id: str, graph: nx.MultiDiGraph) -> None:
        self._graphs[case_id] = graph

    def load(self, case_id: str) -> nx.MultiDiGraph | None:
        return self._graphs.get(case_id)


def _cypher_value(value: object) -> str:
    return json.dumps(value, default=str)


def to_cypher(case_id: str, graph: nx.MultiDiGraph) -> list[str]:
    """Idempotent Cypher statements reproducing ``graph`` (useful for exports and migrations)."""
    statements = []
    for key, data in graph.nodes(data=True):
        props = {k: v for k, v in data.items() if k != "label" and isinstance(v, (str, int, float, bool))}
        statements.append(
            f"MERGE (n:{data.get('label', 'Entity')} {{key: {_cypher_value(key)}}}) "
            f"SET n += {_cypher_value(props)}, n.case_ids = coalesce(n.case_ids, []) + {_cypher_value(case_id)}"
        )
    for u, v, data in graph.edges(data=True):
        props = {k: v for k, v in data.items() if k != "type" and isinstance(v, (str, int, float, bool))}
        statements.append(
            f"MATCH (a {{key: {_cypher_value(u)}}}), (b {{key: {_cypher_value(v)}}}) "
            f"MERGE (a)-[r:{data.get('type', 'RELATED_TO')} {{case_id: {_cypher_value(case_id)}}}]->(b) "
            f"SET r += {_cypher_value(props)}"
        )
    return statements


class Neo4jGraphStore:  # pragma: no cover - requires a running Neo4j
    def __init__(self, uri: str, user: str, password: str) -> None:
        from neo4j import GraphDatabase  # type: ignore[import-not-found]

        self._driver = GraphDatabase.driver(uri, auth=(user, password))

    def save(self, case_id: str, graph: nx.MultiDiGraph) -> None:
        with self._driver.session() as session:
            for statement in to_cypher(case_id, graph):
                session.run(statement)

    def load(self, case_id: str) -> nx.MultiDiGraph | None:
        g = nx.MultiDiGraph()
        with self._driver.session() as session:
            rows = session.run(
                "MATCH (a)-[r {case_id: $cid}]->(b) RETURN a, type(r) AS t, properties(r) AS p, b", cid=case_id
            )
            for row in rows:
                a, b = row["a"], row["b"]
                g.add_node(a["key"], **dict(a))
                g.add_node(b["key"], **dict(b))
                g.add_edge(a["key"], b["key"], type=row["t"], **row["p"])
        return g if g.number_of_nodes() else None


def get_graph_store() -> GraphStore:
    uri = os.getenv("NEO4J_URI")
    if uri:
        try:
            return Neo4jGraphStore(uri, os.getenv("NEO4J_USER", "neo4j"), os.getenv("NEO4J_PASSWORD", ""))
        except Exception:  # noqa: BLE001 - fall back to in-memory
            pass
    return InMemoryGraphStore()
