"""Assemble the Credit Appraisal Memo as structured sections.

One section model (kinds: decision, kv, table, text, bullets, five_cs) is rendered by the web preview,
the HTML/PDF/DOCX exporters, so every format says exactly the same thing. Each section carries the
analyst's comment for that section, which survives regeneration.
"""

from __future__ import annotations

from typing import Any

from cam.formatting.formatters import DECISION_TEXT, days, inr, label, pct, times

CR = 1e7


def _cr(v: Any) -> str:
    return f"{v / CR:,.2f}" if isinstance(v, int | float) else "—"


def _section(sid: str, title: str, kind: str, content: Any, comments: dict[str, str], **extra: Any) -> dict[str, Any]:
    return {"id": sid, "title": title, "kind": kind, "content": content, "analyst_comment": comments.get(sid, ""), **extra}


def build_sections(ctx: dict[str, Any], narrative: str, comments: dict[str, str] | None = None) -> list[dict[str, Any]]:
    comments = comments or {}
    company, case = ctx.get("company") or {}, ctx.get("case") or {}
    s, research, fraud = ctx.get("score") or {}, ctx.get("research") or {}, ctx.get("fraud") or {}
    facts = ctx.get("facts") or {}
    ratios = s.get("ratios") or {}
    trend = (ratios.get("trend") or [])[:3]
    sizing, pricing, policy = s.get("loan_sizing") or {}, s.get("pricing") or {}, s.get("policy") or {}
    sections: list[dict[str, Any]] = []

    decision = s.get("decision")
    sections.append(_section("executive_summary", "Executive summary & recommendation", "decision", {
        "decision": DECISION_TEXT.get(decision or "", "Pending scoring"), "decision_code": decision, "narrative": narrative,
        "metrics": [
            {"label": "Credit score", "value": f"{s.get('credit_score', '—')} ({s.get('rating', '—')})"},
            {"label": "Probability of default", "value": pct(s.get("probability_of_default"), 2)},
            {"label": "Risk level", "value": label(s.get("risk_level"))},
            {"label": "Approval likelihood", "value": pct(s.get("approval_probability"), 0)},
            {"label": "Requested", "value": inr(case.get("requested_amount"))},
            {"label": "Recommended", "value": inr(s.get("recommended_amount"))},
            {"label": "Suggested rate", "value": f"{s['suggested_rate']:.2f}% p.a." if s.get("suggested_rate") else "—"},
            {"label": "Fraud score", "value": f"{fraud['fraud_score']}/100" if fraud.get("fraud_score") is not None else "—"},
        ],
    }, comments))

    promoters = ", ".join(f"{p['name']}" + (f" (DIN {p['din']})" if p.get("din") else "") for p in company.get("promoters") or [])
    sections.append(_section("borrower_profile", "Borrower profile", "kv", [
        {"label": "Legal name", "value": company.get("name") or "—"},
        {"label": "Constitution", "value": company.get("constitution") or "—"},
        {"label": "CIN", "value": company.get("cin") or "—"},
        {"label": "PAN / GSTIN", "value": f"{company.get('pan') or '—'} / {company.get('gstin') or '—'}"},
        {"label": "Sector", "value": f"{label(company.get('sector'))}" + (f" — {company['sub_sector']}" if company.get("sub_sector") else "")},
        {"label": "Incorporated", "value": str(company.get("incorporation_year") or "—")},
        {"label": "Location", "value": ", ".join(x for x in (company.get("city"), company.get("state")) if x) or "—"},
        {"label": "External rating", "value": company.get("external_rating") or "Unrated"},
        {"label": "Promoters / directors", "value": promoters or "—"},
    ], comments))

    sections.append(_section("facility", "Proposed facility", "kv", [
        {"label": "Facility", "value": case.get("facility_type") or "—"},
        {"label": "Amount requested", "value": inr(case.get("requested_amount"))},
        {"label": "Tenure", "value": f"{case.get('tenure_months')} months" if case.get("tenure_months") else "—"},
        {"label": "Purpose", "value": case.get("purpose") or "—"},
        {"label": "Security offered", "value": case.get("collateral_type") or "—"},
        {"label": "Collateral value", "value": inr(case.get("collateral_value"))},
        {"label": "Recommended amount", "value": inr(s.get("recommended_amount"))},
        {"label": "Binding sizing constraint", "value": sizing.get("binding_constraint") or "—"},
    ], comments))

    years = [r["fiscal_year"] for r in trend]
    fin_rows = [[name, *[_cr(r.get(key)) for r in trend]] for name, key in (
        ("Revenue", "revenue"), ("EBITDA", "ebitda"), ("PAT", "pat"), ("Total debt", "total_debt"), ("Net worth", "net_worth"))]
    ratio_rows = [[name, *[fmt(r.get(key)) for r in trend]] for name, key, fmt in (
        ("EBITDA margin", "ebitda_margin", pct), ("Revenue growth", "revenue_growth", pct), ("DSCR", "dscr", times),
        ("Interest coverage", "interest_coverage", times), ("Debt / EBITDA", "debt_to_ebitda", times),
        ("Debt / equity", "debt_equity", times), ("Current ratio", "current_ratio", times),
        ("Receivable days", "receivable_days", days), ("Inventory days", "inventory_days", days))]
    sections.append(_section("financial_analysis", "Financial analysis", "table",
                             {"header": ["₹ crore", *years], "rows": fin_rows}, comments,
                             secondary={"header": ["Ratio", *years], "rows": ratio_rows},
                             note="Source: extracted financial statements (analyst-edited values take precedence)." if years
                             else "No financial statements available."))

    gst_rows = [[c["check"], c["status"].upper(), c["detail"]] for c in fraud.get("gst_checks") or []]
    bank_rows = [[b.get("bank_name") or b.get("filename") or "Bank", inr(b.get("total_credits")), str(b.get("bounce_count", 0)),
                  pct(b.get("credit_volatility"), 0)] for b in facts.get("bank") or []]
    sections.append(_section("gst_banking", "GST & banking conduct", "table",
                             {"header": ["GST check", "Status", "Detail"], "rows": gst_rows or [["GST reconciliation", "N/A", "No GST returns analysed"]]},
                             comments, secondary={"header": ["Bank account", "Credits", "Bounces", "Credit volatility"], "rows": bank_rows}
                             if bank_rows else None))

    five = s.get("five_cs") or {}
    sections.append(_section("five_cs", "Five Cs of credit", "five_cs",
                             [{"c": v["title"], "score": v["score"], "assessment": v["assessment"].split(" — ")[0], "evidence": v["evidence"]}
                              for v in five.values()], comments))

    contribs = [c for c in s.get("contributions") or [] if not c.get("missing")][:10]
    overlays = s.get("overlays") or []
    sections.append(_section("risk_drivers", "Risk assessment & explainability (SHAP)", "table", {
        "header": ["Driver", "Value", "Score impact", "Five C"],
        "rows": [[c["label"], c["display_value"], f"{c['points']:+d}", label(c["five_c"])] for c in contribs],
    }, comments, secondary={"header": ["Overlay", "Source", "Points", "Rationale"],
                            "rows": [[o["label"], label(o["source"]), f"{o['points']:+d}", o["rationale"]] for o in overlays]} if overlays else None,
        note=f"Base score {s.get('base_points')} + model drivers = model score {s.get('model_score')}; overlays "
             f"{s.get('overlay_total', 0):+d} → final score {s.get('credit_score')}." if s else None))

    rules = policy.get("rules") or []
    sections.append(_section("policy", "Policy compliance", "table", {
        "header": ["Rule", "Type", "Threshold", "Actual", "Status"],
        "rows": [[r["name"], label(r["kind"]), r["threshold"], str(r["actual"] if r["actual"] is not None else "—"), r["status"].upper()]
                 for r in rules],
    }, comments, note=f"{len(policy.get('knockouts') or [])} knock-out(s), {len(policy.get('deviations') or [])} deviation(s)." if rules else None))

    sector = research.get("sector") or {}
    sections.append(_section("external_intelligence", "External intelligence & sector", "bullets", {
        "summary": research.get("summary") or "Secondary research has not been run for this case.",
        "badges": [{"label": "Litigation", "value": label(research.get("litigation_risk"))},
                   {"label": "Promoter sentiment", "value": label(research.get("promoter_sentiment"))},
                   {"label": "Sector outlook", "value": label(research.get("sector_outlook"))}] if research else [],
        "bullets": [f"{f['title']} — {f['source']}" for f in (research.get("findings") or [])[:6]],
        "groups": [{"title": f"Sector headwinds ({sector.get('name', '')})", "lines": sector.get("headwinds") or []},
                   {"title": "RBI / regulatory context", "lines": sector.get("rbi_context") or []}] if sector else [],
    }, comments))

    sections.append(_section("fraud", "Fraud & early-warning signals", "bullets", {
        "summary": fraud.get("summary") or "Fraud analysis has not been run for this case.",
        "badges": [{"label": "Fraud score", "value": f"{fraud.get('fraud_score')}/100"}, {"label": "Level", "value": label(fraud.get("risk_level"))}]
        if fraud else [],
        "bullets": [f"{a['severity']}: {a['title']} — {a['description']}" for a in (fraud.get("alerts") or [])[:8]],
        "groups": [{"title": "Document red flags", "lines": [f"{f['label']} ({f['severity'].title()}) — {f.get('evidence', '')[:160]}"
                                                            for f in (facts.get("red_flags") or [])[:8]]}],
    }, comments))

    sections.append(_section("loan_sizing", "Loan sizing", "table", {
        "header": ["Method", "Eligible limit (₹ cr)", "Basis"],
        "rows": [[m["method"] + (" (binding)" if m.get("binding") else ""), _cr(m["limit"]), m["basis"]] for m in sizing.get("methods") or []],
    }, comments, note=f"Recommended {inr(sizing.get('recommended_amount'))} of {inr(sizing.get('requested_amount'))} requested."
        if sizing else None))

    sections.append(_section("pricing", "Pricing & structure", "table", {
        "header": ["Component", "bps", "Rationale"],
        "rows": [[c["component"], str(c["bps"]), c["rationale"]] for c in pricing.get("components") or []],
    }, comments, note=f"All-in rate {pricing['suggested_rate']:.2f}% p.a. ({pricing.get('spread_over_benchmark', 0):+.2f}% over benchmark, grade "
                      f"{pricing.get('grade')})." if pricing.get("suggested_rate") else None))

    sections.append(_section("conditions", "Terms, conditions & covenants", "bullets", {
        "summary": "Recommended sanction conditions and the reasons behind the recommendation.",
        "bullets": s.get("conditions") or ["Not applicable — the case is not recommended for sanction."],
        "groups": [{"title": "Decision rationale", "lines": s.get("decision_reasons") or []},
                   {"title": "What would improve the outcome",
                    "lines": [f"{w['label']}: {w['current']} → {w['target']} (+{w['score_gain']} pts)" for w in s.get("what_if") or []]}],
    }, comments))

    notes = [n for n in ctx.get("notes") or [] if n.get("kind", "note") == "note" and n.get("include_in_cam", True)]
    sections.append(_section("analyst_observations", "Analyst field observations", "bullets", {
        "summary": "Qualitative observations from site visits and management meetings, with their applied score impact.",
        "bullets": [n["body"] + (f" ({n['effective_impact']:+d} pts)" if n.get("effective_impact") else "") for n in notes]
        or ["No field observations recorded."],
        "badges": [{"label": "Strengths", "value": str(len(s.get("top_strengths") or []))},
                   {"label": "Risk factors", "value": str(len(s.get("top_risk_factors") or []))}] if s else [],
    }, comments))

    docs = facts.get("documents") or []
    sections.append(_section("evidence", "Documents relied upon", "table", {
        "header": ["Document", "Type", "Extraction confidence"],
        "rows": [[d["filename"], label(d.get("doc_type")), pct(d.get("confidence"), 0)] for d in docs] or [["—", "No documents processed", "—"]],
    }, comments, note=f"Generated by CredX scoring model {s.get('model_version', '—')}; figures are traceable to these documents."))
    return sections
