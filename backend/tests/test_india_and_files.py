import pytest

from core.errors import ValidationFailed
from utils.files import safe_filename, validate_upload
from utils.india import (
    format_inr,
    format_inr_short,
    gstin_details,
    is_valid_cin,
    is_valid_gstin,
    is_valid_pan,
    make_gstin,
)


def test_gstin_checksum_roundtrip():
    gstin = make_gstin("27", "AAGCN2290H")
    assert is_valid_gstin(gstin)
    tampered = gstin[:-1] + ("A" if gstin[-1] != "A" else "B")
    assert not is_valid_gstin(tampered)
    details = gstin_details(gstin)
    assert details["state"] == "Maharashtra" and details["pan"] == "AAGCN2290H" and details["pan_entity_type"] == "Company"


def test_gstin_rejects_unknown_state():
    assert not is_valid_gstin("99AAGCN2290H1Z5")


def test_pan_and_cin():
    assert is_valid_pan("AAGCN2290H")
    assert not is_valid_pan("AAGXN2290H")  # 4th char must be a valid entity type
    assert is_valid_cin("U34300MH2011PTC219876")
    assert not is_valid_cin("U34300MH2011PTC21987")


@pytest.mark.parametrize("amount,expected", [
    (12000000, "₹1,20,00,000"), (999, "₹999"), (100000, "₹1,00,000"), (-4500000, "-₹45,00,000"),
])
def test_indian_grouping(amount, expected):
    assert format_inr(amount) == expected


def test_short_format():
    assert format_inr_short(12_00_00_000) == "₹12.00 Cr"
    assert format_inr_short(4_50_000) == "₹4.50 L"
    assert format_inr_short(None) == "—"


def test_upload_validation():
    ok = validate_upload("../../etc/Annual Report.pdf", b"%PDF-1.7 rest")
    assert ok.filename == "Annual Report.pdf" and ok.content_type == "application/pdf"
    with pytest.raises(ValidationFailed):
        validate_upload("malware.exe", b"MZ....")
    with pytest.raises(ValidationFailed):
        validate_upload("fake.pdf", b"not a pdf")
    with pytest.raises(ValidationFailed):
        validate_upload("active.pdf", b"%PDF-1.4 /JavaScript (app.alert(1))")
    assert safe_filename("a/b\\c<>.pdf") == "c__.pdf"
