from __future__ import annotations

from ...schemas.platform import GraphEdge, GraphNode
from ...schemas.uploads import StructuredExtraction


def build_relationship_graph(company_name: str, extracted: StructuredExtraction | None) -> dict[str, list[dict[str, str]]]:
    directors = extracted.directors if extracted else []
    company_node = GraphNode(id="company", label=company_name, type="company", risk="medium")
    nodes = [company_node.model_dump()]
    edges: list[dict[str, str]] = []

    for index, director in enumerate(directors or ["Managing Director", "Promoter Group"], start=1):
        node = GraphNode(
            id=f"director-{index}",
            label=director,
            type="director",
            risk="high" if index == 1 and len(directors) > 2 else "medium",
        )
        edge = GraphEdge(source=node.id, target=company_node.id, label="DIRECTS")
        nodes.append(node.model_dump())
        edges.append(edge.model_dump())

    counterparty = GraphNode(id="counterparty-1", label="GST Counterparty", type="vendor", risk="medium")
    nodes.append(counterparty.model_dump())
    edges.append(
        GraphEdge(source=company_node.id, target=counterparty.id, label="TRADES_WITH").model_dump()
    )

    return {"nodes": nodes, "edges": edges}
