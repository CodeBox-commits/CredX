"""Validation for Indian corporate identifiers (GSTIN, PAN, CIN, DIN)."""

from __future__ import annotations

import re

GSTIN_RE = re.compile(r"\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b")
PAN_RE = re.compile(r"\b([A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z])\b")
CIN_RE = re.compile(r"\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b")
DIN_RE = re.compile(r"\bDIN[:\s#-]*(\d{8})\b", re.I)

_GST_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

GST_STATE_CODES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
    "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "36": "Telangana", "37": "Andhra Pradesh",
}


def gstin_checksum(first14: str) -> str:
    """Compute the GSTIN check character (mod-36 Luhn variant used by GSTN)."""
    total = 0
    for i, ch in enumerate(first14):
        value = _GST_CHARSET.index(ch) * (2 if i % 2 else 1)
        total += value // 36 + value % 36
    return _GST_CHARSET[(36 - total % 36) % 36]


def is_valid_gstin(gstin: str, *, verify_checksum: bool = True) -> bool:
    gstin = gstin.strip().upper()
    if not GSTIN_RE.fullmatch(gstin):
        return False
    if gstin[:2] not in GST_STATE_CODES:
        return False
    return not verify_checksum or gstin_checksum(gstin[:14]) == gstin[14]


def make_gstin(state_code: str, pan: str, entity_no: str = "1") -> str:
    """Build a checksum-valid GSTIN (used by demo/seed data generators)."""
    body = f"{state_code}{pan}{entity_no}Z"
    return body + gstin_checksum(body)


def gstin_state(gstin: str | None) -> str | None:
    return GST_STATE_CODES.get(gstin[:2]) if gstin else None


def pan_from_gstin(gstin: str) -> str:
    return gstin[2:12]


def find_gstins(text: str) -> list[str]:
    seen: list[str] = []
    for match in GSTIN_RE.findall(text.upper()):
        if match not in seen and is_valid_gstin(match, verify_checksum=False):
            seen.append(match)
    return seen
