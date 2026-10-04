"""Assemble a banking-grade Credit Appraisal Memo (CAM) as structured sections.

A single section model (paragraphs, key-value grids, tables, bullet lists,
callouts) is rendered by the web preview, the PDF exporter and the DOCX
exporter, so all three are always consistent.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from extraction.normalization.merge import CaseProfile
from scoring.feature_engineering.features import compute_dscr

from ..formatting.formatters import date, money, pct, ratio, times

Block = dict[str, Any]


class CamContext(BaseModel):
    model_config = {"arbitrary_types_allowed": True}

    company: dict[str, Any]
    case: dict[str, Any]
    profile: CaseProfile
    assessment: dict[str, Any] | None = None
    research: dict[str, Any] | None = None
    research_findings: list[dict[str, Any]] = Field(default_factory=list)
    fraud: dict[str, Any] | None = None
    fraud_alerts: list[dict[str, Any]] = Field(default_factory=list)
    notes: list[dict[str, Any]] = Field(default_factory=list)
    narratives: dict[str, str] = Field(default_factory=dict)  # optional AI-polished prose per section
    analyst_comments: dict[str, str] = Field(default_factory=dict)
    prepared_by: str | None = None


def p(text: str) -> Block:
    return {"type": "paragraph", "text": text}


def kv(items: list[tuple[str, Any]]) -> Block:
    return {"type": "kv", "items": [{"label": k, "value": "—" if v in (None, "") else str(v)} for k, v in items]}


def table(columns: list[str], rows: list[list[Any]], caption: str | None = None) -> Block:
    return {"type": "table", "columns": columns, "rows": [["—" if c in (None, "") else str(c) for c in r] for r in rows], "caption": caption}


def bullets(items: list[str], tone: str = "neutral") -> Block:
    return {"type": "bullets", "items": items, "tone": tone}


def callout(title: str, text: str, tone: str) -> Block:
    return {"type": "callout", "title": title, "text": text, "tone": tone}


def _decision_tone(decision: str) -> str:
    return "positive" if decision == "APPROVE" else "warning" if "CONDITIONAL" in decision else "negative"


def _final(a: dict[str, Any]) -> tuple[str, float, float]:
    if a.get("overridden"):
        return (a.get("override_decision") or a["decision"], a.get("override_amount") or a["recommended_amount"],
                a.get("override_rate") or a["suggested_rate"])
    return a["decision"], a["recommended_amount"], a["suggested_rate"]


def build_cam(ctx: CamContext) -> dict[str, Any]:
    company, case, profile = ctx.company, ctx.case, ctx.profile
    a = ctx.assessment or {}
    r = ctx.research or {}
    f = ctx.fraud or {}
    sections: list[dict[str, Any]] = []

    def section(key: str, title: str, blocks: list[Block]) -> None:
        if ctx.narratives.get(key):
            blocks = [p(ctx.narratives[key]), *blocks]
        sections.append({"key": key, "title": title, "blocks": blocks, "analyst_comment": ctx.analyst_comments.get(key, "")})

    decision, amount, rate = _final(a) if a else ("PENDING", 0.0, 0.0)

    # 1. Executive summary
    exec_blocks: list[Block] = []
    if a:
        exec_blocks.append(callout(
            f"Recommendation: {decision.title()}",
            f"{money(amount) if amount else 'No exposure'}"
            + (f" at {rate:.2f}% p.a." if amount else "")
            + f" · CredX score {a['credit_score']} ({a['grade']}) · PD {a['probability_of_default']:.2%} · Risk {a['risk_level'].title()}"
            + (" · Manual override applied" if a.get("overridden") else ""),
            _decision_tone(decision),
        ))
        exec_blocks.append(p(a.get("narrative", "")))
        if a.get("strengths"):
            exec_blocks.append({"type": "heading", "text": "Key strengths"})
            exec_blocks.append(bullets(a["strengths"], "positive"))
        if a.get("top_risk_factors"):
            exec_blocks.append({"type": "heading", "text": "Key risks"})
            exec_blocks.append(bullets(a["top_risk_factors"], "negative"))
    else:
        exec_blocks.append(p("Credit assessment has not been run yet for this case."))
    section("executive_summary", "1. Executive Summary", exec_blocks)

    # 2. Borrower profile
    directors = profile.directors
    borrower_blocks = [
        kv([
            ("Legal name", company.get("name")), ("CIN", company.get("cin") or profile.cin),
            ("PAN", company.get("pan") or profile.pan), ("GSTIN", company.get("primary_gstin") or ", ".join(profile.gstins[:2])),
            ("Constitution", company.get("constitution")), ("Incorporated", company.get("incorporation_year")),
            ("Sector / Industry", f"{company.get('sector')} / {company.get('industry') or '—'}"),
            ("Registered state", company.get("registered_state")), ("Statutory auditor", profile.auditor),
            ("External rating", company.get("external_rating")),
        ]),
    ]
    if company.get("description"):
        borrower_blocks.insert(0, p(company["description"]))
    if directors:
        borrower_blocks.append(table(["Director", "DIN", "Designation"], [[d.name, d.din, d.designation] for d in directors[:10]], "Board of directors"))
    section("borrower_profile", "2. Borrower Profile", borrower_blocks)

    # 3. Facility
    section("facility", "3. Proposed Facility", [
        kv([
            ("Facility", case.get("facility_type")), ("Requested amount", money(case.get("requested_amount"))),
            ("Tenure", f"{case.get('tenure_months')} months"), ("Purpose", case.get("purpose")),
            ("Security offered", case.get("collateral_description")), ("Security value", money(case.get("collateral_value"))),
            ("Recommended amount", money(amount) if a else "—"), ("Recommended rate", f"{rate:.2f}%" if a else "—"),
        ])
    ])

    # 4. Financial analysis
    years = profile.financials[:3]
    fin_blocks: list[Block] = []
    if years:
        cols = ["Particulars (₹)"] + [y.fiscal_year for y in years]

        def row(label: str, fn) -> list[Any]:  # type: ignore[no-untyped-def]
            return [label] + [fn(y) for y in years]

        fin_blocks.append(table(cols, [
            row("Revenue from operations", lambda y: money(y.revenue)),
            row("EBITDA", lambda y: money(y.ebitda)),
            row("EBITDA margin", lambda y: pct(ratio(y.ebitda, y.revenue))),
            row("Finance cost", lambda y: money(y.interest_expense)),
            row("PAT", lambda y: money(y.pat)),
            row("Net worth", lambda y: money(y.net_worth)),
            row("Total debt", lambda y: money(y.total_debt)),
            row("Debt / EBITDA", lambda y: times(ratio(y.total_debt, y.ebitda))),
            row("Debt / Equity", lambda y: times(ratio(y.total_debt, y.net_worth))),
            row("Current ratio", lambda y: times(ratio(y.current_assets, y.current_liabilities))),
            row("Interest coverage", lambda y: times(ratio(y.ebitda, y.interest_expense))),
            row("DSCR", lambda y: times(None if (d := compute_dscr(y)) != d else d)),
        ], "Multi-year financial summary (extracted from audited statements)"))
        latest, prev = years[0], years[1] if len(years) > 1 else None
        growth = ratio((latest.revenue or 0) - (prev.revenue or 0), prev.revenue) if prev and prev.revenue and latest.revenue else None
        fin_blocks.append(p(
            f"In {latest.fiscal_year}, revenue was {money(latest.revenue)}"
            + (f" ({growth:+.1%} YoY)" if growth is not None else "")
            + f" with EBITDA of {money(latest.ebitda)} ({pct(ratio(latest.ebitda, latest.revenue))} margin). "
            f"Total debt stood at {money(latest.total_debt)} against net worth of {money(latest.net_worth)}."
        ))
    else:
        fin_blocks.append(callout("Financials unavailable", "No audited financial statements were extracted. Upload annual reports / financial statements.", "warning"))
    section("financial_analysis", "4. Financial Analysis", fin_blocks)

    # 5. GST & banking
    gst_blocks: list[Block] = []
    checks = f.get("gst_checks") or []
    if checks:
        gst_blocks.append(table(["Check", "Result", "Observed", "Threshold"], [
            [c["label"], c["status"], c.get("detail"), c.get("threshold")] for c in checks
        ], "GST consistency (GSTR-1 / GSTR-3B / GSTR-2A / banking)"))
    bank = profile.bank
    if bank:
        gst_blocks.append(kv([
            ("Banker", bank.bank_name), ("Account", bank.account_ref), ("Months analysed", len(bank.months) or "Summary"),
            ("Total credits", money(bank.total_credits)), ("Total debits", money(bank.total_debits)),
            ("Cheque/ECS returns", bank.bounce_count), ("Limit overdrawn (days)", bank.overdraft_breach_days),
        ]))
    if not gst_blocks:
        gst_blocks.append(p("GST returns and bank statements were not provided."))
    section("gst_banking", "5. GST & Banking Conduct", gst_blocks)

    # 6. Five Cs
    five = a.get("five_cs") or {}
    if five:
        section("five_cs", "6. Five Cs of Credit", [
            table(["Dimension", "Score", "Assessment", "Key drivers"], [
                [k.title(), f"{v['score']:.0f}/100", v["rating"], "; ".join(v["drivers"][:3])]
                for k, v in five.items() if isinstance(v, dict)
            ]),
            p(f"Composite Five-Cs score: {five.get('composite', 0):.0f}/100."),
        ])

    # 7. Promoter analysis
    promoter_blocks: list[Block] = []
    promoters = [s for s in profile.shareholding if s.category == "promoter"]
    if promoters:
        promoter_blocks.append(table(["Holder", "Holding", "Pledged"], [[s.name, f"{s.holding_pct:.1f}%", f"{s.pledged_pct:.1f}%"] for s in promoters]))
    promoter_news = [x for x in ctx.research_findings if x.get("category") in {"promoter", "mca"}]
    if promoter_news:
        promoter_blocks.append(bullets([f"{x['title']} ({x['source_name']})" for x in promoter_news[:5]]))
    promoter_blocks.append(p(f"Promoter / company sentiment assessed as {r.get('promoter_sentiment', 'NEUTRAL').title()}; MCA risk {r.get('mca_risk', 'LOW').title()}."))
    section("promoter_analysis", "7. Promoter & Management Assessment", promoter_blocks)

    # 8. External intelligence
    ext_blocks: list[Block] = []
    if r:
        ext_blocks.append(kv([
            ("Litigation risk", r.get("litigation_risk")), ("Promoter sentiment", r.get("promoter_sentiment")),
            ("Sector outlook", r.get("sector_outlook")), ("Regulatory risk", r.get("regulatory_risk")),
            ("External risk score", f"{r.get('external_risk_score', 0):.0f}/100"),
        ]))
        ext_blocks.append(p(r.get("summary", "")))
        sources = [x for x in ctx.research_findings if x.get("category") not in {"sector"}][:8]
        if sources:
            ext_blocks.append(table(["#", "Finding", "Source", "Date", "Severity"], [
                [i + 1, x["title"], x["source_name"], date(x.get("published_at")), x["severity"]] for i, x in enumerate(sources)
            ], "Source-attributed findings"))
        ctx_sector = r.get("sector_context") or {}
        if ctx_sector:
            ext_blocks.append({"type": "heading", "text": f"Sector: {ctx_sector.get('label', '')}"})
            ext_blocks.append(bullets([f"Headwind: {h}" for h in ctx_sector.get("headwinds", [])[:3]]
                                      + [f"Tailwind: {t}" for t in ctx_sector.get("tailwinds", [])[:2]]))
            if ctx_sector.get("rbi_references"):
                ext_blocks.append(bullets([f"RBI / policy: {x}" for x in ctx_sector["rbi_references"]]))
    else:
        ext_blocks.append(p("Secondary research has not been run."))
    section("external_intelligence", "8. External & Sector Intelligence", ext_blocks)

    # 9. Fraud observations
    fraud_blocks: list[Block] = []
    if f:
        fraud_blocks.append(callout(f"Fraud risk: {f.get('risk_level', 'LOW').title()} ({f.get('fraud_risk_score', 0):.0f}/100)",
                                    f.get("summary", ""), "negative" if f.get("risk_level") in {"HIGH", "CRITICAL"} else "neutral"))
        if ctx.fraud_alerts:
            fraud_blocks.append(table(["Severity", "Observation", "Detail"], [
                [x["severity"], x["title"], x["description"][:220]] for x in ctx.fraud_alerts[:10]
            ]))
    else:
        fraud_blocks.append(p("Fraud analysis has not been run."))
    section("fraud_observations", "9. Fraud & Early-Warning Observations", fraud_blocks)

    # 10. Risk assessment & explainability
    if a:
        expl = a.get("explanation") or {}
        items = [i for i in expl.get("items", []) if not i.get("missing")][:8]
        risk_blocks: list[Block] = [
            p(f"Model {a.get('model_version')} produced a score of {a.get('ml_score')} (base {expl.get('base_points', 0):.0f} points). "
              f"Qualitative overlays contributed {a.get('overlay_points', 0):+.0f} points, giving a final score of {a['credit_score']}."),
            table(["Driver", "Value", "Score impact", "Interpretation"], [
                [i["label"], i["display_value"], f"{i['points']:+.1f}", i["explanation"]] for i in items
            ], "Top SHAP drivers"),
        ]
        if a.get("overlays"):
            risk_blocks.append(table(["Overlay", "Source", "Points"], [[o["label"], o["source"].replace("_", " "), f"{o['points']:+.1f}"] for o in a["overlays"]]))
        if a.get("policy_checks"):
            risk_blocks.append(table(["Policy check", "Status", "Value", "Threshold"], [
                [c["label"], c["status"], c["value"], c["threshold"]] for c in a["policy_checks"]
            ]))
        section("risk_assessment", "10. Risk Assessment & Explainability", risk_blocks)

        # 11. Pricing & structure
        pricing, sizing = a.get("pricing") or {}, a.get("loan_sizing") or {}
        section("pricing", "11. Pricing & Loan Structuring", [
            table(["Component", "bps"], [[c["component"], c["bps"]] for c in pricing.get("components", [])], f"All-in rate: {pricing.get('suggested_rate', 0):.2f}% p.a."),
            table(["Sizing method", "Eligible amount", "Basis"], [[m["method"], money(m["amount"]), m["basis"]] for m in sizing.get("methods", [])],
                  f"Binding constraint: {sizing.get('binding_method', '—')} · score haircut {sizing.get('score_haircut', 1):.0%}"),
        ])

        # 12. Decision
        decision_blocks: list[Block] = [callout(decision.title(), a.get("narrative", ""), _decision_tone(decision))]
        if a.get("overridden"):
            decision_blocks.append(callout("Manual override", a.get("override_reason") or "", "warning"))
        if a.get("conditions"):
            decision_blocks.append({"type": "heading", "text": "Terms & conditions / covenants"})
            decision_blocks.append(bullets(a["conditions"]))
        if a.get("escalation_required"):
            decision_blocks.append(callout("Escalation", "This proposal requires Credit Committee approval due to policy deviations or elevated risk.", "warning"))
        section("decision", "12. Recommendation & Approval Logic", decision_blocks)

    # 13. Analyst observations
    notes = [n for n in ctx.notes if n.get("include_in_cam", True)]
    if notes:
        section("analyst_observations", "13. Analyst Field Observations", [
            table(["Date", "Category", "Observation", "Score impact"], [
                [date(n.get("created_at")), n.get("category", "").replace("_", " ").title(), n["content"], f"{n.get('score_impact', 0):+.0f}"]
                for n in notes
            ])
        ])

    return {
        "title": f"Credit Appraisal Memo — {company.get('name')}",
        "reference": case.get("reference_code"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "prepared_by": ctx.prepared_by,
        "recommendation": decision,
        "headline": {
            "credit_score": a.get("credit_score"), "grade": a.get("grade"), "risk_level": a.get("risk_level"),
            "amount": amount, "rate": rate, "fraud_risk": f.get("risk_level"), "pd": a.get("probability_of_default"),
        },
        "sections": sections,
    }
