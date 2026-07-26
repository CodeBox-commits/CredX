from __future__ import annotations

import re

DOCUMENT_TYPE_RULES: list[tuple[str, list[re.Pattern[str]]]] = [
    (
        "Annual Report",
        [
            re.compile(r"\bannual report\b", re.I),
            re.compile(r"\bbalance sheet\b", re.I),
            re.compile(r"\bstatement of profit and loss\b", re.I),
        ],
    ),
    (
        "Bank Statement",
        [
            re.compile(r"\bbank statement\b", re.I),
            re.compile(r"\bopening balance\b", re.I),
            re.compile(r"\bclosing balance\b", re.I),
        ],
    ),
    (
        "GST Return",
        [
            re.compile(r"\bgstr[- ]?[1239]\b", re.I),
            re.compile(r"\bgoods and services tax\b", re.I),
            re.compile(r"\binput tax credit\b", re.I),
        ],
    ),
    (
        "Sanction Letter",
        [
            re.compile(r"\bsanction letter\b", re.I),
            re.compile(r"\bcredit facility\b", re.I),
            re.compile(r"\bterms and conditions\b", re.I),
        ],
    ),
    (
        "Legal Notice",
        [
            re.compile(r"\blegal notice\b", re.I),
            re.compile(r"\bdemand notice\b", re.I),
            re.compile(r"\barbitration\b", re.I),
            re.compile(r"\bnclt\b", re.I),
        ],
    ),
    (
        "Shareholding Pattern",
        [
            re.compile(r"\bshareholding pattern\b", re.I),
            re.compile(r"\bpromoter holding\b", re.I),
        ],
    ),
    (
        "MCA Filing",
        [
            re.compile(r"\bministry of corporate affairs\b", re.I),
            re.compile(r"\bcertificate of incorporation\b", re.I),
            re.compile(r"\bcin\b", re.I),
        ],
    ),
]


def detect_document_type(text: str, filename: str) -> str:
    searchable = f"{filename} {text}"
    for document_type, patterns in DOCUMENT_TYPE_RULES:
        if any(pattern.search(searchable) for pattern in patterns):
            return document_type
    return "Financial Document"
