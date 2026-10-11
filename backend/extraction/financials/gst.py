"""GST return summaries: GSTR-1 / 3B / 2A / 2B turnover, ITC, tax paid, filing delay and 2A-vs-3B mismatch."""

from __future__ import annotations

import re
from datetime import datetime

from extraction.normalization.amounts import find_amounts
from extraction.normalization.fiscal import find_fiscal_years
from utils.india import GSTIN_RE, is_valid_gstin

_RETURN_RE = re.compile(r"\bGSTR[- ]?(1|3B|2A|2B|9|9C)\b[^\n:]{0,40}?(?:turnover|outward supplies|taxable value|sales)?[^\n]*?:\s*([^\n]+)", re.I)
_ITC_RE = re.compile(r"input tax credit[^\n:]{0,25}(?:claimed|availed)?\s*:\s*([^\n]+)", re.I)
_TAX_RE = re.compile(r"(?:total )?tax paid[^\n:]{0,20}:\s*([^\n]+)", re.I)
_DUE_RE = re.compile(r"due date[^\n:]{0,15}:\s*(\d{2}[-/.]\d{2}[-/.]\d{4})", re.I)
_FILED_RE = re.compile(r"(?:date of filing|filed on)[^\n:]{0,10}:\s*(\d{2}[-/.]\d{2}[-/.]\d{4})", re.I)


def _date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def _money(raw: str) -> float | None:
    amounts = find_amounts(raw, money_only=True) or find_amounts(raw)
    return amounts[0][0] if amounts else None


def mismatch_pct(gstr3b: float | None, gstr2: float | None) -> float | None:
    """Share of GSTR-3B turnover not corroborated by counterparty filings (2A/2B), in %."""
    if not gstr3b or gstr2 is None:
        return None
    return round(abs(gstr3b - gstr2) / gstr3b * 100, 2)


def extract_gst(text: str) -> dict:
    returns: list[dict] = []
    for m in _RETURN_RE.finditer(text):
        value = _money(m.group(2))
        rtype = f"GSTR-{m.group(1).upper()}"
        if value is not None and rtype not in {r["return_type"] for r in returns}:
            returns.append({"return_type": rtype, "turnover": value, "evidence": m.group(0).strip()[:200]})
    by_type = {r["return_type"]: r["turnover"] for r in returns}
    gstins = [g for g in dict.fromkeys(GSTIN_RE.findall(text.upper())) if is_valid_gstin(g)]
    due, filed = _date((_DUE_RE.search(text) or [None, None])[1]), _date((_FILED_RE.search(text) or [None, None])[1])
    fys = find_fiscal_years(text)
    counter = by_type.get("GSTR-2A") or by_type.get("GSTR-2B")
    return {
        "gstin": gstins[0] if gstins else None,
        "period": fys[0] if fys else None,
        "returns": returns,
        "gstr1_turnover": by_type.get("GSTR-1"),
        "gstr3b_turnover": by_type.get("GSTR-3B"),
        "gstr2a_turnover": counter,
        "mismatch_pct": mismatch_pct(by_type.get("GSTR-3B"), counter),
        "gstr1_vs_3b_pct": mismatch_pct(by_type.get("GSTR-3B"), by_type.get("GSTR-1")),
        "itc_claimed": _money(m.group(1)) if (m := _ITC_RE.search(text)) else None,
        "tax_paid": _money(m.group(1)) if (m := _TAX_RE.search(text)) else None,
        "due_date": due.date().isoformat() if due else None,
        "filed_on": filed.date().isoformat() if filed else None,
        "days_late": max(0, (filed - due).days) if due and filed else None,
    }
