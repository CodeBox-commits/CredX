"""Bank statement analytics: monthly credits/debits, balances, bounces, counterparties."""

from __future__ import annotations

import re

from ..normalization.amounts import parse_amount
from ..normalization.fiscal import parse_month
from ..normalization.schema import BankMonthData, BankSummary, Counterparty, ExtractedTable

_BANKS = [
    "State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "Bank of Baroda",
    "Punjab National Bank", "Canara Bank", "Union Bank of India", "IndusInd Bank", "Yes Bank", "IDFC First Bank",
    "Federal Bank", "Bank of India", "Indian Bank", "RBL Bank", "South Indian Bank", "Karur Vysya Bank",
]

_COLS = [
    (re.compile(r"credit|deposit|inflow|receipts", re.I), "credits"),
    (re.compile(r"debit|withdrawal|outflow|payments", re.I), "debits"),
    (re.compile(r"avg|average", re.I), "avg_balance"),
    (re.compile(r"closing|eod|end balance", re.I), "closing_balance"),
    (re.compile(r"inward.*(?:bounce|return)|(?:bounce|return).*inward", re.I), "inward_bounces"),
    (re.compile(r"bounce|return|dishono", re.I), "outward_bounces"),
    (re.compile(r"emi|loan repay", re.I), "emi_debits"),
    (re.compile(r"cash dep", re.I), "cash_deposits"),
]

_INT_FIELDS = {"inward_bounces", "outward_bounces"}


def _months_from_tables(tables: list[ExtractedTable], multiplier: float) -> list[BankMonthData]:
    months: dict[str, BankMonthData] = {}
    for table in tables:
        col_map: dict[int, str] = {}
        for idx, head in enumerate(table.header):
            for pattern, field in _COLS:
                if pattern.search(head) and field not in col_map.values():
                    col_map[idx] = field
                    break
        if "credits" not in col_map.values():
            continue
        for row in table.rows:
            month = parse_month(row[0])
            if not month:
                continue
            item = months.setdefault(month, BankMonthData(month=month))
            for idx, field in col_map.items():
                if idx >= len(row):
                    continue
                if field in _INT_FIELDS:
                    digits = re.search(r"\d+", row[idx])
                    setattr(item, field, int(digits.group()) if digits else 0)
                else:
                    value = parse_amount(row[idx], default_multiplier=multiplier)
                    if value is not None:
                        setattr(item, field, value)
    return sorted(months.values(), key=lambda m: m.month)


def extract_bank(pages: list[str], tables: list[ExtractedTable], *, multiplier: float) -> BankSummary:
    text = "\n".join(pages)
    lowered = text.lower()
    summary = BankSummary(months=_months_from_tables(tables, multiplier))
    summary.bank_name = next((b for b in _BANKS if b.lower() in lowered), None)
    acct = re.search(r"account (?:number|no\.?)[^\d\n]{0,25}(?:x+|\*+)?(\d{4})\b", text, re.I) or re.search(
        r"ending (?:with )?(\d{4})", text, re.I
    )
    if acct:
        summary.account_ref = f"XX{acct.group(1)}"

    for attr, pattern in (
        ("opening_balance", r"opening balance[^\n\d₹]{0,15}((?:rs\.?|inr|₹)?\s*[\d,.]+\s*(?:crores?|cr|lakhs?|lacs?)?)"),
        ("closing_balance", r"closing balance[^\n\d₹]{0,15}((?:rs\.?|inr|₹)?\s*[\d,.]+\s*(?:crores?|cr|lakhs?|lacs?)?)"),
        ("total_credits", r"total credits?[^\n\d₹]{0,15}((?:rs\.?|inr|₹)?\s*[\d,.]+\s*(?:crores?|cr|lakhs?|lacs?)?)"),
        ("total_debits", r"total debits?[^\n\d₹]{0,15}((?:rs\.?|inr|₹)?\s*[\d,.]+\s*(?:crores?|cr|lakhs?|lacs?)?)"),
    ):
        m = re.search(pattern, text, re.I)
        if m:
            setattr(summary, attr, parse_amount(m.group(1), default_multiplier=multiplier))

    if summary.months:
        summary.total_credits = summary.total_credits or round(sum(m.credits for m in summary.months), 2)
        summary.total_debits = summary.total_debits or round(sum(m.debits for m in summary.months), 2)
    bounce_words = len(re.findall(r"cheque (?:returned|bounced?|dishonou?red)|insufficient funds|ecs return|nach return", lowered))
    summary.bounce_count = sum(m.outward_bounces for m in summary.months) or bounce_words
    breach = re.search(r"above sanctioned (?:levels?|limit)[^\n\d]{0,20}(\d+)\s*days", lowered) or re.search(
        r"overdrawn[^\n\d]{0,20}(\d+)\s*days", lowered
    )
    summary.overdraft_breach_days = int(breach.group(1)) if breach else 0

    for m in re.finditer(r"(?:top (?:credit|receipt) from|received from|paid to|transfer to)\s+([A-Z][A-Za-z0-9&.' -]{3,60}?)\s*[:\-]\s*((?:rs\.?|inr|₹)?\s*[\d,.]+\s*(?:crores?|cr|lakhs?)?)", text):
        direction = "customer" if "from" in m.group(0).lower() else "supplier"
        summary.counterparties.append(
            Counterparty(name=m.group(1).strip(), amount=parse_amount(m.group(2), default_multiplier=multiplier), role=direction)  # type: ignore[arg-type]
        )
    return summary
