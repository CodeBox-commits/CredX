from __future__ import annotations

from pathlib import Path

from app.extraction.pipeline import run_ingestion_pipeline


def test_run_ingestion_pipeline_extracts_financial_entities(tmp_path: Path) -> None:
    sample_path = tmp_path / "annual_report.txt"
    sample_path.write_text(
        """
        ABC Textiles Pvt Ltd
        Annual Report for FY 2023-24
        Revenue Rs 120 Crore
        EBITDA Rs 12 Crore
        Total liabilities Rs 80 Crore
        Total debt Rs 55 Crore
        Current assets Rs 65 Crore
        Current liabilities Rs 25 Crore
        Directors: Rita Sharma, Anil Mehta
        Auditor: Deloitte Haskins & Sells
        GSTIN: 29ABCDE1234F1Z5
        PAN: ABCDE1234F
        """.strip(),
        encoding="utf-8",
    )

    summary = run_ingestion_pipeline(file_path=sample_path, document_id="doc-1")

    assert summary.parsed is True
    assert summary.status == "parsed"
    assert summary.structured_output is not None
    assert summary.structured_output.company_name == "ABC Textiles Pvt Ltd"
    assert summary.structured_output.gst_number == "29ABCDE1234F1Z5"
    assert summary.structured_output.revenue == 1_200_000_000.0
    assert summary.structured_output.debt == 550_000_000.0
    assert summary.structured_output.confidence_score > 0.0
    assert summary.validation_warnings
