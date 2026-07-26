from __future__ import annotations

import json
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
from .parsers.text_extractor import extract_text


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
    extraction = extract_text(file_path)

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
    structured_output = extract_structured_entities(
        text=extraction.text,
        document_type=detected_document_type,
        confidence_score=confidence,
    )
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
        "structured_output": structured_output.model_dump(mode="json"),
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
    )
