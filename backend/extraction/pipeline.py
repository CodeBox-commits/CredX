"""Document ingestion pipeline (pure: no database access).

    file -> text layer (pdfplumber / PyMuPDF, OCR per scanned page) -> tables -> classification
         -> identity & red flags -> type-specific extraction -> confidence -> structured JSON

Runs identically in a Celery worker, the in-process job pool, the seed script and unit tests.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from core.logging import get_logger
from extraction.classification.classifier import classify
from extraction.financials.bank import extract_bank
from extraction.financials.documents import extract_legal, extract_mca, extract_sanction, extract_shareholding
from extraction.financials.entities import RedFlag, company_name, directors, extract_red_flags, identifiers, positive_signals
from extraction.financials.gst import extract_gst
from extraction.financials.statements import extract_financials
from extraction.parsers.pdf import parse_any
from extraction.tables.extractor import extract_tables
from models.enums import DocumentType

log = get_logger("credx.extraction")
ProgressFn = Callable[[int, str, str], None]

FINANCIAL_TYPES = {DocumentType.ANNUAL_REPORT, DocumentType.FINANCIAL_STATEMENT, DocumentType.RATING_REPORT, DocumentType.OTHER}
# Fields we expect a complete document of each type to yield (drives the field-coverage confidence).
EXPECTED_FIELDS = {DocumentType.ANNUAL_REPORT: 12, DocumentType.FINANCIAL_STATEMENT: 12, DocumentType.RATING_REPORT: 4}


def _health(financials: dict[str, dict[str, dict[str, Any]]], flags: list[RedFlag]) -> str:
    latest = next(iter(financials.values()), {})

    def v(name: str) -> float | None:
        return latest.get(name, {}).get("value")

    points = 0
    if (e := v("ebitda")) is not None and (r := v("revenue")):
        points += 1 if e / r >= 0.12 else (-1 if e / r < 0.07 else 0)
    if (e := v("ebitda")) and (i := v("interest_expense")):
        points += 1 if e / i >= 3 else (-1 if e / i < 1.75 else 0)
    if (d := v("total_debt")) is not None and (nw := v("net_worth")):
        points += 1 if d / nw <= 1 else (-1 if d / nw > 2.5 else 0)
    if (p := v("pat")) is not None and p < 0:
        points -= 1
    points -= sum(2 if f.severity == "CRITICAL" else 1 for f in flags if f.severity in ("HIGH", "CRITICAL"))
    return "STRONG" if points >= 2 else "MODERATE" if points >= 0 else "WEAK" if points >= -3 else "STRESSED"


def process_document(path: Path, filename: str, declared_type: str | None = None,
                     progress: ProgressFn | None = None) -> dict[str, Any]:
    report = progress or (lambda pct, stage, msg: None)
    stages: list[dict[str, Any]] = []
    clock = time.perf_counter()

    def stage(name: str, pct: int, message: str) -> None:
        nonlocal clock
        now = time.perf_counter()
        if stages:
            stages[-1]["ms"] = int((now - clock) * 1000)
        clock = now
        stages.append({"name": name, "status": "done", "ms": 0})
        report(pct, name, message)

    path = Path(path)
    stage("parsing", 10, "Extracting text layer")
    parsed = parse_any(path)
    pages = [(p.number, p.text) for p in parsed.pages]
    text = parsed.text
    warnings = list(parsed.warnings)
    if not text.strip():
        warnings.append("No readable text found — scanned document without OCR, or an empty file")

    stage("tables", 30, "Detecting tables")
    tables = extract_tables(path)

    stage("classification", 45, "Classifying document")
    cls = classify(text, filename, declared_type)
    doc_type = DocumentType(declared_type) if declared_type else cls.doc_type

    stage("entities", 60, f"Extracting {doc_type.value.replace('_', ' ')} fields")
    ids = identifiers(text)
    flags = extract_red_flags(pages)
    result: dict[str, Any] = {
        "company_name": company_name(text),
        "doc_type": doc_type.value,
        "classification": {"type": cls.doc_type.value, "confidence": cls.confidence, "signals": cls.signals, "scores": cls.scores},
        "identifiers": ids,
        "directors": directors(text),
        "financials": {},
        "positive_signals": positive_signals(text),
        "warnings": warnings,
    }
    if doc_type in FINANCIAL_TYPES:
        result["financials"] = extract_financials(pages, tables)
    if doc_type == DocumentType.GST_RETURN or "GSTR" in text.upper():
        gst = extract_gst(text)
        if gst["returns"]:
            result["gst"] = gst
    if doc_type == DocumentType.BANK_STATEMENT:
        result["bank"] = extract_bank(text)
    if doc_type == DocumentType.LEGAL_NOTICE:
        result["legal"] = {"title": next((line for line in text.splitlines() if line.strip()), filename)[:160], **extract_legal(text)}
    if doc_type == DocumentType.SANCTION_LETTER:
        result["sanction"] = extract_sanction(text)
    if doc_type in (DocumentType.SHAREHOLDING_PATTERN, DocumentType.ANNUAL_REPORT) and "pledged" in text.lower():
        result["shareholding"] = extract_shareholding(text)
        pledged = result["shareholding"].get("pledged_pct") or 0
        if pledged >= 10:
            flags.append(RedFlag("Promoter share pledge", "HIGH" if pledged >= 40 else "MEDIUM", "capital",
                                 f"{pledged:.1f}% of promoter holding pledged or encumbered"))
    if doc_type == DocumentType.MCA_FILING:
        result["mca"] = extract_mca(text)
    result["red_flags"] = [f.to_dict() for f in flags]

    stage("validation", 85, "Scoring confidence")
    field_count = sum(len(v) for v in result["financials"].values())
    expected = EXPECTED_FIELDS.get(doc_type)
    field_conf = None
    if expected:
        values = [f["confidence"] for fy in result["financials"].values() for f in fy.values()]
        coverage = min(1.0, field_count / (expected * max(1, min(2, len(result["financials"])))))
        field_conf = round(coverage * (sum(values) / len(values)), 3) if values else 0.0
    overall = 0.4 * parsed.text_confidence + 0.35 * cls.confidence + 0.25 * (field_conf if field_conf is not None else cls.confidence)
    if expected and not field_count:
        warnings.append("No financial line items recognised — check the statement format or edit values manually")
    if ids["invalid_gstins"]:
        warnings.append(f"GSTIN checksum failed for {', '.join(ids['invalid_gstins'])}")

    latest = next(iter(result["financials"].values()), {})
    result.update({
        "fiscal_years": list(result["financials"]),
        "headline": {
            "company_name": result["company_name"],
            "revenue": latest.get("revenue", {}).get("value"), "ebitda": latest.get("ebitda", {}).get("value"),
            "pat": latest.get("pat", {}).get("value"), "debt": latest.get("total_debt", {}).get("value"),
            "gst_number": (ids["gstins"] or [None])[0],
            "financial_health": _health(result["financials"], flags),
        },
        "tables": tables[:12],
        "pages": [{"number": p.number, "method": p.method, "confidence": p.confidence, "chars": len(p.text)} for p in parsed.pages],
        "ocr_used": parsed.ocr_used,
        "page_count": parsed.page_count,
        "confidence": {"overall": round(overall, 3), "text": parsed.text_confidence, "classification": cls.confidence,
                       "fields": field_conf},
        "text_preview": text[:6000],
    })
    stage("complete", 100, "Extraction complete")
    result["stages"] = stages
    log.info("document extracted", extra={"doc_type": doc_type.value, "pages": parsed.page_count, "fields": field_count,
                                          "confidence": result["confidence"]["overall"]})
    return result
