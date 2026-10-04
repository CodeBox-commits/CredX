"""India-specific identifiers and formatting: GSTIN, PAN, CIN, lakh/crore."""

from __future__ import annotations

import re

GSTIN_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
GSTIN_RE = re.compile(r"\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b")
PAN_RE = re.compile(r"\b([A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z])\b")
CIN_RE = re.compile(r"\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b")
DIN_RE = re.compile(r"\bDIN[:\s#-]*(\d{8})\b", re.I)

STATE_CODES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
    "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman & Nicobar", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
}

PAN_ENTITY_TYPES = {
    "C": "Company", "P": "Individual", "H": "HUF", "F": "Firm/LLP", "A": "AOP", "T": "Trust",
    "B": "BOI", "L": "Local Authority", "J": "Artificial Juridical Person", "G": "Government",
}


def gstin_checksum(first14: str) -> str:
    total = 0
    for i, ch in enumerate(first14):
        product = GSTIN_CHARSET.index(ch) * (2 if i % 2 else 1)
        total += product // 36 + product % 36
    return GSTIN_CHARSET[(36 - total % 36) % 36]


def is_valid_gstin(gstin: str) -> bool:
    gstin = gstin.strip().upper()
    if not GSTIN_RE.fullmatch(gstin) or gstin[:2] not in STATE_CODES:
        return False
    return gstin_checksum(gstin[:14]) == gstin[14]


def make_gstin(state_code: str, pan: str, entity_no: str = "1") -> str:
    """Build a checksum-valid GSTIN (used for synthetic demo data)."""
    body = f"{state_code}{pan}{entity_no}Z"
    return body + gstin_checksum(body)


def gstin_details(gstin: str) -> dict[str, object]:
    gstin = gstin.strip().upper()
    return {
        "gstin": gstin,
        "valid": is_valid_gstin(gstin),
        "state_code": gstin[:2],
        "state": STATE_CODES.get(gstin[:2]),
        "pan": gstin[2:12],
        "pan_entity_type": PAN_ENTITY_TYPES.get(gstin[5]) if len(gstin) > 5 else None,
    }


def is_valid_pan(pan: str) -> bool:
    return bool(PAN_RE.fullmatch(pan.strip().upper()))


def is_valid_cin(cin: str) -> bool:
    return bool(CIN_RE.fullmatch(cin.strip().upper()))


def _group_indian(integer: int) -> str:
    s = str(abs(integer))
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    if head:
        parts.insert(0, head)
    return ",".join(parts) + "," + tail


def format_inr(amount: float | int | None, decimals: int = 0) -> str:
    """12000000 -> '₹1,20,00,000'."""
    if amount is None:
        return "—"
    sign = "-" if amount < 0 else ""
    whole = int(abs(round(amount, decimals)))
    out = f"{sign}₹{_group_indian(whole)}"
    if decimals:
        frac = f"{abs(amount):.{decimals}f}".split(".")[1]
        out += f".{frac}"
    return out


def format_inr_short(amount: float | int | None) -> str:
    """12000000 -> '₹1.20 Cr', 450000 -> '₹4.50 L'."""
    if amount is None:
        return "—"
    sign = "-" if amount < 0 else ""
    value = abs(amount)
    if value >= 1e7:
        return f"{sign}₹{value / 1e7:,.2f} Cr"
    if value >= 1e5:
        return f"{sign}₹{value / 1e5:,.2f} L"
    return f"{sign}₹{value:,.0f}"


def indian_fy(year_end: int) -> str:
    """2025 -> 'FY25' (April 2024 – March 2025)."""
    return f"FY{year_end % 100:02d}"
