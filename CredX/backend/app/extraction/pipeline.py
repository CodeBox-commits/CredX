from __future__ import annotations

import json
import time
from pathlib import Path

from ..core.config import get_settings
from ..schemas.uploads import (
    AnalysisHighlight,
    AnalysisSignal,
    IngestionStep,
    ParseSummary,
)
from ..services.intelli_credit_analysis import analyze_parsed_text
from .classification.rules import detect_document_type
from .financials.extractor import extract_structured_entities
from .normalization.engine import normalize_financials
from .parsers.text_extractor import extract_text
from .tables.extractor import extract_tables


def _confidence_score(character_count: int, extracted_fields: int, used_ocr: bool) -> float:
    score = 0.4
    if character_count > 1_000:
        score += 0.2
    if character_count > 4_000:
        score += 0.15
    score += min(extracted_fields * 0.05, 0.2)
    if used_ocr:
        score -= 0.1
    return round(max(0.25, min(score, 0.97)), 2)


def run_ingestion_pipeline(*, file_path: Path, document_id: str) -> ParseSummary:
    settings = get_settings()
    started_at = time.perf_counter()
    extraction = extract_text(file_path)
    tables = extract_tables(file_path)

    steps = [
        IngestionStep(name="classify", status="completed", detail="Document queued for hybrid parsing."),
        IngestionStep(
            name="extract-text",
            status="completed",
            detail=f"Text extracted using {extraction.extraction_method}.",
        ),
        IngestionStep(
            name="extract-tables",
            status="completed",
            detail=f"{extraction.table_count} table block(s) detected.",
        ),
    ]

    detected_document_type = detect_document_type(extraction.text, file_path.name)
    analysis = analyze_parsed_text(
        text=extraction.text,
        filename=file_path.name,
        page_count=extraction.page_count,
        pages=[
            {"page_number": page.page_number, "text": page.text}
            for page in extraction.pages
        ],
    )

    extracted_fields_probe = extract_structured_entities(
        text=extraction.text,
        document_type=detected_document_type,
        confidence_score=0.0,
    )
    field_count = len(
        [
            value
            for value in [
                extracted_fields_probe.company_name,
                extracted_fields_probe.cin,
                extracted_fields_probe.gst_number,
                extracted_fields_probe.revenue,
                extracted_fields_probe.ebitda,
                extracted_fields_probe.liabilities,
                extracted_fields_probe.debt,
                extracted_fields_probe.total_assets,
            ]
            if value is not None
        ]
    )
    confidence = _confidence_score(
        analysis.get("character_count", len(extraction.text)),
        field_count,
        extraction.used_ocr,
    )
    raw_structured_output = extract_structured_entities(
        text=extraction.text,
        document_type=detected_document_type,
        confidence_score=confidence,
    )
    normalized_output = normalize_financials(
        {
            "company_name": raw_structured_output.company_name,
            "cin": raw_structured_output.cin,
            "gst_number": raw_structured_output.gst_number,
            "document_type": raw_structured_output.document_type,
            "revenue": raw_structured_output.revenue,
            "ebitda": raw_structured_output.ebitda,
            "liabilities": raw_structured_output.liabilities,
            "debt": raw_structured_output.debt,
            "total_assets": raw_structured_output.total_assets,
            "directors": raw_structured_output.directors,
            "risk_indicators": raw_structured_output.risk_indicators,
            "financial_health": raw_structured_output.financial_health,
            "confidence_score": raw_structured_output.confidence_score,
        }
    )
    structured_output = raw_structured_output
    validation_warnings = normalized_output.validation_warnings or []
    if not raw_structured_output.gst_number:
        validation_warnings.append("GST identifier is missing; verify filing metadata.")
    if not raw_structured_output.cin:
        validation_warnings.append("CIN is missing; MCA registration details are incomplete.")
    if confidence < 0.6:
        validation_warnings.append("OCR confidence is below the preferred threshold for underwriting use.")
    steps.extend(
        [
            IngestionStep(
                name="entity-extraction",
                status="completed",
                detail="Financial entities and Indian filing identifiers normalized.",
            ),
            IngestionStep(
                name="synthesis",
                status="completed",
                detail="Structured underwriting JSON prepared for downstream scoring.",
            ),
        ]
    )

    artifact_payload = {
        "document_id": document_id,
        "source_file": str(file_path),
        "parser": extraction.extraction_method,
        "page_count": extraction.page_count,
        "character_count": analysis.get("character_count", len(extraction.text)),
        "analysis": analysis,
        "tables": tables,
        "structured_output": structured_output.model_dump(mode="json"),
        "normalized_output": normalized_output.to_dict(),
    }
    artifact_path = settings.parsed_dir / f"{document_id}.json"
    artifact_path.write_text(
        json.dumps(artifact_payload, indent=2, ensure_ascii=True),
        encoding="utf-8",
    )

    highlights = [
        AnalysisHighlight(**highlight) for highlight in analysis.get("highlights", [])
    ]
    if structured_output.company_name:
        highlights.append(
            AnalysisHighlight(
                title="Borrower identified",
                detail=structured_output.company_name,
            )
        )
    if structured_output.gst_number:
        highlights.append(
            AnalysisHighlight(
                title="GST identifier",
                detail=structured_output.gst_number,
            )
        )

    signals = [AnalysisSignal(**signal) for signal in analysis.get("signals", [])]
    summary = analysis.get("summary", "Document analyzed.")
    if structured_output.financial_health != "UNKNOWN":
        summary = f"{summary} Structured health view: {structured_output.financial_health}."

    return ParseSummary(
        parsed=True,
        status="parsed",
        parser=extraction.extraction_method,
        result_type="structured-json",
        page_count=extraction.page_count,
        character_count=analysis.get("character_count", len(extraction.text)),
        artifact_path=str(artifact_path),
        detected_document_type=detected_document_type,
        summary=summary,
        score=analysis.get("score"),
        risk_level=analysis.get("risk_level"),
        signals=signals,
        highlights=highlights[:6],
        structured_output=structured_output,
        pipeline_steps=steps,
        validation_warnings=validation_warnings,
        tables=tables,
        extraction_duration_ms=int((time.perf_counter() - started_at) * 1000),
    )
