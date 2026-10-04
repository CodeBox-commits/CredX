"""Corporate entity extraction: name, CIN, PAN, GSTINs, directors (with DIN), auditor."""

from __future__ import annotations

import re

from utils.identifiers import CIN_RE, PAN_RE, find_gstins
from utils.text import normalize_space

from ..normalization.fiscal import parse_fiscal_year
from ..normalization.schema import Director, EntityProfile

_COMPANY_RE = re.compile(
    r"\b(?:M/s\.?[ \t]+)?([A-Z][A-Za-z0-9&.'-]*(?:[ \t]+[A-Z&][A-Za-z0-9&.'-]*){0,6}[ \t]+"
    r"(?:Private Limited|Pvt\.? Ltd\.?|Limited|Ltd\.?|LLP))\b"
)
_STOP_PREFIXES = ("the ", "borrower ", "for ", "of ", "and ", "to ", "by ", "statement ", "dear ")
_DIRECTOR_RE = re.compile(
    r"(?:Mr\.|Ms\.|Mrs\.|Shri|Smt\.?|Dr\.)?\s*([A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+){1,3})"
    r"[\s,(-]+(?:DIN[:\s#-]*(\d{8}))?[\s,)-]*(Managing Director|Whole[- ]time Director|Executive Director|"
    r"Independent Director|Non-Executive Director|Director|Chairman|CEO|CFO|Promoter)",
)
_DIN_NAME_RE = re.compile(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[,(]?\s*DIN[:\s#-]*(\d{8})")
_AUDITOR_RE = re.compile(
    r"(?:for\s+)?([A-Z][A-Za-z&.' ]{2,60}?(?:& (?:Co|Associates|LLP)\.?|LLP|Associates))\s*[,\n]?\s*"
    r"(?:Chartered Accountants|\(?FRN|Firm Registration)",
)
_AUDITOR_LABEL_RE = re.compile(r"(?:statutory )?auditors?\s*[:\-]\s*([A-Z][A-Za-z&.' ]{3,60})", re.I)
_ADDRESS_RE = re.compile(r"registered office\s*[:\-]?\s*([^\n]{10,160})", re.I)


def _company_name(text: str) -> str | None:
    counts: dict[str, int] = {}
    for match in _COMPANY_RE.finditer(text[:30000]):
        name = normalize_space(match.group(1))
        lowered = name.lower()
        while lowered.startswith(_STOP_PREFIXES):
            name = name.split(" ", 1)[1] if " " in name else name
            lowered = name.lower()
        if len(name) < 8 or any(b in lowered for b in ("bank limited", "bank ltd", "ratings limited", "ratings ltd")):
            continue
        counts[name] = counts.get(name, 0) + 1
    if not counts:
        return None
    # Most frequently mentioned non-bank legal entity is almost always the borrower.
    return max(counts.items(), key=lambda kv: (kv[1], -text.find(kv[0])))[0]


def _directors(text: str) -> list[Director]:
    found: dict[str, Director] = {}
    for m in _DIRECTOR_RE.finditer(text):
        name = normalize_space(m.group(1))
        if len(name.split()) < 2 or name.lower().startswith(("the ", "board ", "managing ")):
            continue
        director = found.setdefault(name, Director(name=name))
        director.din = director.din or m.group(2)
        director.designation = director.designation or m.group(3)
    for m in _DIN_NAME_RE.finditer(text):
        name = normalize_space(m.group(1))
        director = found.setdefault(name, Director(name=name))
        director.din = director.din or m.group(2)
    return list(found.values())[:12]


def extract_entities(text: str) -> EntityProfile:
    cin = CIN_RE.search(text)
    pan = PAN_RE.search(text)
    auditor = _AUDITOR_RE.search(text) or _AUDITOR_LABEL_RE.search(text)
    address = _ADDRESS_RE.search(text)
    gstins = find_gstins(text)
    return EntityProfile(
        company_name=_company_name(text),
        cin=cin.group(1) if cin else None,
        pan=pan.group(1) if pan else (gstins[0][2:12] if gstins else None),
        gstins=gstins[:10],
        directors=_directors(text),
        auditor=normalize_space(auditor.group(1)) if auditor else None,
        registered_address=normalize_space(address.group(1)) if address else None,
        financial_year=parse_fiscal_year(text[:4000]),
    )
