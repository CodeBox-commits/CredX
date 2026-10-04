from __future__ import annotations

import re

from ...schemas.uploads import StructuredExtraction
from ..normalization.amounts import extract_first_amount, normalize_space

COMPANY_PATTERN = re.compile(
    r"\b([A-Z][A-Za-z0-9&.,()' -]{2,}?(?:Pvt\.?\s+Ltd\.?|Private Limited|Limited|Ltd\.?|LLP))\b"
)
CIN_PATTERN = re.compile(r"\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b")
GST_PATTERN = re.compile(r"\b(\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\w)\b", re.I)
PAN_PATTERN = re.compile(r"\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b")
AUDITOR_PATTERN = re.compile(r"\b(?:auditor|statutory auditor)\b[:\s-]+([A-Z][A-Za-z .&]{2,})", re.I)
DIRECTOR_PATTERN = re.compile(
    r"\b(?:director|directors|promoter|managing director)\b[:\s-]+([A-Z][A-Za-z .]{2,})",
    re.I,
)

REVENUE_PATTERNS = [
    re.compile(r"(?:revenue|turnover|net sales)[^\n\r]{0,40}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
EBITDA_PATTERNS = [
    re.compile(r"(?:ebitda)[^\n\r]{0,30}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
LIABILITIES_PATTERNS = [
    re.compile(r"(?:total liabilities|liabilities)[^\n\r]{0,30}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
DEBT_PATTERNS = [
    re.compile(r"(?:total debt|borrowings|long term debt|secured loan|working capital debt)[^\n\r]{0,40}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
ASSET_PATTERNS = [
    re.compile(r"(?:total assets|assets)[^\n\r]{0,30}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
OPERATING_PROFIT_PATTERNS = [
    re.compile(r"(?:operating profit|operating income|ebit|pbt)[^\n\r]{0,35}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
PROFIT_PATTERNS = [
    re.compile(r"(?:net profit|profit after tax|pat)[^\n\r]{0,35}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
CURRENT_ASSET_PATTERNS = [
    re.compile(r"(?:current assets)[^\n\r]{0,35}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
CURRENT_LIABILITY_PATTERNS = [
    re.compile(r"(?:current liabilities|short term liabilities)[^\n\r]{0,35}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
FIXED_ASSET_PATTERNS = [
    re.compile(r"(?:fixed assets|non-current assets)[^\n\r]{0,35}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
INVENTORY_PATTERNS = [
    re.compile(r"(?:inventory|stock)[^\n\r]{0,30}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
CASH_PATTERNS = [
    re.compile(r"(?:cash and cash equivalents|cash balance|cash)[^\n\r]{0,35}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
NET_WORTH_PATTERNS = [
    re.compile(r"(?:net worth|shareholders' funds|equity)[^\n\r]{0,35}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
INTEREST_EXPENSE_PATTERNS = [
    re.compile(r"(?:interest expense|finance cost)[^\n\r]{0,35}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
TAX_EXPENSE_PATTERNS = [
    re.compile(r"(?:tax expense|tax provision)[^\n\r]{0,35}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
LOAN_PATTERNS = [
    re.compile(r"(?:borrowings|loans|term loans)[^\n\r]{0,35}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
CREDITOR_PATTERNS = [
    re.compile(r"(?:creditors|trade creditors)[^\n\r]{0,35}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]
DEBTOR_PATTERNS = [
    re.compile(r"(?:debtors|trade debtors|receivables)[^\n\r]{0,35}?((?:rs\.?|inr|₹)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million|mn|billion|bn)?)", re.I),
]

RISK_KEYWORDS = {
    "GST mismatch": re.compile(r"\bgstr[- ]?2a\b|\bgstr[- ]?3b\b|\bmismatch\b", re.I),
    "Litigation reference": re.compile(r"\blitigation\b|\barbitration\b|\bnclt\b|\binsolvency\b", re.I),
    "Promoter linkage": re.compile(r"\brelated party\b|\bpromoter\b|\bgroup company\b", re.I),
    "Liquidity stress": re.compile(r"\bliquidity\b|\boverdue\b|\bdefault\b|\bnegative cash flow\b", re.I),
}


def _collect_directors(text: str) -> list[str]:
    directors: list[str] = []
    for match in DIRECTOR_PATTERN.findall(text):
        name = normalize_space(match)
        if len(name) >= 4 and name not in directors:
            directors.append(name)
    return directors[:6]


def _extract_financial_year(text: str) -> str | None:
    year_matches = re.findall(r"\b(?:FY|financial year)\s*(?:20\d{2}|19\d{2})[-/](?:20\d{2}|19\d{2})\b", text, re.I)
    if year_matches:
        return year_matches[0].upper()
    return None


def _financial_health(revenue: float | None, debt: float | None, risk_indicators: list[str]) -> str:
    if revenue and debt:
        leverage = debt / max(revenue, 1.0)
        if leverage > 0.8 or len(risk_indicators) >= 3:
            return "STRESSED"
        if leverage > 0.4 or len(risk_indicators) >= 2:
            return "MODERATE"
        return "STRONG"
    if len(risk_indicators) >= 3:
        return "STRESSED"
    if len(risk_indicators) >= 1:
        return "MODERATE"
    return "UNKNOWN"


def extract_structured_entities(
    *,
    text: str,
    document_type: str,
    confidence_score: float,
) -> StructuredExtraction:
    company_match = COMPANY_PATTERN.search(text)
    cin_match = CIN_PATTERN.search(text)
    gst_match = GST_PATTERN.search(text)

    risk_indicators = [
        label for label, pattern in RISK_KEYWORDS.items() if pattern.search(text)
    ]

    revenue = extract_first_amount(text, REVENUE_PATTERNS)
    ebitda = extract_first_amount(text, EBITDA_PATTERNS)
    operating_profit = extract_first_amount(text, OPERATING_PROFIT_PATTERNS)
    net_profit = extract_first_amount(text, PROFIT_PATTERNS)
    liabilities = extract_first_amount(text, LIABILITIES_PATTERNS)
    debt = extract_first_amount(text, DEBT_PATTERNS)
    total_assets = extract_first_amount(text, ASSET_PATTERNS)
    current_assets = extract_first_amount(text, CURRENT_ASSET_PATTERNS)
    current_liabilities = extract_first_amount(text, CURRENT_LIABILITY_PATTERNS)
    fixed_assets = extract_first_amount(text, FIXED_ASSET_PATTERNS)
    inventory = extract_first_amount(text, INVENTORY_PATTERNS)
    cash = extract_first_amount(text, CASH_PATTERNS)
    net_worth = extract_first_amount(text, NET_WORTH_PATTERNS)
    interest_expense = extract_first_amount(text, INTEREST_EXPENSE_PATTERNS)
    tax_expense = extract_first_amount(text, TAX_EXPENSE_PATTERNS)
    loans = extract_first_amount(text, LOAN_PATTERNS)
    creditors = extract_first_amount(text, CREDITOR_PATTERNS)
    debtors = extract_first_amount(text, DEBTOR_PATTERNS)
    pan_match = PAN_PATTERN.search(text)
    auditor_match = AUDITOR_PATTERN.search(text)

    return StructuredExtraction(
        company_name=company_match.group(1) if company_match else None,
        cin=cin_match.group(1) if cin_match else None,
        gst_number=gst_match.group(1).upper() if gst_match else None,
        pan=pan_match.group(1).upper() if pan_match else None,
        document_type=document_type,
        revenue=revenue,
        ebitda=ebitda,
        operating_profit=operating_profit,
        net_profit=net_profit,
        liabilities=liabilities,
        debt=debt,
        current_assets=current_assets,
        current_liabilities=current_liabilities,
        fixed_assets=fixed_assets,
        inventory=inventory,
        cash=cash,
        net_worth=net_worth,
        total_assets=total_assets,
        interest_expense=interest_expense,
        tax_expense=tax_expense,
        loans=loans,
        creditors=creditors,
        debtors=debtors,
        directors=_collect_directors(text),
        auditor=normalize_space(auditor_match.group(1)) if auditor_match else None,
        financial_year=_extract_financial_year(text),
        risk_indicators=risk_indicators,
        financial_health=_financial_health(revenue, debt, risk_indicators),
        confidence_score=confidence_score,
    )
