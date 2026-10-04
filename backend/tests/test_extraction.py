from pathlib import Path

import pytest

from extraction.classification.classifier import classify
from extraction.financials.bank import extract_bank
from extraction.financials.documents import extract_legal
from extraction.financials.entities import extract_red_flags
from extraction.financials.gst import extract_gst
from extraction.normalization.amounts import detect_scale, find_fiscal_years, parse_amount
from extraction.pipeline import process_document
from models.enums import DocumentType

TEST_DOCS = Path(__file__).resolve().parents[2] / "test-docs"


@pytest.mark.parametrize("text,expected", [
    ("Revenue was INR 186 crore", 186e7), ("₹ 1,20,00,000", 12_000_000), ("Rs. 4.7 Cr", 4.7e7),
    ("12.5 lakh", 12.5e5), ("USD 3 million", 3e6), ("(1,234.50) crore", -1234.5e7),
])
def test_parse_amount(text, expected):
    assert parse_amount(text) == pytest.approx(expected)


def test_scale_and_fiscal_years():
    assert detect_scale("Statement of Profit and Loss (₹ in lakhs)") == 1e5
    assert detect_scale("(INR in crore)") == 1e7
    assert find_fiscal_years("Particulars FY25 FY24") == ["FY25", "FY24"]
    assert find_fiscal_years("for the year 2024-25 and 2023-24") == ["FY25", "FY24"]
    assert find_fiscal_years("as at 31.03.2025") == ["FY25"]


def test_negation_is_not_a_red_flag():
    flags = [f.label for f in extract_red_flags([(1, "No cheque returned during the review period.")])]
    assert "Cheque/ECS bounces" not in flags
    flags = [f.label for f in extract_red_flags([(1, "Cheque returned in June due to insufficient funds.")])]
    assert "Cheque/ECS bounces" in flags


def test_gst_mismatch():
    gst = extract_gst("GSTR-2A turnover: INR 171 crore\nGSTR-3B turnover: INR 186 crore")
    assert gst["mismatch_pct"] == pytest.approx(8.06, abs=0.01)


def test_bank_transactions_and_bounces():
    text = """Opening balance: INR 1.00 crore
01-04-2025 NEFT CR/UTR1234567890/ACME TRADERS 0.00 5,00,000.00 1,05,00,000.00
02-04-2025 RTGS DR/UTR1234567891/STEEL CO 2,00,000.00 0.00 1,03,00,000.00
15-04-2025 CHQ RETURN INSUFFICIENT FUNDS/CHQ004512 590.00 0.00 1,02,99,410.00"""
    bank = extract_bank(text)
    assert bank["transaction_count"] == 3 and bank["bounce_count"] == 1
    assert bank["total_credits"] == pytest.approx(500000)
    assert bank["counterparties"][0]["name"] == "Acme Traders"


def test_legal_notice():
    legal = extract_legal("Demand notice under Insolvency and Bankruptcy Code. The operational creditor alleges overdue outstanding of INR 4.7 crore and intends to file before NCLT.")
    assert legal["severity"] == "CRITICAL" and legal["forum"] == "NCLT" and legal["status"] == "threatened"
    assert legal["claim_amount"] == pytest.approx(4.7e7)


@pytest.mark.parametrize("name,expected", [
    ("annual_report_excerpt.pdf", DocumentType.ANNUAL_REPORT), ("bank_statement_summary.pdf", DocumentType.BANK_STATEMENT),
    ("gstr_3b_reconciliation_note.pdf", DocumentType.GST_RETURN), ("legal_notice_nclt.pdf", DocumentType.LEGAL_NOTICE),
])
def test_sample_documents_classified(name, expected):
    path = TEST_DOCS / "nebula_stressed_case" / name
    if not path.exists():
        pytest.skip("sample documents not present")
    result = process_document(path, name)
    assert result["doc_type"] == expected.value
    assert result["company_name"] == "Nebula Components Private Limited"


def test_generated_annual_report_extracts_exact_financials(demo_pack_dir, demo_specs):
    path = demo_pack_dir / "sunline" / "annual_report_FY25.pdf"
    result = process_document(path, path.name)
    expected = demo_specs["sunline"]["financials"]
    for fy in ("FY25", "FY24"):
        for field in ("revenue", "ebitda", "interest_expense", "net_worth", "current_assets", "receivables"):
            assert result["financials"][fy][field]["value"] == pytest.approx(expected[fy][field] * 1e7), (fy, field)
    assert result["financials"]["FY23"]["revenue"]["value"] == pytest.approx(191e7)
    assert {d["din"] for d in result["directors"]} >= {"00481236", "00481237"}
    assert result["confidence"]["overall"] > 0.8


def test_classifier_explains_itself():
    c = classify("SANCTION LETTER. We are pleased to sanction. Sanctioned limit. Primary security.", "x.pdf")
    assert c.doc_type == DocumentType.SANCTION_LETTER and c.signals and c.confidence > 0.6


def test_concurrent_ingestion_is_safe(demo_pack_dir):
    """The thread job pool parses PDFs concurrently; native PDF libs must be serialised (PDF_LOCK)."""
    from concurrent.futures import ThreadPoolExecutor

    paths = sorted(demo_pack_dir.glob("*/*.pdf"))[:12]
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda p: process_document(p, p.name), paths))
    assert len(results) == len(paths) and all(r["doc_type"] for r in results)
