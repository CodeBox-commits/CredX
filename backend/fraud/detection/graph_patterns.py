"""Graph-based fraud patterns: circular trading, common directors, pass-through invoice chains."""

from __future__ import annotations

import networkx as nx

from utils.inr import format_inr_compact

from ..graph.builder import money_graph
from ..types import FraudAlertData


def detect_circular_trading(
    g: nx.MultiDiGraph, borrower: str, revenue: float | None, *, max_len: int = 6
) -> tuple[list[FraudAlertData], list[list[str]]]:
    """Money cycles (A→B→C→A) are the signature of circular trading / round-tripping."""
    dg = money_graph(g)
    alerts: list[FraudAlertData] = []
    cycles: list[list[str]] = []
    if dg.number_of_edges() == 0:
        return alerts, cycles
    try:
        raw_cycles = list(nx.simple_cycles(dg, length_bound=max_len))
    except TypeError:  # networkx < 3.1 has no length_bound
        raw_cycles = [c for c in nx.simple_cycles(dg) if len(c) <= max_len]

    for cycle in sorted(raw_cycles, key=len)[:25]:
        if len(cycle) < 2:
            continue
        edges = list(zip(cycle, cycle[1:] + cycle[:1]))
        amounts = [dg[u][v]["amount"] for u, v in edges]
        cycle_value = min(amounts) if amounts else 0.0
        through_borrower = borrower in cycle
        share = (cycle_value / revenue) if revenue else None
        if share is not None and share >= 0.08 or cycle_value >= 5e7:
            severity = "CRITICAL" if through_borrower else "HIGH"
        elif through_borrower:
            severity = "HIGH"
        else:
            severity = "MEDIUM"
        names = [g.nodes[n].get("name", n) for n in cycle]
        cycles.append(cycle)
        alerts.append(
            FraudAlertData(
                alert_type="circular_trading",
                severity=severity,  # type: ignore[arg-type]
                title=f"Circular trade loop across {len(cycle)} entities",
                description=(
                    f"Funds/invoices flow {' → '.join(names + names[:1])}. At least {format_inr_compact(cycle_value)} "
                    f"cycles through the loop"
                    + (f" (≈{share:.1%} of reported revenue)" if share else "")
                    + ". Circular flows can inflate turnover and GST ITC without real economic activity."
                ),
                entities=cycle,
                evidence={"cycle": names, "edge_amounts": amounts, "cycle_value": cycle_value, "revenue_share": share},
                score_impact={"CRITICAL": 30, "HIGH": 20, "MEDIUM": 10}[severity],
            )
        )
    return alerts, cycles


def detect_common_directors(g: nx.MultiDiGraph, borrower: str) -> list[FraudAlertData]:
    """Counterparties that share a director with the borrower are undisclosed related parties."""
    alerts: list[FraudAlertData] = []
    directors = [u for u, _, d in g.in_edges(borrower, data=True) if d.get("type") == "DIRECTOR_OF"]
    trading_partners = {v for _, v, d in g.out_edges(borrower, data=True) if d.get("type") in {"SUPPLIES_TO", "PAYS"}} | {
        u for u, _, d in g.in_edges(borrower, data=True) if d.get("type") in {"SUPPLIES_TO", "PAYS"}
    }
    for director in directors:
        companies = {v for _, v, d in g.out_edges(director, data=True) if d.get("type") == "DIRECTOR_OF" and v != borrower}
        linked = companies & trading_partners
        if not companies:
            continue
        name = g.nodes[director].get("name", director)
        if linked:
            volume = sum(
                (d.get("amount") or 0)
                for u, v, d in g.edges(data=True)
                if d.get("type") in {"SUPPLIES_TO", "PAYS"} and {u, v} & linked and borrower in {u, v}
            )
            alerts.append(
                FraudAlertData(
                    alert_type="common_director",
                    severity="HIGH",
                    title=f"Director {name} sits on {len(linked)} trading counterpart(ies)",
                    description=(
                        f"{name} is a director of the borrower and of "
                        f"{', '.join(g.nodes[c].get('name', c) for c in linked)}, which trade with the borrower "
                        f"({format_inr_compact(volume)} of flows). Treat as related-party transactions and verify arm's-length pricing."
                    ),
                    entities=[director, *linked],
                    evidence={"director": name, "linked_companies": [g.nodes[c].get("name", c) for c in linked], "volume": volume},
                    score_impact=14,
                )
            )
        elif len(companies) >= 4:
            alerts.append(
                FraudAlertData(
                    alert_type="director_network",
                    severity="LOW",
                    title=f"{name} holds {len(companies)} other directorships",
                    description="Wide directorship networks warrant a check for shell or group-concern exposure.",
                    entities=[director, *companies],
                    evidence={"director": name, "companies": [g.nodes[c].get("name", c) for c in companies]},
                    score_impact=3,
                )
            )
    return alerts


def detect_invoice_chains(g: nx.MultiDiGraph, borrower: str, revenue: float | None) -> list[FraudAlertData]:
    """Pass-through entities (in ≈ out) and extreme counterparty concentration."""
    alerts: list[FraudAlertData] = []
    dg = money_graph(g)
    for node in dg.nodes:
        if node == borrower:
            continue
        inflow = sum(d["amount"] for _, _, d in dg.in_edges(node, data=True))
        outflow = sum(d["amount"] for _, _, d in dg.out_edges(node, data=True))
        if inflow > 0 and outflow > 0 and min(inflow, outflow) / max(inflow, outflow) > 0.92 and min(inflow, outflow) > 1e7:
            name = g.nodes[node].get("name", node)
            alerts.append(
                FraudAlertData(
                    alert_type="pass_through_entity",
                    severity="MEDIUM",
                    title=f"{name} behaves like a pass-through entity",
                    description=(
                        f"Inflows of {format_inr_compact(inflow)} are matched by outflows of {format_inr_compact(outflow)} "
                        "with no apparent value addition — a common pattern in fake invoice chains."
                    ),
                    entities=[node],
                    evidence={"inflow": inflow, "outflow": outflow},
                    score_impact=8,
                )
            )
    if revenue:
        sales = [(v, d["amount"]) for _, v, d in dg.out_edges(borrower, data=True)] if borrower in dg else []
        for customer, amount in sales:
            if amount / revenue >= 0.35:
                name = g.nodes[customer].get("name", customer)
                alerts.append(
                    FraudAlertData(
                        alert_type="customer_concentration",
                        severity="MEDIUM" if amount / revenue < 0.5 else "HIGH",
                        title=f"{amount / revenue:.0%} of sales billed to {name}",
                        description="Single-customer concentration at this level increases both credit and invoice-fabrication risk.",
                        entities=[customer],
                        evidence={"share": round(amount / revenue, 3), "amount": amount},
                        score_impact=6,
                    )
                )
    same_pan = [(u, v) for u, v, d in g.edges(data=True) if d.get("type") == "SAME_PAN" and borrower in {u, v}]
    for u, v in same_pan:
        other = v if u == borrower else u
        alerts.append(
            FraudAlertData(
                alert_type="same_pan_counterparty",
                severity="MEDIUM",
                title=f"Counterparty shares the borrower's PAN ({g.nodes[other].get('name', other)})",
                description="Trading with another GSTIN under the same PAN is intra-entity; such sales should not count as third-party revenue.",
                entities=[other],
                evidence={},
                score_impact=7,
            )
        )
    return alerts


def centrality_scores(g: nx.MultiDiGraph) -> dict[str, float]:
    if g.number_of_nodes() < 2:
        return {n: 1.0 for n in g.nodes}
    simple = nx.DiGraph()
    simple.add_nodes_from(g.nodes)
    for u, v, d in g.edges(data=True):
        weight = 1.0 + (d.get("amount") or 0) / 1e7
        if simple.has_edge(u, v):
            simple[u][v]["weight"] += weight
        else:
            simple.add_edge(u, v, weight=weight)
    try:
        return nx.pagerank(simple, weight="weight")
    except Exception:  # noqa: BLE001 - scipy missing / convergence
        return nx.degree_centrality(simple)
