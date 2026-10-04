"""Render a structured case snapshot into compact prompt context."""

from __future__ import annotations

from typing import Any

from utils.inr import format_inr_compact as money


def render_case_context(ctx: dict[str, Any]) -> str:
    lines: list[str] = []
    company, case = ctx.get("company", {}), ctx.get("case", {})
    lines.append(f"Borrower: {company.get('name')} | Sector: {company.get('sector')} | CIN: {company.get('cin') or 'n/a'} | GSTIN: {company.get('primary_gstin') or 'n/a'}")
    lines.append(f"Facility: {case.get('facility_type')} of {money(case.get('requested_amount'))} for {case.get('tenure_months')} months; purpose: {case.get('purpose') or 'n/a'}; status: {case.get('status')}")

    for y in ctx.get("financials", [])[:3]:
        lines.append(
            f"[financials {y.get('fiscal_year')}] revenue {money(y.get('revenue'))}, EBITDA {money(y.get('ebitda'))}, PAT {money(y.get('pat'))}, "
            f"debt {money(y.get('total_debt'))}, net worth {money(y.get('net_worth'))}, finance cost {money(y.get('interest_expense'))}"
        )
    a = ctx.get("assessment")
    if a:
        lines.append(
            f"[assessment] score {a.get('credit_score')} (ML {a.get('ml_score')}, overlays {a.get('overlay_points'):+}), grade {a.get('grade')}, "
            f"risk {a.get('risk_level')}, PD {a.get('probability_of_default', 0):.2%}, decision {a.get('decision')}, "
            f"recommended {money(a.get('recommended_amount'))} at {a.get('suggested_rate')}%"
        )
        for item in (a.get("explanation") or {}).get("items", [])[:8]:
            if not item.get("missing"):
                lines.append(f"[shap] {item['label']}: {item['display_value']} → {item['points']:+.1f} pts ({item['explanation']})")
        for o in a.get("overlays", [])[:6]:
            lines.append(f"[overlay] {o['label']}: {o['points']:+.1f} pts (source: {o['source']})")
        for p in a.get("policy_checks", []):
            if p["status"] != "PASS":
                lines.append(f"[policy] {p['label']}: {p['status']} (value {p['value']}, threshold {p['threshold']})")
        if a.get("conditions"):
            lines.append("[conditions] " + " | ".join(a["conditions"][:5]))
    r = ctx.get("research")
    if r:
        lines.append(f"[research] litigation {r.get('litigation_risk')}, promoter sentiment {r.get('promoter_sentiment')}, sector {r.get('sector_outlook')}, external risk {r.get('external_risk_score')}/100")
        lines.append(f"[research summary] {r.get('summary')}")
    for f in ctx.get("research_findings", [])[:6]:
        lines.append(f"[finding:{f.get('category')}] {f.get('title')} — {f.get('source_name')} ({f.get('severity')})")
    fr = ctx.get("fraud")
    if fr:
        lines.append(f"[fraud] score {fr.get('fraud_risk_score')}/100, level {fr.get('risk_level')}: {fr.get('summary')}")
        for c in fr.get("gst_checks", [])[:6]:
            lines.append(f"[gst check] {c['label']}: {c['status']} — {c['detail']}")
    for alert in ctx.get("fraud_alerts", [])[:5]:
        lines.append(f"[fraud alert:{alert.get('severity')}] {alert.get('title')}")
    for n in ctx.get("notes", [])[:6]:
        lines.append(f"[analyst note:{n.get('category')}] {n.get('content')} (impact {n.get('score_impact', 0):+.0f})")
    for d in ctx.get("documents", [])[:10]:
        lines.append(f"[document] {d.get('filename')} — {d.get('doc_type')} (confidence {d.get('confidence', 0):.0%})")
    return "\n".join(lines)
