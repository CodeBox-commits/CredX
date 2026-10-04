"""GST return extraction (GSTR-1 / GSTR-3B / GSTR-2A/2B summaries + counterparties)."""

from __future__ import annotations

import re

from utils.identifiers import GSTIN_RE, find_gstins
from utils.text import normalize_space

from ..normalization.amounts import parse_amount
from ..normalization.fiscal import parse_fiscal_year, parse_month
from ..normalization.schema import Counterparty, ExtractedTable, FieldEvidence, GstPeriodData

_COLUMN_FIELDS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"gstr[- ]?1\b.*(?:turnover|sales|outward|value)|outward.*gstr[- ]?1", re.I), "gstr1_turnover"),
    (re.compile(r"gstr[- ]?3b.*(?:turnover|outward|taxable|value)|^(?:taxable )?turnover.*3b", re.I), "gstr3b_turnover"),
    (re.compile(r"gstr[- ]?2[ab].*(?:turnover|purchase|inward|value)", re.I), "gstr2a_turnover"),
    (re.compile(r"itc.*(?:2a|2b|available|eligible)|(?:2a|2b).*itc", re.I), "itc_available"),
    (re.compile(r"itc.*(?:claimed|availed|3b)|(?:3b).*itc", re.I), "itc_claimed"),
    (re.compile(r"tax (?:paid|liability)|cash (?:paid|ledger)|output tax", re.I), "tax_paid"),
    (re.compile(r"delay|days late|filing lag", re.I), "filing_delay_days"),
]

_NARRATIVE = {
    "gstr1_turnover": re.compile(r"gstr[- ]?1[^\n:]{0,40}?(?:turnover|sales|value)?\s*[:\-]?\s*(?:was|of|at)?\s*(?P<amt>(?:rs\.?|inr|₹)?\s*[\d,.]+\s*(?:crores?|cr|lakhs?|lacs?|mn|million)?)", re.I),
    "gstr3b_turnover": re.compile(r"gstr[- ]?3b[^\n:]{0,40}?turnover\s*[:\-]?\s*(?:was|of|at)?\s*(?P<amt>(?:rs\.?|inr|₹)?\s*[\d,.]+\s*(?:crores?|cr|lakhs?|lacs?|mn|million)?)", re.I),
    "gstr2a_turnover": re.compile(r"gstr[- ]?2[ab][^\n:]{0,40}?(?:turnover|purchases|inward)\s*[:\-]?\s*(?:was|of|at)?\s*(?P<amt>(?:rs\.?|inr|₹)?\s*[\d,.]+\s*(?:crores?|cr|lakhs?|lacs?|mn|million)?)", re.I),
    "itc_claimed": re.compile(r"itc\s+(?:claimed|availed)[^\n:]{0,40}?\s*[:\-]?\s*(?:was|of|at)?\s*(?P<amt>(?:rs\.?|inr|₹)?\s*[\d,.]+\s*(?:crores?|cr|lakhs?|lacs?|mn|million)?)", re.I),
    "itc_available": re.compile(r"itc\s+(?:available|as per gstr[- ]?2[ab]|eligible)[^\n:]{0,40}?\s*[:\-]?\s*(?:was|of|at)?\s*(?P<amt>(?:rs\.?|inr|₹)?\s*[\d,.]+\s*(?:crores?|cr|lakhs?|lacs?|mn|million)?)", re.I),
    "tax_paid": re.compile(r"(?:total )?tax paid[^\n:]{0,30}?\s*[:\-]?\s*(?:was|of|at)?\s*(?P<amt>(?:rs\.?|inr|₹)?\s*[\d,.]+\s*(?:crores?|cr|lakhs?|lacs?|mn|million)?)", re.I),
}

_PARTY_LINE = re.compile(
    rf"(?P<name>[A-Z][A-Za-z0-9&.,' ()-]{{3,80}}?)\s+(?:GSTIN[:\s]*)?(?P<gstin>{GSTIN_RE.pattern[2:-2]})\s+(?P<rest>.*)",
)


def _table_periods(tables: list[ExtractedTable], multiplier: float, gstin: str | None) -> list[GstPeriodData]:
    periods: list[GstPeriodData] = []
    for table in tables:
        col_fields: dict[int, str] = {}
        for idx, head in enumerate(table.header):
            for pattern, field in _COLUMN_FIELDS:
                if pattern.search(head) and idx not in col_fields and field not in col_fields.values():
                    col_fields[idx] = field
                    break
        if not col_fields:
            continue
        for row in table.rows:
            period = parse_month(row[0]) or parse_fiscal_year(row[0])
            if not period:
                continue
            item = GstPeriodData(gstin=gstin, period=period)
            for idx, field in col_fields.items():
                if idx >= len(row):
                    continue
                if field == "filing_delay_days":
                    digits = re.search(r"\d+", row[idx])
                    item.filing_delay_days = int(digits.group()) if digits else 0
                else:
                    setattr(item, field, parse_amount(row[idx], default_multiplier=multiplier))
            periods.append(item)
    return periods


def _narrative_summary(text: str, doc_fy: str | None, gstin: str | None) -> GstPeriodData | None:
    values = {}
    for field, pattern in _NARRATIVE.items():
        m = pattern.search(text)
        if m:
            value = parse_amount(m.group("amt"))
            if value and value > 0:
                values[field] = value
    if not values:
        return None
    return GstPeriodData(gstin=gstin, period=doc_fy or "ANNUAL", **values)


def _counterparties(text: str, multiplier: float) -> list[Counterparty]:
    parties: list[Counterparty] = []
    role = "unknown"
    for line in text.splitlines():
        lowered = line.lower()
        if "supplier" in lowered or "inward" in lowered or "purchases from" in lowered:
            role = "supplier"
        elif "customer" in lowered or "outward" in lowered or "sales to" in lowered or "buyer" in lowered:
            role = "customer"
        m = _PARTY_LINE.search(line)
        if not m:
            continue
        rest = m.group("rest")
        amount = parse_amount(rest, default_multiplier=multiplier)
        invoices = re.search(r"(\d+)\s*invoices?", rest, re.I)
        parties.append(
            Counterparty(
                name=normalize_space(m.group("name")).strip(" -:"),
                gstin=m.group("gstin").upper(),
                amount=amount,
                invoice_count=int(invoices.group(1)) if invoices else None,
                role=role,  # type: ignore[arg-type]
            )
        )
    return parties


def extract_gst(
    pages: list[str], tables: list[ExtractedTable], *, doc_fy: str | None, multiplier: float
) -> tuple[list[GstPeriodData], list[Counterparty], list[FieldEvidence]]:
    text = "\n".join(pages)
    gstins = find_gstins(text)
    primary = gstins[0] if gstins else None
    periods = _table_periods(tables, multiplier, primary)
    evidence: list[FieldEvidence] = []
    if periods:
        evidence.append(FieldEvidence(field="gst_periods", value=len(periods), confidence=0.9, method="table"))
    summary = _narrative_summary(text, doc_fy, primary)
    if summary and not periods:
        periods.append(summary)
        evidence.extend(
            FieldEvidence(field=f"gst.{k}", value=v, confidence=0.72, method="narrative", fiscal_year=summary.period)
            for k, v in summary.model_dump(exclude={"gstin", "period", "filing_delay_days"}).items()
            if v is not None
        )
    parties = [p for p in _counterparties(text, multiplier) if p.gstin != primary]
    return periods, parties, evidence
