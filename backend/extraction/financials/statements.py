"""Financial statements: map P&L / balance-sheet / cash-flow line items to canonical fields per fiscal year.

Sources, in order of confidence: statement line items under an FY header (0.92), table rows (0.9),
narrative sentences ("Revenue for FY25 was INR 186 crore", 0.75) and derived totals (0.6).
Every value keeps its page and the exact source line for provenance in the UI and CAM.
"""

from __future__ import annotations

import re
from typing import Any

from extraction.normalization.amounts import detect_scale, find_amounts
from extraction.normalization.fiscal import find_fiscal_years

# Order matters: more specific labels first ("total current assets" before "total assets").
FIELD_PATTERNS: list[tuple[str, str]] = [
    ("current_portion_ltd", r"current maturities of long[- ]term (?:debt|borrowings)"),
    ("long_term_debt", r"long[- ]term borrowings|non[- ]current borrowings|term loans? outstanding"),
    ("short_term_debt", r"short[- ]term borrowings|current borrowings|working capital (?:loans|borrowings)"),
    ("total_debt", r"total (?:borrowings|debt)|gross debt"),
    ("current_assets", r"total current assets"),
    ("current_liabilities", r"total current liabilities"),
    ("total_assets", r"total assets"),
    ("revenue", r"revenue from operations|total (?:operating )?revenue|net sales|(?:total )?turnover|sales"),
    ("ebitda", r"ebitda|pbdit|operating profit before (?:depreciation|interest)"),
    ("depreciation", r"depreciation(?: and amorti[sz]ation)?(?: expenses?)?"),
    ("interest_expense", r"finance costs?|interest (?:expense|and finance charges|cost)|finance charges"),
    ("pbt", r"profit before tax|pbt"),
    ("pat", r"profit (?:for the year|after tax)|net profit|pat"),
    ("net_worth", r"total equity|net worth|shareholders'? funds|tangible net worth"),
    ("receivables", r"trade receivables|sundry debtors|debtors"),
    ("inventory", r"inventor(?:y|ies)|stock[- ]in[- ]trade"),
    ("payables", r"trade payables|sundry creditors|creditors"),
    ("cash", r"cash and (?:cash equivalents|bank balances?)|cash & bank"),
    ("operating_cash_flow", r"net cash (?:from|generated from|flow from|used in) operating activities|cash flow from operations"),
    ("contingent_liabilities", r"contingent liabilities"),
    ("related_party_transactions", r"related[- ]party transactions"),
]
_FIELD_RE = [(name, re.compile(rf"^\s*(?:{pat})\b", re.I)) for name, pat in FIELD_PATTERNS]
_NARRATIVE_FIELDS = {"revenue": r"revenue|turnover|sales", "ebitda": r"ebitda", "pat": r"net profit|profit after tax|\bpat\b"}
CONFIDENCE = {"line_item": 0.92, "table": 0.9, "narrative": 0.75, "derived": 0.6}
_SCALE_LINE = re.compile(r"(?:₹|rs\.?|inr|amounts?|figures)[^\n]{0,25}?\bin\s+(crores?|cr\b|lakhs?|lacs?|millions?|mn\b|thousands?|'000)", re.I)

Financials = dict[str, dict[str, dict[str, Any]]]


def match_field(label: str) -> str | None:
    for name, pattern in _FIELD_RE:
        if pattern.match(label):
            return name
    return None


def _put(out: Financials, fy: str, field: str, value: float, method: str, page: int, snippet: str) -> None:
    current = out.setdefault(fy, {}).get(field)
    conf = CONFIDENCE[method]
    if current is None or conf > current["confidence"]:
        out[fy][field] = {"value": value, "confidence": conf, "method": method, "page": page, "snippet": snippet[:200]}


def _from_lines(pages: list[tuple[int, str]], doc_scale: float, out: Financials) -> None:
    for page_no, text in pages:
        columns: list[str] = []
        scale = doc_scale
        for line in text.splitlines():
            if m := _SCALE_LINE.search(line):
                scale = detect_scale(m.group(0))
                continue
            fys = find_fiscal_years(line)
            label_part = re.split(r"\s-?\(?[₹\d]", line, maxsplit=1)[0]
            is_header = (len(fys) >= 2 and not find_amounts(line, money_only=True)) or (
                fys and re.match(r"\s*(?:particulars|year ended|as at)", line, re.I))
            if is_header:
                columns = fys
                continue
            field = match_field(label_part)
            if not field or not columns:
                continue
            values = [v for v, _ in find_amounts(line[len(label_part):], default_multiplier=scale)]
            for fy, value in zip(columns, values):
                _put(out, fy, field, value, "line_item", page_no, line.strip())


def _from_tables(tables: list[dict[str, Any]], doc_scale: float, out: Financials) -> None:
    for table in tables:
        columns = find_fiscal_years(" ".join(table["header"]))
        if not columns:
            continue
        for row in table["rows"]:
            if not row or not (field := match_field(row[0] or "")):
                continue
            values = [find_amounts(cell, default_multiplier=doc_scale) for cell in row[1:]]
            for fy, cell in zip(columns, values):
                if cell:
                    _put(out, fy, field, cell[0][0], "table", table["page"], " | ".join(c or "" for c in row))


def _from_narrative(pages: list[tuple[int, str]], out: Financials) -> None:
    for page_no, text in pages:
        for sentence in re.split(r"(?<=[.;])\s+|\n", text):
            for field, pattern in _NARRATIVE_FIELDS.items():
                if not re.search(pattern, sentence, re.I):
                    continue
                fys = find_fiscal_years(sentence)
                amounts = [v for v, _ in find_amounts(sentence, money_only=True)]
                if fys and len(fys) == len(amounts):
                    for fy, value in zip(fys, amounts):
                        _put(out, fy, field, value, "narrative", page_no, sentence.strip())
                break


def _derive(out: Financials) -> None:
    for fields in out.values():
        def val(name: str, fields: dict[str, dict[str, Any]] = fields) -> float | None:
            return fields[name]["value"] if name in fields else None

        parts = [val("long_term_debt"), val("short_term_debt"), val("current_portion_ltd")]
        if "total_debt" not in fields and any(p is not None for p in parts):
            fields["total_debt"] = {"value": round(sum(p or 0 for p in parts), 2), "confidence": CONFIDENCE["derived"],
                                    "method": "derived", "page": None, "snippet": "Long-term + short-term borrowings + current maturities"}
        if "ebitda" not in fields and val("pbt") is not None and val("interest_expense") is not None:
            ebitda = val("pbt") + val("interest_expense") + (val("depreciation") or 0)
            fields["ebitda"] = {"value": round(ebitda, 2), "confidence": CONFIDENCE["derived"], "method": "derived", "page": None,
                                "snippet": "Profit before tax + finance costs + depreciation"}
        fields.pop("pbt", None)


def extract_financials(pages: list[tuple[int, str]], tables: list[dict[str, Any]]) -> Financials:
    scale = detect_scale("\n".join(t for _, t in pages))
    out: Financials = {}
    _from_lines(pages, scale, out)
    _from_tables(tables, scale, out)
    _from_narrative(pages, out)
    _derive(out)
    return {fy: fields for fy, fields in sorted(out.items(), key=lambda kv: kv[0], reverse=True) if fields}
