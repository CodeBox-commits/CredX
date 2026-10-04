"""Multi-year P&L / balance-sheet / cash-flow extraction.

Three passes, in decreasing order of trust:

1. **table**     – structured tables (pdfplumber/Camelot/text tables) with FY column headers
2. **line_item** – whitespace-aligned statement rows "Revenue from operations  24,180  21,960"
3. **narrative** – prose such as "Revenue for FY25 was INR 186 crore"

Every value carries ``FieldEvidence`` (method, page, snippet, confidence) so the UI
and CAM can show exactly where each number came from.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from utils.text import normalize_space, snippet_around

from ..normalization.amounts import find_amounts, parse_amount
from ..normalization.fiscal import find_fiscal_years, parse_fiscal_year
from ..normalization.schema import ExtractedTable, FieldEvidence, FinancialYearData

# Anchored label patterns. Order matters only for readability; the longest match wins.
FIELD_PATTERNS: dict[str, list[str]] = {
    "revenue": [
        r"revenue from operations?", r"total revenue(?! from)", r"net revenue", r"net sales", r"sales turnover",
        r"turnover", r"gross sales", r"sales", r"income from operations", r"total operating income",
    ],
    "ebitda": [r"ebitda", r"pbdit", r"operating profit before depreciation", r"earnings before interest,? tax"],
    "depreciation": [r"depreciation(?: and amorti[sz]ation)?(?: expenses?)?"],
    "interest_expense": [r"finance costs?", r"interest expenses?", r"interest and finance charges", r"interest cost"],
    "pbt": [r"profit before tax(?:ation)?", r"\bpbt\b", r"profit/\(loss\) before tax"],
    "pat": [
        r"profit after tax(?:ation)?", r"\bpat\b", r"net profit(?: for the (?:year|period))?",
        r"profit for the (?:year|period)", r"profit/\(loss\) for the (?:year|period)",
    ],
    "total_assets": [r"total assets", r"balance sheet total"],
    "total_liabilities": [r"total liabilities(?! and)", r"total outside liabilities"],
    "current_assets": [r"total current assets", r"current assets"],
    "current_liabilities": [r"total current liabilities", r"current liabilities"],
    "inventory": [r"inventor(?:y|ies)", r"stock[- ]in[- ]trade", r"closing stock"],
    "receivables": [r"trade receivables?", r"sundry debtors", r"debtors", r"receivables"],
    "payables": [r"trade payables?", r"sundry creditors", r"creditors"],
    "cash": [r"cash and cash equivalents?", r"cash and bank balances?", r"cash & bank", r"cash balance"],
    "net_worth": [
        r"total equity", r"net worth", r"tangible net worth", r"shareholders'? funds?", r"equity attributable",
    ],
    "total_debt": [r"total borrowings", r"total debt", r"gross debt", r"borrowings"],
    "short_term_debt": [
        r"short[- ]term borrowings", r"working capital (?:loans|borrowings|limits utili[sz]ed)", r"cash credit",
    ],
    "long_term_debt": [r"long[- ]term borrowings", r"term loans?"],
    "cfo": [
        r"net cash (?:generated )?(?:from|used in) operating activities", r"cash flow from operations?",
        r"operating cash flow",
    ],
    "capex": [r"purchase of (?:property,? plant (?:and|&) equipment|fixed assets)", r"capital expenditure", r"capex"],
}

_COMPILED = {
    field: [re.compile(rf"^(?:\(?[ivx\d]+[.)]\s*|[a-z][.)]\s+)?{p}\b", re.I) for p in patterns]
    for field, patterns in FIELD_PATTERNS.items()
}

_NARRATIVE_FIELDS = {
    "revenue": r"(?:revenue(?: from operations)?|turnover|net sales|total income|top[- ]?line)",
    "ebitda": r"(?:ebitda|operating profit)",
    "pat": r"(?:net profit|profit after tax|\bpat\b)",
    "total_debt": r"(?:total debt|total borrowings|borrowings|debt)",
    "net_worth": r"(?:net worth|tangible net worth|shareholders'? funds)",
    "interest_expense": r"(?:finance costs?|interest expense|interest outgo)",
    "current_assets": r"(?:current assets)",
    "current_liabilities": r"(?:current liabilities)",
    "receivables": r"(?:receivables|debtors)",
    "cash": r"(?:cash and cash equivalents|cash balance)",
}
_NARRATIVE_RE = {
    field: re.compile(
        rf"{label}[^.\n]{{0,70}}?(?:was|were|of|at|stood at|amounted to|is|:|reported|totall?ing|increased to|declined to|fell to|rose to)\s*"
        rf"(?P<amt>(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d+)?\s*(?:crores?|cr\.?|lakhs?|lacs?|million|mn|billion|bn)?"
        rf"|[\d,]+(?:\.\d+)?\s*(?:crores?|cr\.?|lakhs?|lacs?|million|mn|billion|bn))",
        re.I,
    )
    for field, label in _NARRATIVE_FIELDS.items()
}

_METHOD_CONFIDENCE = {"table": 0.93, "line_item": 0.86, "narrative": 0.72, "derived": 0.6}


@dataclass(slots=True)
class _Candidate:
    fiscal_year: str
    field: str
    value: float
    method: str
    confidence: float
    page: int | None
    snippet: str | None


def match_field(label: str) -> str | None:
    label = normalize_space(label).lower().strip(":- ")
    if not label or len(label) > 90:
        return None
    best: tuple[int, str] | None = None
    for field, patterns in _COMPILED.items():
        for pattern in patterns:
            m = pattern.match(label)
            if m and (best is None or m.end() > best[0]):
                best = (m.end(), field)
    return best[1] if best else None


def _previous_fy(fy: str, offset: int = 1) -> str:
    return f"FY{int(fy[2:]) - offset}"


def _from_tables(tables: list[ExtractedTable], doc_fy: str | None, multiplier: float) -> list[_Candidate]:
    out: list[_Candidate] = []
    for table in tables:
        col_years: dict[int, str] = {}
        for idx, cell in enumerate(table.header):
            fy = parse_fiscal_year(cell)
            if fy and idx > 0:
                col_years[idx] = fy
        numeric_cols = [
            i for i in range(1, len(table.header))
            if sum(1 for row in table.rows if i < len(row) and parse_amount(row[i]) is not None) >= max(1, len(table.rows) // 3)
        ]
        if not col_years and doc_fy and numeric_cols:
            # No year headers: assume newest-first column ordering (Indian statement convention).
            col_years = {col: _previous_fy(doc_fy, n) for n, col in enumerate(numeric_cols[:3])}
        if not col_years:
            continue
        for row in table.rows:
            field = match_field(row[0])
            if not field:
                continue
            for col, fy in col_years.items():
                if col >= len(row):
                    continue
                value = parse_amount(row[col], default_multiplier=multiplier)
                if value is None:
                    continue
                out.append(
                    _Candidate(fy, field, value, "table", _METHOD_CONFIDENCE["table"], table.page,
                               normalize_space(" | ".join(row))[:160])
                )
    return out


_LABEL_SPLIT = re.compile(r"^(?P<label>[A-Za-z][A-Za-z&/,'()\- .]{2,90}?)\s*[:\-]?\s+(?P<rest>(?:\(?[-₹Rs.\s]*\d).*)$")


def _from_lines(pages: list[str], doc_fy: str | None, multiplier: float) -> list[_Candidate]:
    out: list[_Candidate] = []
    for page_no, text in enumerate(pages, start=1):
        header_years: list[str] = []
        for line in text.splitlines():
            stripped = line.strip()
            years = find_fiscal_years(stripped)
            no_year = re.sub(r"(?:FY\s*'?\d{2,4}(?:\s*[-/]\s*\d{2,4})?|20\d{2}\s*[-/]\s*\d{2,4}|31[./-]03[./-]20\d{2})", " ", stripped, flags=re.I)
            if years and not find_amounts(no_year):
                header_years = years
                continue
            m = _LABEL_SPLIT.match(stripped)
            if not m:
                continue
            field = match_field(m.group("label"))
            if not field:
                continue
            amounts = find_amounts(m.group("rest"), default_multiplier=multiplier)
            if not amounts:
                continue
            years_for_row = header_years or ([doc_fy, _previous_fy(doc_fy), _previous_fy(doc_fy, 2)] if doc_fy else [])
            if not years_for_row:
                continue
            # Drop a leading note reference ("Note 21") when there are more numbers than year columns.
            if len(amounts) > len(years_for_row) and abs(amounts[0]) < 100 and amounts[0] == int(amounts[0]):
                amounts = amounts[1:]
            for fy, value in zip(years_for_row, amounts):
                out.append(
                    _Candidate(fy, field, value, "line_item", _METHOD_CONFIDENCE["line_item"], page_no, stripped[:160])
                )
    return out


def _from_narrative(pages: list[str], doc_fy: str | None) -> list[_Candidate]:
    out: list[_Candidate] = []
    for page_no, text in enumerate(pages, start=1):
        for sentence_match in re.finditer(r"[^.\n]+(?:[.\n]|$)", text):
            sentence = sentence_match.group(0)
            fy = parse_fiscal_year(sentence) or doc_fy
            if not fy:
                continue
            for field, pattern in _NARRATIVE_RE.items():
                m = pattern.search(sentence)
                if not m:
                    continue
                # Ignore GST/bank "turnover" statements here; they're handled by the GST extractor.
                if field == "revenue" and re.search(r"gstr|gst |bank credit", sentence, re.I):
                    continue
                if field == "total_debt" and re.search(r"debtor|overdue outstanding|demand", sentence, re.I):
                    continue
                value = parse_amount(m.group("amt"))
                if value is None or value <= 0:
                    continue
                out.append(
                    _Candidate(fy, field, value, "narrative", _METHOD_CONFIDENCE["narrative"], page_no,
                               snippet_around(text, sentence_match.start() + m.start(), sentence_match.start() + m.end(), 40))
                )
    return out


def _derive(year: FinancialYearData, evidence: list[FieldEvidence]) -> None:
    def add(field: str, value: float) -> None:
        setattr(year, field, round(value, 2))
        evidence.append(
            FieldEvidence(field=field, value=round(value, 2), confidence=_METHOD_CONFIDENCE["derived"],
                          method="derived", fiscal_year=year.fiscal_year, snippet="Derived from related line items")
        )

    if year.ebitda is None and year.pbt is not None and year.interest_expense is not None and year.depreciation is not None:
        add("ebitda", year.pbt + year.interest_expense + year.depreciation)
    if year.total_debt is None and (year.short_term_debt is not None or year.long_term_debt is not None):
        add("total_debt", (year.short_term_debt or 0) + (year.long_term_debt or 0))
    if year.total_liabilities is None and year.total_assets is not None and year.net_worth is not None:
        add("total_liabilities", year.total_assets - year.net_worth)
    if year.net_worth is None and year.total_assets is not None and year.total_liabilities is not None:
        add("net_worth", year.total_assets - year.total_liabilities)


def extract_financial_years(
    pages: list[str],
    tables: list[ExtractedTable],
    *,
    doc_fy: str | None,
    multiplier: float,
    ocr_penalty: float = 1.0,
) -> tuple[list[FinancialYearData], list[FieldEvidence]]:
    candidates = _from_tables(tables, doc_fy, multiplier) + _from_lines(pages, doc_fy, multiplier) + _from_narrative(pages, doc_fy)

    best: dict[tuple[str, str], _Candidate] = {}
    for cand in candidates:
        key = (cand.fiscal_year, cand.field)
        # Prefer higher-trust methods; within a method keep the first occurrence (statements precede notes).
        if key not in best or cand.confidence > best[key].confidence:
            best[key] = cand

    years: dict[str, FinancialYearData] = {}
    evidence: list[FieldEvidence] = []
    for (fy, field), cand in best.items():
        year = years.setdefault(fy, FinancialYearData(fiscal_year=fy))
        setattr(year, field, cand.value)
        evidence.append(
            FieldEvidence(field=field, value=cand.value, confidence=round(cand.confidence * ocr_penalty, 3),
                          method=cand.method, page=cand.page, snippet=cand.snippet, fiscal_year=fy)
        )

    for year in years.values():
        _derive(year, evidence)
        confs = [e.confidence for e in evidence if e.fiscal_year == year.fiscal_year]
        year.confidence = round(sum(confs) / len(confs), 3) if confs else 0.0

    ordered = sorted(years.values(), key=lambda y: y.fiscal_year, reverse=True)
    return ordered[:5], evidence
