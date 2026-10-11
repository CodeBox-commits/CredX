"""MCA / ROC intelligence: CIN decoding, company status, charges, filing compliance and directors."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from utils.india import CIN_RE, STATE_CODES

_OWNERSHIP = {"PLC": "Public limited company", "PTC": "Private limited company", "OPC": "One person company",
              "GOI": "Government of India company", "SGC": "State government company", "NPL": "Section 8 (not for profit)",
              "FTC": "Subsidiary of foreign company", "ULL": "Unlimited liability company"}
_ROC_STATES = {"MH": "Maharashtra", "GJ": "Gujarat", "KA": "Karnataka", "TN": "Tamil Nadu", "TG": "Telangana", "DL": "Delhi",
               "WB": "West Bengal", "UP": "Uttar Pradesh", "RJ": "Rajasthan", "AP": "Andhra Pradesh", "KL": "Kerala",
               "HR": "Haryana", "PB": "Punjab", "MP": "Madhya Pradesh", "OR": "Odisha", "BR": "Bihar", "GA": "Goa"}


def decode_cin(cin: str | None) -> dict[str, Any] | None:
    if not cin or not CIN_RE.fullmatch(cin.upper()):
        return None
    cin = cin.upper()
    return {"listed": cin[0] == "L", "industry_code": cin[1:6], "state": _ROC_STATES.get(cin[6:8], cin[6:8]),
            "incorporation_year": int(cin[8:12]), "ownership": _OWNERSHIP.get(cin[12:15], cin[12:15]), "registration_no": cin[15:]}


def analyze_mca(company: dict[str, Any], mca: dict[str, Any] | None, directors: list[dict[str, Any]]) -> dict[str, Any] | None:
    cin = company.get("cin") or None
    details = decode_cin(cin)
    if not mca and not details:
        return None
    mca = mca or {}
    year = company.get("incorporation_year") or (details or {}).get("incorporation_year")
    vintage = datetime.now(UTC).year - year if year else None
    observations: list[dict[str, str]] = []
    status = mca.get("company_status") or "active"
    if status != "active":
        observations.append({"severity": "CRITICAL", "text": f"ROC status is '{status.replace('_', ' ')}'"})
    if mca.get("filings_overdue"):
        observations.append({"severity": "HIGH", "text": "Annual filings (AOC-4 / MGT-7) are pending or overdue"})
    open_charges = [c for c in mca.get("charges") or [] if c.get("status") != "satisfied"]
    if len(open_charges) >= 3:
        observations.append({"severity": "MEDIUM", "text": f"{len(open_charges)} open charges registered — check pari-passu arrangements"})
    if vintage is not None and vintage < 3:
        observations.append({"severity": "MEDIUM", "text": f"Recently incorporated ({vintage} years) — limited track record"})
    company_state = company.get("state")
    if details and company_state and details["state"] not in (company_state, None) and company_state in STATE_CODES.values():
        observations.append({"severity": "LOW", "text": f"Registered in {details['state']}, operating from {company_state}"})
    if len(directors) == 1:
        observations.append({"severity": "LOW", "text": "Only one director identified in filings"})
    if not observations:
        observations.append({"severity": "LOW", "text": "No adverse ROC observations"})
    return {"cin": cin, "cin_details": details, "vintage_years": vintage, "company_status": status,
            "open_charges": [{"holder": c.get("holder"), "amount": c.get("amount"), "status": c.get("status", "open")}
                             for c in open_charges],
            "observations": observations, "directors": directors,
            "paid_up_capital": mca.get("paid_up_capital"), "authorised_capital": mca.get("authorised_capital")}
