"""Legal notices, sanction letters, shareholding patterns and MCA filings."""

from __future__ import annotations

import re

from utils.text import normalize_space

from ..normalization.amounts import parse_amount, parse_percent
from ..normalization.schema import (
    ExtractedTable,
    LegalMatter,
    MCAProfile,
    SanctionFacility,
    Shareholder,
)

_AMOUNT = r"((?:rs\.?|inr|₹)\s*[\d,.]+\s*(?:crores?|cr|lakhs?|lacs?|million|mn)?|[\d,.]+\s*(?:crores?|cr|lakhs?|lacs?))"

_FORUMS: list[tuple[re.Pattern[str], str, str, str]] = [
    (re.compile(r"section 7 of (?:the )?(?:ibc|insolvency)", re.I), "NCLT", "IBC Section 7 (financial creditor)", "CRITICAL"),
    (re.compile(r"section 9 of (?:the )?(?:ibc|insolvency)|operational creditor", re.I), "NCLT", "IBC Section 9 (operational creditor)", "HIGH"),
    (re.compile(r"\bnclt\b|national company law tribunal|insolvency and bankruptcy", re.I), "NCLT", "Insolvency proceedings", "HIGH"),
    (re.compile(r"\bdrt\b|debt recovery tribunal", re.I), "DRT", "Debt recovery", "HIGH"),
    (re.compile(r"sarfaesi|section 13\s*\(\s*[24]\s*\)", re.I), "SARFAESI", "SARFAESI enforcement", "CRITICAL"),
    (re.compile(r"section 138|negotiable instruments act|cheque dishonou?r", re.I), "Magistrate Court", "NI Act Sec 138 (cheque bounce)", "MEDIUM"),
    (re.compile(r"wilful defaulter", re.I), "Lender committee", "Wilful defaulter proceedings", "CRITICAL"),
    (re.compile(r"enforcement directorate|\bpmla\b|\bcbi\b|serious fraud investigation", re.I), "Investigative agency", "Regulatory / criminal investigation", "CRITICAL"),
    (re.compile(r"show cause notice|gst (?:demand|notice)|\bdgg?i\b", re.I), "Tax authority", "Tax demand / show-cause notice", "MEDIUM"),
    (re.compile(r"arbitration", re.I), "Arbitral tribunal", "Commercial arbitration", "MEDIUM"),
    (re.compile(r"high court|supreme court|civil suit|commercial court", re.I), "Civil court", "Civil litigation", "MEDIUM"),
]


def extract_legal(text: str) -> list[LegalMatter]:
    matters: list[LegalMatter] = []
    seen: set[str] = set()
    for pattern, forum, case_type, severity in _FORUMS:
        m = pattern.search(text)
        if not m or case_type in seen:
            continue
        if forum == "NCLT" and any(x.forum == "NCLT" for x in matters):
            continue
        seen.add(case_type)
        window = text[max(0, m.start() - 400) : m.end() + 400]
        amount = re.search(rf"(?:outstanding|claim(?:ed)?|dues?|amount|sum)[^.\n]{{0,40}}?{_AMOUNT}", window, re.I)
        counterparty = re.search(r"(?:creditor|petitioner|claimant|complainant|bank)\s*[:\-]\s*([A-Z][A-Za-z&.' ]{3,60})", window)
        ref = re.search(r"\b((?:CP|IA|OA|CC|C\.P\.|O\.A\.)\s*\(?(?:IB)?\)?\s*(?:No\.?)?\s*[\d/]+(?:/\d{4})?)", window)
        status = "THREATENED" if re.search(r"intends to|if unpaid|will be constrained|may (?:file|initiate)", window, re.I) else "PENDING"
        if re.search(r"admitted|moratorium declared|\birp\b appointed", window, re.I):
            status, severity = "ADMITTED", "CRITICAL"
        if re.search(r"settled|withdrawn|dismissed", window, re.I):
            status, severity = "CLOSED", "LOW"
        matters.append(
            LegalMatter(
                forum=forum,
                case_type=case_type,
                counterparty=normalize_space(counterparty.group(1)) if counterparty else None,
                amount=parse_amount(amount.group(1)) if amount else None,
                status=status,
                reference=ref.group(1) if ref else None,
                severity=severity,  # type: ignore[arg-type]
                summary=normalize_space(window[:300]),
            )
        )
    return matters


def extract_sanctions(text: str) -> list[SanctionFacility]:
    facilities: list[SanctionFacility] = []
    lender = re.search(
        r"\b((?:State Bank of India|HDFC Bank|ICICI Bank|Axis Bank|Kotak Mahindra Bank|Bank of Baroda|Punjab National Bank|"
        r"Canara Bank|Union Bank of India|IDFC First Bank|Yes Bank|IndusInd Bank|Bajaj Finance|Tata Capital|[A-Z][A-Za-z]+ (?:Bank|Finance|Capital)(?: Limited| Ltd)?))",
        text,
    )
    for m in re.finditer(
        rf"(term loan|cash credit|working capital(?: demand loan)?|overdraft|letter of credit|bank guarantee|"
        rf"wcdl|ecb|channel finance|od limit)[^.\n]{{0,60}}?{_AMOUNT}",
        text,
        re.I,
    ):
        window = text[m.start() : m.end() + 300]
        rate = re.search(r"(?:rate of interest|roi|interest)[^.\n%]{0,40}?(\d{1,2}(?:\.\d{1,2})?)\s*%", window, re.I)
        tenor = re.search(r"(\d{1,3})\s*months", window, re.I) or re.search(r"(\d{1,2})\s*years", window, re.I)
        tenor_months = None
        if tenor:
            tenor_months = int(tenor.group(1)) * (12 if "year" in tenor.group(0).lower() else 1)
        security = re.search(r"(?:primary security|collateral|secured by|hypothecation of)[^.\n]{0,160}", text[m.start():], re.I)
        facilities.append(
            SanctionFacility(
                lender=lender.group(1) if lender else None,
                facility=normalize_space(m.group(1)).title(),
                limit=parse_amount(m.group(2)),
                interest_rate=float(rate.group(1)) if rate else None,
                tenor_months=tenor_months,
                security=normalize_space(security.group(0)) if security else None,
            )
        )
    covenants = [
        normalize_space(c.group(0))
        for c in re.finditer(r"(?:DSCR|debt service coverage|TOL/TNW|current ratio|FACR)[^.\n]{0,40}?(?:≥|>=|not less than|minimum|maximum|<=|≤|not exceed)[^.\n]{0,25}", text, re.I)
    ]
    for facility in facilities:
        facility.covenants = covenants[:6]
    return facilities[:8]


def extract_shareholding(text: str, tables: list[ExtractedTable]) -> list[Shareholder]:
    holders: list[Shareholder] = []
    for table in tables:
        pct_col = next((i for i, h in enumerate(table.header) if re.search(r"%|percent|holding", h, re.I)), None)
        pledge_col = next((i for i, h in enumerate(table.header) if re.search(r"pledge|encumb", h, re.I)), None)
        if pct_col is None:
            continue
        for row in table.rows:
            pct = parse_percent(row[pct_col] + ("%" if "%" not in row[pct_col] else "")) if pct_col < len(row) else None
            if pct is None or not row[0]:
                continue
            label = row[0].lower()
            category = "promoter" if "promoter" in label else "institution" if re.search(r"fii|fpi|mutual|insurance|bank|institution", label) else "public" if "public" in label else "other"
            pledged = 0.0
            if pledge_col is not None and pledge_col < len(row):
                pledged = parse_percent(row[pledge_col] + "%") or 0.0
            holders.append(Shareholder(name=normalize_space(row[0]), category=category, holding_pct=pct, pledged_pct=pledged))  # type: ignore[arg-type]
    if not holders:
        promoter = re.search(r"promoter(?: and promoter group)?[^%\n]{0,40}?(\d{1,2}(?:\.\d+)?)\s*%", text, re.I)
        pledged = re.search(r"pledged?[^%\n]{0,40}?(\d{1,2}(?:\.\d+)?)\s*%", text, re.I)
        if promoter:
            holders.append(
                Shareholder(name="Promoter & Promoter Group", category="promoter", holding_pct=float(promoter.group(1)),
                            pledged_pct=float(pledged.group(1)) if pledged else 0.0)
            )
    return holders[:20]


def extract_mca(text: str) -> MCAProfile:
    profile = MCAProfile()
    status = re.search(r"company status\s*[:\-]?\s*(active|strike off|struck off|under liquidation|dormant|amalgamated)", text, re.I)
    profile.company_status = status.group(1).title() if status else None
    inc = re.search(r"date of incorporation\s*[:\-]?\s*([\d]{1,2}[/.-][\d]{1,2}[/.-][\d]{2,4}|\d{1,2}\s+\w+\s+\d{4})", text, re.I)
    profile.incorporation_date = inc.group(1) if inc else None
    for attr, label in (("authorised_capital", r"authori[sz]ed capital"), ("paid_up_capital", r"paid[- ]up capital")):
        m = re.search(rf"{label}[^\n\d₹]{{0,20}}{_AMOUNT}", text, re.I)
        if m:
            setattr(profile, attr, parse_amount(m.group(1)))
    agm = re.search(r"(?:last|date of last) agm\s*[:\-]?\s*([^\n]{6,20})", text, re.I)
    profile.last_agm_date = agm.group(1).strip() if agm else None
    for m in re.finditer(rf"charge[^\n]{{0,30}}?(?:holder|in favou?r of)\s*[:\-]?\s*([A-Z][A-Za-z&.' ]{{3,60}}?)\s*[,;:\-]\s*[^\n]{{0,30}}?{_AMOUNT}", text, re.I):
        profile.charges.append({"holder": normalize_space(m.group(1)), "amount": parse_amount(m.group(2)), "status": "OPEN"})
    profile.filing_delays = len(re.findall(r"filed (?:late|belatedly|with additional fees?)|delay(?:ed)? in filing|not filed", text, re.I))
    return profile
