"""Document ingestion pipeline.

    bytes → preprocess → text extraction (pdfplumber/PyMuPDF) → OCR fallback
          → table extraction → classification → entity & financial extraction
          → normalisation → DocumentExtraction (structured JSON)

The pipeline is pure (no DB access) so it runs identically inside a FastAPI
thread, a Celery worker, a CLI script or a unit test. Progress is reported via
an optional callback ``(stage, percent, message)``.
"""

from __future__ import annotations

import time
from collections.abc import Callable

from core.logging import get_logger
from core.metrics import EXTRACTIONS

from .classification.classifier import classify_document
from .financials.bank import extract_bank
from .financials.entities import extract_entities
from .financials.gst import extract_gst
from .financials.legal_and_filings import extract_legal, extract_mca, extract_sanctions, extract_shareholding
from .financials.risk_signals import detect_risk_indicators
from .financials.statements import extract_financial_years
from .normalization.amounts import detect_statement_unit
from .normalization.health import assess_financial_health
from .normalization.schema import DocumentExtraction, FieldEvidence
from .parsers.document_parser import parse_document
from .parsers.preprocess import strip_repeated_headers
from .tables.extractor import extract_tables

logger = get_logger("credx.extraction")

ProgressFn = Callable[[str, int, str], None]

PIPELINE_STAGES = [
    ("preprocessing", "Validating & preprocessing"),
    ("text_extraction", "Extracting text layer"),
    ("ocr", "OCR fallback for scanned pages"),
    ("tables", "Detecting tables"),
    ("classification", "Classifying document"),
    ("entities", "Extracting entities & financials"),
    ("normalization", "Normalising & scoring confidence"),
]

# How many populated fields we expect from a "complete" document of each type.
_EXPECTED_FIELDS = {
    "annual_report": 10, "financial_statement": 12, "gst_return": 4, "bank_statement": 4,
    "sanction_letter": 3, "legal_notice": 2, "mca_filing": 3, "shareholding_pattern": 2,
    "rating_report": 4, "unknown": 6,
}

_FINANCIAL_TYPES = {"annual_report", "financial_statement", "rating_report", "unknown"}


def _noop(stage: str, pct: int, msg: str) -> None:  # pragma: no cover
    return None


def run_extraction(
    data: bytes,
    *,
    filename: str,
    extension: str,
    declared_type: str | None = None,
    pdf_path: str | None = None,
    progress: ProgressFn | None = None,
) -> DocumentExtraction:
    report = progress or _noop
    timings: dict[str, int] = {}
    clock = time.perf_counter()

    def lap(stage: str) -> None:
        nonlocal clock
        now = time.perf_counter()
        timings[stage] = int((now - clock) * 1000)
        clock = now

    report("preprocessing", 5, "Validating document")
    lap("preprocessing")

    report("text_extraction", 15, "Extracting text layer")
    parsed = parse_document(data, extension)
    lap("text_extraction")
    report("ocr", 35, "OCR applied to scanned pages" if parsed.ocr_used else "Text layer sufficient — OCR not needed")
    pages = strip_repeated_headers([p.text for p in parsed.pages])
    full_text = "\n\n".join(pages)
    lap("ocr")

    report("tables", 50, "Detecting tables")
    tables = extract_tables(data if parsed.is_pdf else None, pdf_path=pdf_path, page_texts=pages)
    lap("tables")

    report("classification", 62, "Classifying document")
    cls = classify_document(full_text, filename, declared_type)
    lap("classification")

    report("entities", 75, f"Extracting {cls.doc_type.replace('_', ' ')} fields")
    unit, multiplier = detect_statement_unit(full_text)
    entities = extract_entities(full_text)
    ocr_penalty = 0.85 if parsed.ocr_used else 1.0

    result = DocumentExtraction(
        doc_type=cls.doc_type,
        doc_type_confidence=cls.confidence,
        classification_signals=cls.signals,
        page_count=parsed.page_count,
        ocr_used=parsed.ocr_used,
        text_chars=len(full_text),
        unit_detected=unit,
        entities=entities,
        tables=[],
        warnings=list(parsed.warnings),
    )
    evidence: list[FieldEvidence] = []

    if cls.doc_type in _FINANCIAL_TYPES:
        result.financials, fin_evidence = extract_financial_years(
            pages, tables, doc_fy=entities.financial_year, multiplier=multiplier, ocr_penalty=ocr_penalty
        )
        evidence.extend(fin_evidence)
    if cls.doc_type == "gst_return" or "gstr" in full_text.lower():
        result.gst, result.counterparties, gst_evidence = extract_gst(
            pages, tables, doc_fy=entities.financial_year, multiplier=multiplier
        )
        evidence.extend(gst_evidence)
    if cls.doc_type == "bank_statement":
        result.bank = extract_bank(pages, tables, multiplier=multiplier)
        result.counterparties.extend(result.bank.counterparties)
    if cls.doc_type in {"legal_notice", "annual_report", "rating_report", "mca_filing"}:
        result.legal = extract_legal(full_text)
    if cls.doc_type == "sanction_letter":
        result.sanctions = extract_sanctions(full_text)
    if cls.doc_type in {"shareholding_pattern", "annual_report"}:
        result.shareholding = extract_shareholding(full_text, tables)
    if cls.doc_type == "mca_filing":
        result.mca = extract_mca(full_text)
    result.risk_indicators = detect_risk_indicators(pages)
    lap("entities")

    report("normalization", 90, "Normalising values & computing confidence")
    for field, value in (("company_name", entities.company_name), ("cin", entities.cin), ("gstin", entities.gstins[0] if entities.gstins else None)):
        if value:
            evidence.append(FieldEvidence(field=field, value=value, confidence=round(0.9 * ocr_penalty, 3), method="narrative"))
    result.evidence = evidence
    result.tables = tables[:12]

    populated = len({(e.field, e.fiscal_year) for e in evidence}) + len(result.legal) + len(result.sanctions) + (
        len(result.bank.months) if result.bank else 0
    )
    coverage = min(1.0, populated / _EXPECTED_FIELDS.get(cls.doc_type, 6))
    result.confidence = round(0.35 * cls.confidence + 0.25 * parsed.text_quality + 0.40 * coverage, 3)
    if result.confidence < 0.45:
        result.warnings.append("Low extraction confidence — please review the extracted values")

    latest = result.financials[0] if result.financials else None
    health = assess_financial_health(result.financials, result.risk_indicators)
    result.summary = {
        "company_name": entities.company_name,
        "document_type": cls.doc_type,
        "financial_year": latest.fiscal_year if latest else entities.financial_year,
        "revenue": latest.revenue if latest else None,
        "ebitda": latest.ebitda if latest else None,
        "debt": latest.total_debt if latest else None,
        "gst_number": entities.gstins[0] if entities.gstins else None,
        "financial_health": health,
        "risk_flags": len([r for r in result.risk_indicators if r.code != "positive_order_book"]),
    }
    lap("normalization")
    result.stage_timings_ms = timings
    EXTRACTIONS.inc(doc_type=cls.doc_type, ocr=str(parsed.ocr_used).lower())
    logger.info(
        "document_extracted",
        extra={"doc_type": cls.doc_type, "pages": parsed.page_count, "confidence": result.confidence, "ocr": parsed.ocr_used},
    )
    report("complete", 100, "Extraction complete")
    return result
