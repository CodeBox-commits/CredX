"""Curated Indian sector outlook with RBI / policy context.

This is analyst reference material, not live data — each entry lists the
regulatory themes an underwriter should check. Keep it reviewed quarterly and
verify the latest RBI circulars before relying on a reference.
"""

from __future__ import annotations

from typing import Any

SECTORS: dict[str, dict[str, Any]] = {
    "textiles": {
        "label": "Textiles & Apparel",
        "outlook": "WEAK",
        "risk_score": 62,
        "headwinds": [
            "Cotton and yarn price volatility compresses spinning/processing margins",
            "Export demand from US/EU remains uneven; competition from Bangladesh and Vietnam",
            "Working-capital intensive with elongated receivable cycles for MSME suppliers",
        ],
        "tailwinds": ["PM MITRA parks and PLI scheme for MMF/technical textiles", "China+1 sourcing shift"],
        "rbi_references": [
            "Priority Sector Lending directions — MSME textile units qualify for PSL",
            "MSME restructuring frameworks — check for past restructured exposure in CIC data",
        ],
        "monitorables": ["Capacity utilisation", "Export order book", "Cotton price trend", "Receivable days"],
    },
    "auto_components": {
        "label": "Auto Components",
        "outlook": "STABLE",
        "risk_score": 45,
        "headwinds": ["EV transition risk for ICE-dependent product lines", "OEM pricing pressure and customer concentration"],
        "tailwinds": ["PLI scheme for automobile & auto components", "Export opportunities as global OEMs diversify supply chains"],
        "rbi_references": ["Large exposure / customer-concentration checks under lender's internal policy"],
        "monitorables": ["Top-5 OEM concentration", "EV readiness of product portfolio", "Capex funding mix"],
    },
    "pharmaceuticals": {
        "label": "Pharmaceuticals",
        "outlook": "FAVORABLE",
        "risk_score": 32,
        "headwinds": ["USFDA inspection outcomes (Form 483 / warning letters)", "API import dependence and price controls (NLEM/DPCO)"],
        "tailwinds": ["PLI for bulk drugs and APIs", "Strong domestic formulation demand", "Generics export pipeline"],
        "rbi_references": ["No sector-specific prudential restrictions; standard asset provisioning applies"],
        "monitorables": ["Regulatory audit history", "R&D spend", "Receivables from export distributors"],
    },
    "infrastructure": {
        "label": "Infrastructure & EPC",
        "outlook": "STABLE",
        "risk_score": 55,
        "headwinds": ["Execution delays and cost overruns", "Government receivable delays and arbitration claims", "Bid-margin compression"],
        "tailwinds": ["Sustained central/state capex on roads, rail and urban infra", "National Infrastructure Pipeline"],
        "rbi_references": [
            "RBI prudential framework for project finance (draft, May 2024) — higher provisioning during construction phase",
            "Date of commencement of commercial operations (DCCO) deferment norms",
        ],
        "monitorables": ["Order book / revenue cover", "Unbilled revenue", "Mobilisation advances", "Bank guarantee utilisation"],
    },
    "food_processing": {
        "label": "Food Processing & Agri",
        "outlook": "STABLE",
        "risk_score": 48,
        "headwinds": ["Monsoon dependence and commodity price swings", "Export bans/stock limits on select commodities", "Thin trading margins"],
        "tailwinds": ["PLI for food processing", "PMKSY cold-chain support", "Rising packaged-food consumption"],
        "rbi_references": ["Priority Sector Lending — agri-processing eligible", "Warehouse receipt financing guidelines"],
        "monitorables": ["Inventory holding vs. seasonality", "Trading vs. processing revenue mix", "Related-party trading"],
    },
    "nbfc": {
        "label": "NBFC / Financial Services",
        "outlook": "STABLE",
        "risk_score": 50,
        "headwinds": [
            "Higher bank risk weights on lending to NBFCs (RBI, Nov 2023) raised funding costs",
            "Asset-quality pressure in unsecured retail segments",
        ],
        "tailwinds": ["Credit penetration opportunity in MSME and rural segments", "Co-lending model with banks"],
        "rbi_references": [
            "Scale Based Regulation (SBR) framework for NBFCs (Oct 2021)",
            "RBI measures on consumer credit & bank lending to NBFCs (Nov 2023) — increased risk weights",
        ],
        "monitorables": ["CRAR", "GNPA/NNPA trend", "ALM mismatches", "Borrowing concentration"],
    },
    "real_estate": {
        "label": "Real Estate",
        "outlook": "WEAK",
        "risk_score": 68,
        "headwinds": ["Project-level cash flow risk and approval delays", "High leverage at developer level", "RERA-escrow constraints on fund fungibility"],
        "tailwinds": ["Strong residential absorption in top metros", "Consolidation towards Grade-A developers"],
        "rbi_references": [
            "Commercial Real Estate (CRE) exposure classified as sensitive sector — higher risk weights & provisioning",
            "Restrictions on bank finance for land acquisition",
        ],
        "monitorables": ["Escrow collections", "Unsold inventory months", "Approval status", "Promoter pledge"],
    },
    "it_services": {
        "label": "IT & Technology Services",
        "outlook": "STABLE",
        "risk_score": 35,
        "headwinds": ["Discretionary tech spend slowdown in US/EU", "Pricing pressure from GenAI-led productivity"],
        "tailwinds": ["GCC (global capability centre) expansion in India", "Digital transformation demand"],
        "rbi_references": ["Asset-light: lend against receivables / cash flows; collateral cover typically limited"],
        "monitorables": ["Client concentration", "Utilisation & attrition", "Forex hedging"],
    },
    "steel_metals": {
        "label": "Steel & Metals",
        "outlook": "STABLE",
        "risk_score": 52,
        "headwinds": ["Cyclical pricing and import competition", "Coking coal cost volatility"],
        "tailwinds": ["Infrastructure-led domestic demand", "Trade-remedy measures on cheap imports"],
        "rbi_references": ["Large borrower framework — check aggregate banking-system exposure"],
        "monitorables": ["Spread over raw material", "Capacity utilisation", "Inventory valuation"],
    },
    "chemicals": {
        "label": "Specialty Chemicals",
        "outlook": "STABLE",
        "risk_score": 44,
        "headwinds": ["Chinese dumping and price erosion", "Environmental compliance and pollution-board actions"],
        "tailwinds": ["China+1 sourcing", "Import substitution"],
        "rbi_references": ["Standard asset provisioning; ESG/environmental clearances as sanction pre-condition"],
        "monitorables": ["Customer approvals", "Capex ramp-up", "Pollution control board notices"],
    },
    "renewable_energy": {
        "label": "Renewable Energy",
        "outlook": "FAVORABLE",
        "risk_score": 38,
        "headwinds": ["DISCOM payment delays", "Module price volatility & ALMM requirements"],
        "tailwinds": ["500 GW non-fossil target by 2030", "PLI for solar modules", "Green hydrogen mission"],
        "rbi_references": ["Renewable energy eligible under Priority Sector Lending (within limits)"],
        "monitorables": ["PPA counterparty rating", "Plant load factor", "DSRA maintenance"],
    },
    "hospitality": {
        "label": "Hospitality",
        "outlook": "STABLE",
        "risk_score": 50,
        "headwinds": ["Seasonality and event-driven demand shocks", "High fixed-cost base"],
        "tailwinds": ["Strong domestic travel demand", "Limited new premium supply"],
        "rbi_references": ["Past COVID-era restructuring — check resolution-framework history"],
        "monitorables": ["Occupancy", "ARR / RevPAR", "Debt-service reserve"],
    },
    "manufacturing": {
        "label": "General Manufacturing",
        "outlook": "STABLE",
        "risk_score": 47,
        "headwinds": ["Input-cost inflation", "Working-capital intensity"],
        "tailwinds": ["Make in India / PLI schemes", "Domestic capex cycle"],
        "rbi_references": ["MSME classification (Udyam) determines PSL eligibility"],
        "monitorables": ["Capacity utilisation", "Order book", "Working-capital cycle"],
    },
}

_ALIASES = {
    "textile": "textiles", "apparel": "textiles", "garments": "textiles", "auto": "auto_components",
    "automotive": "auto_components", "auto components": "auto_components", "pharma": "pharmaceuticals",
    "healthcare": "pharmaceuticals", "infra": "infrastructure", "construction": "infrastructure", "epc": "infrastructure",
    "food": "food_processing", "agri": "food_processing", "agriculture": "food_processing", "fmcg": "food_processing",
    "financial services": "nbfc", "finance": "nbfc", "realty": "real_estate", "real estate": "real_estate",
    "it": "it_services", "technology": "it_services", "software": "it_services", "steel": "steel_metals",
    "metals": "steel_metals", "chemical": "chemicals", "solar": "renewable_energy", "renewable": "renewable_energy",
    "power": "renewable_energy", "hotel": "hospitality",
}


def sector_profile(sector: str | None) -> dict[str, Any]:
    key = (sector or "manufacturing").strip().lower().replace("&", "and")
    if key.replace(" ", "_") in SECTORS:
        resolved = key.replace(" ", "_")
    else:
        resolved = next((v for alias, v in _ALIASES.items() if alias in key), "manufacturing")
    return {"key": resolved, **SECTORS[resolved]}


def list_sectors() -> list[dict[str, Any]]:
    return [{"key": k, "label": v["label"], "outlook": v["outlook"], "risk_score": v["risk_score"]} for k, v in SECTORS.items()]
