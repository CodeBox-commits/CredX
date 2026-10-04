"""Extractors for legal notices, sanction letters, shareholding patterns and MCA filings."""

from __future__ import annotations

import re

from extraction.normalization.amounts import find_amounts

LEGAL_CASE_TYPES: list[tuple[str, str, str]] = [
    (r"insolvency and bankruptcy code|\bibc\b|\bnclt\b|section (?:7|9|10)\b", "IBC / NCLT insolvency", "CRITICAL"),
    (r"sarfaesi", "SARFAESI enforcement", "CRITICAL"),
    (r"debts recovery tribunal|\bdrt\b", "DRT recovery suit", "HIGH"),
    (r"section 138|negotiable instruments act|cheque dishonou?r", "Cheque dishonour (NI Act s.138)", "HIGH"),
    (r"enforcement directorate|\bpmla\b|money laundering", "ED / PMLA proceedings", "CRITICAL"),
    (r"\bgst\b[^.]{0,40}(?:show cause|evasion|demand)", "GST demand / show-cause", "HIGH"),
    (r"income tax[^.]{0,30}(?:demand|search|survey)", "Income-tax demand", "MEDIUM"),
    (r"arbitration", "Commercial arbitration", "MEDIUM"),
    (r"winding[- ]up petition", "Winding-up petition", "CRITICAL"),
    (r"labour court|industrial dispute|\bpf\b dues|esic", "Labour / statutory dues dispute", "MEDIUM"),
    (r"civil suit|recovery suit|commercial court", "Civil recovery suit", "MEDIUM"),
]
FORUMS = [
    ("NCLT", r"\bnclt\b|national company law tribunal"), ("NCLAT", r"\bnclat\b"), ("DRT", r"\bdrt\b|debts recovery tribunal"),
    ("High Court", r"high court"), ("Supreme Court", r"supreme court"), ("Arbitral Tribunal", r"arbitral tribunal|arbitration"),
    ("Metropolitan Magistrate", r"magistrate"), ("Commercial Court", r"commercial court"),
]


def extract_legal(text: str) -> dict:
    low = text.lower()
    case_types = [(label, sev) for pat, label, sev in LEGAL_CASE_TYPES if re.search(pat, low)]
    forum = next((name for name, pat in FORUMS if re.search(pat, low)), None)
    claim = None
    for m in re.finditer(r"(?:outstanding|claim(?:ed)?|dues?|amount|sum) (?:of )?", text, re.I):
        amounts = find_amounts(text[m.end(): m.end() + 60])
        if amounts:
            claim = amounts[0][0]
            break
    if claim is None and (amounts := find_amounts(text)):
        claim = max(a for a, _ in amounts)
    claimant = None
    if m := re.search(r"(operational creditor|financial creditor|claimant|petitioner|plaintiff|complainant)", low):
        claimant = m.group(1).title()
    claimant_name = None
    if m := re.search(r"(?:claimant|petitioner|plaintiff|complainant|operational creditor|financial creditor)\s*:\s*([^.\n]{3,120})", text, re.I):
        claimant_name = m.group(1).strip()
    status = "pending"
    if re.search(r"intends to file|if unpaid|shall be constrained", low):
        status = "threatened"
    elif re.search(r"admitted|order passed|decree", low):
        status = "adjudicated"
    elif re.search(r"settled|withdrawn|dismissed", low):
        status = "closed"
    severity = max((sev for _, sev in case_types), key=["LOW", "MEDIUM", "HIGH", "CRITICAL"].index, default="MEDIUM")
    return {
        "case_types": [c for c, _ in case_types],
        "severity": severity,
        "forum": forum,
        "claim_amount": claim,
        "claimant_type": claimant,
        "claimant_name": claimant_name,
        "status": status,
        "in_arbitration": "arbitration" in low,
    }


def extract_sanction(text: str) -> dict:
    low = text.lower()
    from extraction.financials.bank import _BANK_RE

    lender = None
    if m := _BANK_RE.search(text):
        lender = m.group(1)
    elif m := re.search(r"\b([A-Z][A-Za-z ]{2,40}(?:Bank|Finance|Capital|Financial Services)(?: Limited| Ltd\.?)?)\b", text):
        lender = m.group(1).strip()
    facilities = []
    for m in re.finditer(r"(term loan|cash credit|working capital demand loan|wcdl|overdraft|letter of credit|bank guarantee|ecb|guaranteed emergency credit line|gecl)[^\n]{0,80}", low):
        amounts = find_amounts(text[m.start(): m.end() + 40])
        facilities.append({"facility": m.group(1).upper() if len(m.group(1)) <= 5 else m.group(1).title(),
                           "limit": amounts[0][0] if amounts else None})
    rate = None
    if m := re.search(r"(?:rate of interest|\broi\b|interest rate)[^\n%]{0,60}?(\d{1,2}(?:\.\d{1,2})?)\s*%", low):
        rate = float(m.group(1))
    spread = None
    if m := re.search(r"(?:mclr|eblr|repo(?: rate)?|rllr)\s*\+\s*(\d(?:\.\d{1,2})?)\s*%", low):
        spread = float(m.group(1))
    tenure = None
    if m := re.search(r"tenure[^\n]{0,20}?(\d{1,3})\s*(months|years)", low):
        tenure = int(m.group(1)) * (12 if m.group(2) == "years" else 1)
    sentence = r"(?:[^.\n]|\.\d)"  # allow decimals like 1.25x inside a sentence
    covenants = [s.strip()[:200] for s in re.findall(rf"(?:covenant|shall maintain|shall not){sentence}{{10,160}}", text, re.I)][:10]
    securities = [s.strip()[:200] for s in re.findall(rf"(?:primary|collateral) security{sentence}{{5,160}}", text, re.I)][:6]
    named = {f["facility"] for f in facilities if f["limit"]}
    facilities = [f for f in facilities if f["limit"] or f["facility"] not in named]
    total = sum(f["limit"] for f in facilities if f["limit"]) or None
    return {"lender": lender, "facilities": facilities, "total_sanctioned": total, "interest_rate": rate,
            "spread_over_benchmark": spread, "tenure_months": tenure, "covenants": covenants, "securities": securities}


def extract_shareholding(text: str) -> dict:
    low = text.lower()

    def pct_after(label: str) -> float | None:
        m = re.search(label + r"[^\n%]{0,80}?(\d{1,3}(?:\.\d{1,2})?)\s*%", low)
        return float(m.group(1)) if m else None

    promoter = pct_after(r"promoter(?:s)?(?: and promoter group)?(?: holding| shareholding)?")
    public = pct_after(r"public(?: shareholding)?")
    pledged = pct_after(r"(?:pledged|encumbered)")
    holders = []
    for m in re.finditer(r"^([A-Z][A-Za-z.&\s]{3,60}?)\s+[\d,]{3,}\s+(\d{1,2}\.\d{1,2})\s*%?$", text, re.M):
        holders.append({"name": m.group(1).strip(), "pct": float(m.group(2))})
    return {"promoter_holding_pct": promoter, "public_holding_pct": public, "pledged_pct": pledged,
            "top_holders": holders[:15]}


def extract_mca(text: str) -> dict:
    low = text.lower()
    forms = sorted({f.upper().replace(" ", "-") for f in re.findall(r"\b((?:mgt|aoc|chg|dir|inc|adt|pas)[-\s]?\d{1,2}[a-z]?)\b", low)})
    charges = []
    for m in re.finditer(r"(?:charge (?:id|no\.?)[:\s]*(\d{5,10}))?[^\n]{0,60}?(?:charge holder|in favour of)[:\s]+([A-Z][A-Za-z .&]{3,60})", text):
        amounts = find_amounts(text[m.start(): m.end() + 80])
        status = "satisfied" if re.search(r"satisf", text[m.end(): m.end() + 80], re.I) else "open"
        charges.append({"charge_id": m.group(1), "holder": m.group(2).strip(), "amount": amounts[0][0] if amounts else None, "status": status})
    auth = None
    if m := re.search(r"authori[sz]ed (?:share )?capital", low):
        amounts = find_amounts(text[m.start(): m.end() + 60])
        auth = amounts[0][0] if amounts else None
    paid = None
    if m := re.search(r"paid[- ]up (?:share )?capital", low):
        amounts = find_amounts(text[m.start(): m.end() + 60])
        paid = amounts[0][0] if amounts else None
    status = "active"
    if re.search(r"strike off|struck off", low):
        status = "struck_off"
    elif re.search(r"under liquidation|under cirp|under insolvency", low):
        status = "under_insolvency"
    elif re.search(r"dormant", low):
        status = "dormant"
    filings_overdue = bool(re.search(r"(?:annual (?:return|filing)s?|aoc-4|mgt-7)[^.]{0,40}(?:not filed|pending|overdue|delayed)", low))
    return {"forms": forms, "charges": charges[:20], "authorised_capital": auth, "paid_up_capital": paid,
            "company_status": status, "filings_overdue": filings_overdue}
