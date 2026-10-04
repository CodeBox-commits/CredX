"""Deterministic, grounded fallback provider — answers from case context with no API key."""

from __future__ import annotations

import re
import time
from typing import Any

from utils.inr import format_inr_compact as money

from .base import LLMRequest, LLMResponse


def _intent(q: str) -> str:
    q = q.lower()
    for intent, pattern in [
        ("fraud", r"fraud|circular|round|fake|shell"), ("gst", r"gst|itc|gstr"),
        ("legal", r"litigation|legal|nclt|court|case"), ("sector", r"sector|industry|rbi|macro"),
        ("pricing", r"rate|pricing|interest|spread"), ("amount", r"amount|limit|how much|sizing|eligib"),
        ("conditions", r"condition|covenant|mitigat"), ("financials", r"dscr|ratio|revenue|ebitda|debt|financial|margin"),
        ("why", r"why|explain|reason|driver|score|decision|reject|approv"),
    ]:
        if re.search(pattern, q):
            return intent
    return "summary"


def answer(ctx: dict[str, Any], question: str) -> str:
    a, r, f = ctx.get("assessment") or {}, ctx.get("research") or {}, ctx.get("fraud") or {}
    name = (ctx.get("company") or {}).get("name", "The borrower")
    intent = _intent(question)
    if not a and intent in {"why", "pricing", "amount", "conditions"}:
        return "The case has not been scored yet. Run the analysis pipeline, then ask again."
    if intent == "why":
        neg = [i for i in (a.get("explanation") or {}).get("items", []) if i["points"] < 0 and not i.get("missing")][:3]
        pos = [i for i in (a.get("explanation") or {}).get("items", []) if i["points"] > 0 and not i.get("missing")][:2]
        out = [f"{name} scored {a['credit_score']} ({a['grade']}, {a['risk_level'].lower()} risk) → {a['decision'].title()}. [source: assessment]"]
        out += [f"- {i['explanation']} ({i['points']:+.0f} pts) [source: SHAP]" for i in neg]
        out += [f"- Mitigant: {i['explanation']} ({i['points']:+.0f} pts)" for i in pos]
        out += [f"- Overlay: {o['label']} ({o['points']:+.0f} pts)" for o in a.get("overlays", [])[:2]]
        return "\n".join(out)
    if intent == "pricing":
        comps = ", ".join(f"{c['component']} {c['bps']} bps" for c in (a.get("pricing") or {}).get("components", []))
        return f"Suggested rate is {a['suggested_rate']:.2f}% p.a.: {comps}. [source: pricing engine]"
    if intent == "amount":
        s = a.get("loan_sizing") or {}
        methods = "; ".join(f"{m['method']}: {money(m['amount'])}" for m in s.get("methods", []))
        return f"Recommended {money(a['recommended_amount'])} (binding: {s.get('binding_method')}). Methods — {methods}. [source: loan sizing]"
    if intent == "conditions":
        return "\n".join(f"- {c}" for c in a.get("conditions", [])) or "No sanction conditions — the case is not recommended."
    if intent in {"fraud", "gst"}:
        if not f:
            return "Fraud/GST analysis has not been run yet."
        lines = [f"Fraud risk {f.get('risk_level')} ({f.get('fraud_risk_score', 0):.0f}/100). {f.get('summary', '')} [source: fraud engine]"]
        lines += [f"- {c['label']}: {c['status']} — {c['detail']}" for c in f.get("gst_checks", [])[:5]]
        return "\n".join(lines)
    if intent == "legal":
        items = [x for x in ctx.get("research_findings", []) if x.get("category") == "litigation"]
        return f"Litigation risk: {r.get('litigation_risk', 'n/a')}.\n" + "\n".join(f"- {x['title']} [{x['source_name']}]" for x in items[:5])
    if intent == "sector":
        sc = r.get("sector_context") or {}
        return (f"{sc.get('label', 'Sector')} outlook: {r.get('sector_outlook', 'n/a')}. Headwinds: {'; '.join(sc.get('headwinds', [])[:2])}. "
                f"RBI/policy: {'; '.join(sc.get('rbi_references', [])[:2])}. [source: sector knowledge base]")
    if intent == "financials":
        ys = ctx.get("financials", [])[:2]
        if not ys:
            return "No financial statements have been extracted — upload audited financials."
        return "\n".join(f"- {y['fiscal_year']}: revenue {money(y.get('revenue'))}, EBITDA {money(y.get('ebitda'))}, debt {money(y.get('total_debt'))}, net worth {money(y.get('net_worth'))}" for y in ys)
    return (f"{name}: " + (a.get("narrative") or "not yet scored.") + (f" External view: {r.get('summary')}" if r else ""))


class LocalProvider:
    name = "local"
    model = "credx-grounded-v1"

    def available(self) -> bool:
        return True

    def complete(self, request: LLMRequest) -> LLMResponse:
        started = time.perf_counter()
        question = request.messages[-1].content if request.messages else ""
        text = answer(request.context, question)
        return LLMResponse(text=text, provider=self.name, model=self.model,
                           latency_ms=int((time.perf_counter() - started) * 1000))
