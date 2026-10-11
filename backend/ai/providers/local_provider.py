"""Deterministic, grounded fallback provider: answers from the structured case context with no API key.

It never invents facts — every sentence is assembled from engine outputs (score, SHAP drivers, policy,
fraud, research, notes) — so the copilot and CAM keep working offline and in tests.
"""

from __future__ import annotations

import re
import time
from typing import Any

from ai.providers.base import LLMRequest, LLMResult
from utils.india import format_inr_short as money

_INTENTS: list[tuple[str, str]] = [
    ("fraud", r"fraud|circular|round[- ]trip|shell|graph|related[- ]part|common director"),
    ("gst", r"\bgst|gstr|\bitc\b|input tax"),
    ("legal", r"litigation|legal|nclt|court|lawsuit|arbitration|notice"),
    ("sector", r"sector|industry|macro|rbi|outlook"),
    ("pricing", r"\brate\b|pricing|interest|spread|bps"),
    ("amount", r"amount|limit|how much|sizing|sanction|eligib|exposure"),
    ("improve", r"condition|covenant|mitigat|improve|what if|what would|change the decision"),
    ("notes", r"note|site visit|analyst|observation"),
    ("financials", r"dscr|ratio|revenue|ebitda|debt|leverage|margin|financial|profit|liquidity"),
    ("why", r"why|explain|reason|driver|score|decision|declin|reject|approv|refer"),
]


def _intent(question: str) -> str:
    q = question.lower()
    return next((intent for intent, pattern in _INTENTS if re.search(pattern, q)), "summary")


def _clause(text: str) -> str:
    """Lower-case the first letter for use mid-sentence, leaving acronyms (DSCR, GST) intact."""
    return text if len(text) > 1 and text[1].isupper() else text[:1].lower() + text[1:]


def _decision(d: str | None) -> str:
    return (d or "n/a").replace("_", " ")


def answer(ctx: dict[str, Any], question: str) -> str:
    company = (ctx.get("company") or {}).get("name", "The borrower")
    s, f, r = ctx.get("score") or {}, ctx.get("fraud") or {}, ctx.get("research") or {}
    intent = _intent(question)
    if not ctx.get("company"):
        return ("Open a case to ask about a specific borrower. I can explain scores and SHAP drivers, fraud-graph alerts, "
                "GST reconciliation, litigation, loan sizing, pricing and CAM content.")
    if not s and intent in {"why", "pricing", "amount", "improve", "financials", "summary"}:
        return f"{company} has not been scored yet. Upload documents and run the full analysis, then ask again."

    if intent in {"fraud", "gst"}:
        if not f:
            return f"Fraud and GST analysis has not run for {company} yet."
        lines = [f"Fraud score {f.get('fraud_score')}/100 ({f.get('risk_level')}). {f.get('summary', '')} [source: fraud engine]"]
        lines += [f"- {a['severity']}: {a['title']} — {a['description']}" for a in (f.get("alerts") or [])[:4]]
        lines += [f"- GST check '{c['check']}': {c['status'].upper()} — {c['detail']}" for c in (f.get("gst_checks") or [])[:4]]
        return "\n".join(lines)
    if intent == "legal":
        if not r:
            return f"Secondary research has not run for {company} yet."
        items = [x for x in r.get("findings") or [] if x.get("category") == "litigation"][:5]
        lines = [f"Litigation risk {r.get('litigation_risk')} (score {r.get('litigation_score', 0):.0f}/100). [source: research engine]"]
        lines += [f"- {x['title']} ({x['source']})" for x in items] or ["- No litigation found in documents or public sources."]
        return "\n".join(lines)
    if intent == "sector":
        sector = (r.get("sector") or {}) if r else {}
        if not sector:
            return "Sector view is not available until research has run."
        return (f"{sector.get('name')} outlook is {str(sector.get('outlook', '')).lower()} (risk {sector.get('risk')}/100). "
                f"Headwinds: {'; '.join(sector.get('headwinds', [])[:2])}. RBI/policy context: {'; '.join(sector.get('rbi_context', [])[:2])}. "
                "[source: sector knowledge base]")
    if intent == "pricing":
        comps = "; ".join(f"{c['component']} {c['bps']} bps" for c in (s.get("pricing") or {}).get("components", []))
        return f"Suggested rate {s.get('suggested_rate', 0):.2f}% p.a. — {comps}. [source: pricing engine]"
    if intent == "amount":
        sz = s.get("loan_sizing") or {}
        methods = "; ".join(f"{m['method']} {money(m['limit'])}" for m in sz.get("methods", []))
        return (f"Recommended {money(s.get('recommended_amount'))} against {money(sz.get('requested_amount'))} requested; binding "
                f"constraint: {sz.get('binding_constraint')}. Methods — {methods}. [source: loan sizing]")
    if intent == "improve":
        lines = [f"- {w['label']}: {w['current']} → {w['target']} adds about {w['score_gain']} points" for w in s.get("what_if") or []]
        conds = [f"- {c}" for c in s.get("conditions") or []]
        return "\n".join(["What would move the decision:", *(lines or ["- No single lever moves the score materially."]),
                          "Proposed conditions:", *(conds or ["- Not applicable for the current recommendation."])])
    if intent == "notes":
        notes = [n for n in ctx.get("notes") or [] if n.get("kind", "note") == "note"]
        if not notes:
            return "No analyst notes recorded on this case yet."
        return "\n".join(f"- {n['body']} (impact {n.get('effective_impact') or 0:+d} pts)" for n in notes[:6])
    if intent == "financials":
        ratios = (s.get("ratios") or {}).get("latest") or {}
        if not ratios:
            return "No financial statements have been extracted — upload audited financials."

        def x(k: str, pct: bool = False) -> str:
            v = ratios.get(k)
            return "n/a" if v is None else (f"{v * 100:.1f}%" if pct else f"{v:.2f}x")

        return (f"{ratios.get('fiscal_year')}: revenue {money(ratios.get('revenue'))}, EBITDA margin {x('ebitda_margin', True)}, "
                f"DSCR {x('dscr')}, Debt/EBITDA {x('debt_to_ebitda')}, Debt/Equity {x('debt_equity')}, current ratio {x('current_ratio')}, "
                f"interest cover {x('interest_coverage')}. [source: financial statements]")

    neg = [c for c in s.get("contributions") or [] if c["points"] < 0 and not c.get("missing")][:3]
    pos = [c for c in s.get("contributions") or [] if c["points"] > 0 and not c.get("missing")][:2]
    lines = [f"{company} scores {s['credit_score']} ({s.get('rating')}, {str(s.get('risk_level', '')).lower()} risk, "
             f"PD {s.get('probability_of_default', 0) * 100:.2f}%) → recommendation {s['decision']} ({_decision(s['decision']).lower()}). "
             "[source: scoring engine]"]
    lines += [f"- Risk driver: {c['description']} ({c['points']:+d} pts)" for c in neg]
    lines += [f"- Mitigant: {c['description']} ({c['points']:+d} pts)" for c in pos]
    lines += [f"- Overlay: {o['label']} ({o['points']:+d} pts, {o['source'].replace('_', ' ')})" for o in (s.get("overlays") or [])[:2]]
    lines += [f"- Policy: {reason}" for reason in (s.get("decision_reasons") or [])[:2]]
    return "\n".join(lines)


def cam_paragraph(ctx: dict[str, Any]) -> str:
    company, case = ctx.get("company") or {}, ctx.get("case") or {}
    s, f, r = ctx.get("score") or {}, ctx.get("fraud") or {}, ctx.get("research") or {}
    if not s:
        return f"{company.get('name', 'The borrower')} has applied for {money(case.get('requested_amount'))}; the case is pending scoring."
    drivers = [_clause(c["description"]) for c in s.get("contributions") or [] if c["points"] < 0 and not c.get("missing")][:2]
    strengths = [_clause(c["description"]) for c in s.get("contributions") or [] if c["points"] > 0 and not c.get("missing")][:2]
    text = (f"{company.get('name')} ({company.get('sector', 'n/a').replace('_', ' ')}) has requested a {case.get('facility_type', 'credit facility')} "
            f"of {money(case.get('requested_amount'))} for {case.get('purpose') or 'general corporate purposes'}. The account scores "
            f"{s['credit_score']} on the CredX scale (grade {s.get('rating')}, probability of default {s.get('probability_of_default', 0) * 100:.2f}%), "
            f"and the engine recommends {_decision(s['decision']).lower()} with an eligible amount of {money(s.get('recommended_amount'))} "
            f"at {s.get('suggested_rate', 0):.2f}% p.a.")
    if strengths:
        text += f" Credit strengths include {' and '.join(strengths)}."
    if drivers:
        text += f" Principal concerns are {' and '.join(drivers)}."
    if f:
        text += f" Forensic review assigns a fraud score of {f.get('fraud_score')}/100 ({str(f.get('risk_level', '')).lower()})."
    if r:
        text += (f" External research rates litigation risk {str(r.get('litigation_risk', '')).lower()} and promoter sentiment "
                 f"{str(r.get('promoter_sentiment', '')).lower()}.")
    return text


class LocalProvider:
    name = "local"
    model = "credx-grounded-v2"

    def available(self) -> bool:
        return True

    def complete(self, request: LLMRequest) -> LLMResult:
        started = time.perf_counter()
        if request.purpose == "cam_narrative":
            text = cam_paragraph(request.context)
        elif request.purpose == "research_summary":
            text = request.context.get("draft_summary", "")
        else:
            text = answer(request.context, request.messages[-1].content if request.messages else "")
        prompt_words = sum(len(m.content.split()) for m in request.messages)
        return LLMResult(text, self.name, self.model, prompt_words, max(1, len(text.split())),
                         round((time.perf_counter() - started) * 1000, 1))
