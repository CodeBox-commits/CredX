"""Bank statements: header facts, transaction parsing, monthly cash-flow, bounces and counterparties."""

from __future__ import annotations

import re
import statistics
from collections import defaultdict
from datetime import datetime

from extraction.normalization.amounts import find_amounts

_BANK_RE = re.compile(
    r"\b((?:State Bank of India|Bank of Baroda|Bank of India|Punjab National Bank|Canara Bank|Union Bank of India|Indian Bank|"
    r"Indian Overseas Bank|Central Bank of India|UCO Bank|Bank of Maharashtra|Punjab & Sind Bank|HDFC Bank|ICICI Bank|Axis Bank|"
    r"Kotak Mahindra Bank|IndusInd Bank|Yes Bank|IDFC First Bank|Federal Bank|RBL Bank|South Indian Bank|Karur Vysya Bank|"
    r"City Union Bank|Bandhan Bank|DCB Bank|Tamilnad Mercantile Bank|Karnataka Bank|Jammu & Kashmir Bank|AU Small Finance Bank))\b",
    re.I,
)
_TXN_RE = re.compile(
    r"^(\d{2}[-/.]\d{2}[-/.]\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*(?:cr|dr)?$", re.I | re.M)
_BOUNCE_RE = re.compile(r"(?:chq|cheque|ecs|nach)[^\n]{0,15}(?:return|bounce|dishono)|insufficient funds|funds insufficient", re.I)
_NEG_RE = re.compile(r"\b(?:no|not|nil|without)\b[^.\n]{0,30}(?:chq|cheque|ecs|nach|return|bounce)", re.I)
_GENERIC = re.compile(r"salary|payroll|gst payment|cbic|emi|loan a/c|electricity|interest|charges|tax|chq return|cash", re.I)


def _num(raw: str) -> float:
    return float(raw.replace(",", ""))


def _date(raw: str) -> datetime | None:
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def _party(narration: str) -> str | None:
    parts = [p.strip() for p in narration.split("/") if p.strip()]
    if len(parts) < 2 or _GENERIC.search(narration):
        return None
    name = parts[-1]
    if re.fullmatch(r"[\dA-Z]{0,4}\d{6,}", name):
        return None
    return " ".join(w.capitalize() for w in name.split())


def _labelled_amount(text: str, label: str) -> float | None:
    m = re.search(label + r"[^\n:]{0,15}:?\s*([^\n]+)", text, re.I)
    if not m:
        return None
    amounts = find_amounts(m.group(1), money_only=True) or find_amounts(m.group(1))
    return amounts[0][0] if amounts else None


def extract_bank(text: str) -> dict:
    txns = []
    for m in _TXN_RE.finditer(text):
        when = _date(m.group(1))
        if when is None:
            continue
        txns.append({"date": when, "narration": m.group(2).strip(), "debit": _num(m.group(3)), "credit": _num(m.group(4)),
                     "balance": _num(m.group(5))})
    bounces = sum(1 for t in txns if _BOUNCE_RE.search(t["narration"]))
    if not txns:  # summary statements: count narrative mentions instead
        bounces = sum(1 for line in text.splitlines() if _BOUNCE_RE.search(line) and not _NEG_RE.search(line))

    monthly: dict[str, dict] = defaultdict(lambda: {"credits": 0.0, "debits": 0.0, "bounces": 0, "closing_balance": None, "count": 0})
    parties: dict[str, dict] = {}
    for t in txns:
        month = t["date"].strftime("%Y-%m")
        row = monthly[month]
        row["credits"] += t["credit"]
        row["debits"] += t["debit"]
        row["count"] += 1
        row["closing_balance"] = t["balance"]
        if _BOUNCE_RE.search(t["narration"]):
            row["bounces"] += 1
        if name := _party(t["narration"]):
            p = parties.setdefault(name, {"name": name, "credits": 0.0, "debits": 0.0, "count": 0})
            p["credits"] += t["credit"]
            p["debits"] += t["debit"]
            p["count"] += 1
    months = [{"month": k, **{f: round(v, 2) if isinstance(v, float) else v for f, v in row.items()}}
              for k, row in sorted(monthly.items())]
    credits = [m["credits"] for m in months]
    volatility = round(statistics.pstdev(credits) / statistics.mean(credits), 3) if len(credits) >= 2 and statistics.mean(credits) else None
    balances = [t["balance"] for t in txns]
    counterparties = sorted(parties.values(), key=lambda p: -(p["credits"] + p["debits"]))
    for p in counterparties:
        p["direction"] = "customer" if p["credits"] >= p["debits"] else "supplier"
        p["credits"], p["debits"] = round(p["credits"], 2), round(p["debits"], 2)

    account = re.search(r"account (?:number|no\.?)[^\n\d]{0,20}([X*\d]{4,20})", text, re.I)
    period = re.search(r"(?:statement )?period[^\n:]{0,5}:?\s*([A-Za-z]+ \d{4})\s+(?:to|-)\s+([A-Za-z]+ \d{4})", text, re.I)
    bank_name = _BANK_RE.search(text)
    return {
        "bank_name": bank_name.group(1) if bank_name else None,
        "account_masked": ("XXXX" + account.group(1)[-4:]) if account else None,
        "period_start": _month_start(period.group(1)) if period else (txns[0]["date"].date().isoformat() if txns else None),
        "period_end": _month_end(period.group(2)) if period else (txns[-1]["date"].date().isoformat() if txns else None),
        "opening_balance": _labelled_amount(text, "opening balance"),
        "closing_balance": _labelled_amount(text, "closing balance"),
        "total_credits": round(sum(t["credit"] for t in txns), 2) if txns else None,
        "total_debits": round(sum(t["debit"] for t in txns), 2) if txns else None,
        "average_balance": round(statistics.mean(balances), 2) if balances else None,
        "transaction_count": len(txns),
        "bounce_count": bounces,
        "overdraw_days": sum(1 for b in balances if b < 0),
        "credit_volatility": volatility,
        "monthly": months,
        "counterparties": counterparties[:25],
    }


def _month_start(raw: str) -> str | None:
    try:
        return datetime.strptime(raw, "%B %Y").date().isoformat()
    except ValueError:
        return None


def _month_end(raw: str) -> str | None:
    try:
        d = datetime.strptime(raw, "%B %Y")
    except ValueError:
        return None
    nxt = d.replace(year=d.year + (d.month == 12), month=d.month % 12 + 1)
    return (nxt.date().fromordinal(nxt.toordinal() - 1)).isoformat()
