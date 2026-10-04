"""MCA (Ministry of Corporate Affairs) intelligence from filings and director data."""

from __future__ import annotations

from datetime import date

from extraction.normalization.schema import Director, MCAProfile

from ..types import Finding, Level


def mca_findings(mca: MCAProfile | None, directors: list[Director], incorporation_year: int | None) -> tuple[list[Finding], Level]:
    findings: list[Finding] = []
    points = 0
    if mca:
        if mca.company_status and mca.company_status.lower() not in {"active"}:
            points += 4
            findings.append(Finding(category="mca", title=f"MCA status: {mca.company_status}",
                                    summary="Company is not in 'Active' status on the MCA master data.",
                                    source_name="MCA filing", severity="CRITICAL", sentiment="NEGATIVE",
                                    sentiment_score=-0.8, relevance=1.0, provider="documents"))
        if mca.filing_delays:
            points += min(3, mca.filing_delays)
            findings.append(Finding(category="mca", title=f"{mca.filing_delays} delayed ROC filing(s)",
                                    summary="Annual returns / financial statements were filed late with additional fees.",
                                    source_name="MCA filing", severity="MEDIUM" if mca.filing_delays < 3 else "HIGH",
                                    sentiment="NEGATIVE", sentiment_score=-0.3, relevance=0.8, provider="documents"))
        open_charges = [c for c in mca.charges if c.get("status", "OPEN") == "OPEN"]
        if open_charges:
            total = sum(c.get("amount") or 0 for c in open_charges)
            holders = ", ".join(sorted({c.get('holder', '?') for c in open_charges}))[:200]
            points += 1 if len(open_charges) > 3 else 0
            findings.append(Finding(category="mca", title=f"{len(open_charges)} open charge(s) registered with ROC",
                                    summary=f"Charges in favour of {holders}; aggregate ₹{total:,.0f}. Verify pari-passu / ceding before sanction.",
                                    source_name="MCA charge register", severity="LOW", relevance=0.7, provider="documents"))
    if incorporation_year and date.today().year - incorporation_year < 3:
        points += 2
        findings.append(Finding(category="mca", title="Recently incorporated entity",
                                summary=f"Incorporated in {incorporation_year}; limited operating track record.",
                                source_name="MCA master data", severity="MEDIUM", relevance=0.7, provider="documents"))
    busy = [d for d in directors if len(d.other_directorships) >= 8]
    if busy:
        points += 1
        findings.append(Finding(category="mca", title=f"{len(busy)} director(s) with 8+ directorships",
                                summary="High directorship counts may indicate nominee/shell structures.",
                                source_name="MCA director data", severity="LOW", relevance=0.6, provider="documents"))
    level: Level = "HIGH" if points >= 4 else "MEDIUM" if points >= 2 else "LOW"
    return findings, level
