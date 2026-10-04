from fraud.engine import run_fraud_analysis
from fraud.graph.builder import build_graph
from fraud.graph.store import NetworkXGraphStore, to_cypher
from research.engine import run_research
from research.litigation.analyzer import litigation_score
from research.sector_analysis.knowledge_base import resolve_sector
from research.sentiment.lexicon import score_text

CR = 1e7
BORROWER = {"name": "Nebula Components Private Limited", "promoters": [{"name": "Rakesh Malhotra", "din": "03344556"}]}


def test_demo_fraud_network_detects_rings(demo_specs):
    net = demo_specs["nebula"]["network"]
    result = run_fraud_analysis(BORROWER, {}, net, 186 * CR)
    types = {a["alert_type"] for a in result["alerts"]}
    assert {"circular_trading", "common_director", "shared_identity", "shell_indicator", "pass_through"} <= types
    ring = next(a for a in result["alerts"] if a["alert_type"] == "circular_trading")
    assert len(ring["evidence"]["flows"]) == 2  # goods loop and money loop on the same ring
    assert result["fraud_score"] >= 50
    assert any(link["flagged"] for link in result["graph"]["links"])
    assert result["heatmap"] and "Circularity" in result["heatmap"][0]


def test_ordinary_trade_is_not_circular():
    net = {"entities": [], "transactions": [
        {"from": BORROWER["name"], "to": "Big Customer Ltd", "kind": "invoice", "amount": 50 * CR},
        {"from": "Big Customer Ltd", "to": BORROWER["name"], "kind": "payment", "amount": 49 * CR},
    ]}
    result = run_fraud_analysis(BORROWER, {}, net, 186 * CR)
    assert not [a for a in result["alerts"] if a["alert_type"] == "circular_trading"]


def test_gst_checks_flag_inflated_sales():
    facts = {"gst": [{"returns": [{"return_type": "GSTR-3B", "turnover": 186 * CR}, {"return_type": "GSTR-2A", "turnover": 160 * CR}]}],
             "bank": [{"total_credits": 50 * CR, "monthly": [{}] * 6}], "gstins": []}
    result = run_fraud_analysis(BORROWER, facts, None, 186 * CR)
    statuses = {c["check"]: c["status"] for c in result["gst_checks"]}
    assert statuses["GSTR-2A/2B vs GSTR-3B"] == "fail" and statuses["Bank credits vs GST turnover"] == "fail"
    assert result["max_mismatch_pct"] > 10


def test_graph_store_roundtrip_and_cypher(demo_specs):
    g = build_graph(BORROWER, {}, demo_specs["nebula"]["network"])
    store = NetworkXGraphStore()
    g2 = store.load("c1", store.save("c1", g))
    assert g2.number_of_edges() == g.number_of_edges()
    cypher = to_cypher(g, "c1")
    assert "MERGE (n:Entity:Company" in cypher and ":PAYS" in cypher and ":DIRECTOR_OF" in cypher


def test_sentiment_handles_negation():
    assert score_text("Company upgraded; wins large order")["label"] == "POSITIVE"
    assert score_text("ED raid and fraud probe; insolvency petition admitted")["label"] == "NEGATIVE"
    assert score_text("Promoter cleared of fraud charges")["score"] > score_text("Promoter charged with fraud")["score"]


def test_litigation_claimant_discount():
    case = {"case_types": ["Commercial arbitration"], "severity": "MEDIUM", "claim_amount": 62 * CR, "status": "pending"}
    as_respondent = litigation_score([case], [], 138 * CR, "Kaveri Infra Projects Limited")
    as_claimant = litigation_score([{**case, "claimant_name": "Kaveri Infra Projects Limited"}], [], 138 * CR, "Kaveri Infra Projects Limited")
    assert as_claimant["score"] < as_respondent["score"]


def test_sector_resolution():
    assert resolve_sector(None, "Tiruppur knitwear exporter")[0] == "textiles"
    assert resolve_sector("pharmaceuticals")[1]["outlook"] == "STRONG"


def test_research_with_demo_intel_is_cited():
    r = run_research({"name": "Nebula Components Private Limited", "sector": "auto_components"}, {}, 186 * CR, use_demo_intel=True)
    assert r["litigation_risk"] == "HIGH" and r["promoter_sentiment"] == "NEGATIVE"
    assert "[1]" in r["summary"] and all(f["provider"] == "demo_intel" for f in r["findings"])


def test_cam_renders_all_formats(demo_specs):
    from cam.exporters.renderers import render_docx, render_html, render_pdf
    from cam.generators.builder import build_sections
    from scoring.inference.engine import score_case

    spec = demo_specs["sunline"]
    fin = {fy: {k: v * CR for k, v in vals.items()} for fy, vals in spec["financials"].items()}
    score = score_case({"financials": fin, "application": {**spec["case"]}, "company": spec["company"]})
    ctx = {"company": spec["company"], "case": {"reference": "CX-TEST", **spec["case"]}, "score": {**score, "version": 1},
           "research": {}, "fraud": {}, "facts": {}, "notes": [{"body": "Plant visited", "kind": "note", "include_in_cam": True}]}
    sections = build_sections(ctx, "Narrative paragraph.", {"executive_summary": "Looks good"})
    assert [s["id"] for s in sections][:3] == ["executive_summary", "borrower_profile", "facility"]
    html = render_html(ctx, sections, 1)
    assert "Analyst comment" in html and "Five Cs" in html
    assert render_pdf(ctx, sections, 1).startswith(b"%PDF")
    assert render_docx(ctx, sections, 1)[:2] == b"PK"
