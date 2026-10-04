"""Curated, entirely FICTIONAL research intelligence for the seeded demo companies.

All companies, people, events and outlets below are invented for demonstration. Each article is
tagged `provider="demo_intel"` and the UI labels it "Demo data — fictional".
"""

from __future__ import annotations

from research.news.providers import Article

_DEMO: dict[str, list[tuple[str, str, str, str, str]]] = {
    # company key -> [(published, source, category_hint, title, snippet)]
    "nebula components": [
        ("2025-08-22", "Pune Business Ledger (demo)", "litigation",
         "Operational creditor issues IBC demand notice to Nebula Components over ₹4.7 crore dues",
         "A steel supplier has served a Section 8 demand notice and plans to approach NCLT Mumbai if dues remain unpaid."),
        ("2025-07-30", "AutoParts Weekly (demo)", "news",
         "Nebula Components loses supply contract with two-wheeler OEM amid quality concerns",
         "The OEM has shifted volumes to an alternate vendor after repeated delivery delays and rejection rates."),
        ("2025-07-12", "Rating Desk India (demo)", "news",
         "Rating agency revises Nebula Components outlook to Negative on stretched liquidity",
         "The agency cited elongated receivables, margin compression and reliance on promoter funding."),
        ("2025-06-18", "GST Watch (demo)", "regulatory",
         "GST intelligence wing probes auto-parts distributors in Pune for circular invoicing",
         "Officials are examining invoice chains between Zenith Distributors, Apex Auto Traders and a component maker."),
        ("2025-05-04", "Maharashtra Courts Digest (demo)", "litigation",
         "Cheque dishonour complaint filed against Nebula Components under Section 138",
         "A logistics vendor alleges a ₹38 lakh cheque was returned for insufficient funds."),
        ("2025-03-10", "Pune Business Ledger (demo)", "news",
         "Nebula promoter Rakesh Malhotra steps down from board of Zenith Distributors",
         "The move comes weeks after questions about related-party sales between the two firms."),
    ],
    "sunline processors": [
        ("2025-09-02", "AgriBiz Today (demo)", "news",
         "Sunline Processors commissions new cold-chain facility in Rajkot",
         "The ₹60 crore expansion adds 30% capacity and was funded through internal accruals and a term loan."),
        ("2025-07-21", "Rating Desk India (demo)", "news",
         "Sunline Processors rating reaffirmed at A-/Stable",
         "The agency highlighted healthy order book, low leverage and improving working-capital cycle."),
        ("2025-05-15", "Export Times (demo)", "news",
         "Sunline bags multi-year dehydrated-onion export order from Middle East retailer",
         "The contract is expected to contribute ₹45 crore in annual revenue from FY26."),
        ("2024-12-03", "Gujarat Industry News (demo)", "regulatory",
         "FSSAI renews Sunline Processors' central licence after routine inspection",
         "No adverse observations were recorded in the inspection report."),
    ],
    "aarav textiles": [
        ("2025-08-11", "Tiruppur Textile Times (demo)", "news",
         "Tiruppur knitwear exporters report slowdown as US orders soften",
         "Units including Aarav Textiles are running below 50% capacity as buyers defer orders."),
        ("2025-06-25", "Textile Policy Monitor (demo)", "regulatory",
         "Cotton prices ease; RoDTEP rates extended for apparel exports",
         "Exporters welcomed the extension of export-incentive rates through FY26."),
        ("2025-04-08", "Labour Courts Digest (demo)", "litigation",
         "Labour court hears wage dispute at Aarav Textiles' Avinashi unit",
         "Workers' union seeks revision of piece rates; matter adjourned to next quarter."),
        ("2025-02-14", "Tiruppur Textile Times (demo)", "news",
         "Aarav Textiles adds rooftop solar to cut power costs by 18%",
         "Promoter Meena Aravind said the investment improves competitiveness with Bangladesh exporters."),
    ],
    "kaveri infra": [
        ("2025-09-10", "Infra Dispatch (demo)", "news",
         "Kaveri Infra Projects wins ₹420 crore state highway package",
         "The EPC order lifts the company's order book to about 3.1x FY25 revenue."),
        ("2025-07-02", "Infra Dispatch (demo)", "litigation",
         "Arbitral tribunal awards ₹62 crore to Kaveri Infra in claim against state authority",
         "The authority is expected to challenge the award in the High Court."),
        ("2025-05-19", "Karnataka Finance Review (demo)", "news",
         "Delayed government payments stretch working capital at mid-size EPC contractors",
         "Kaveri Infra's receivable days are estimated at over 150 as of March 2025."),
        ("2025-01-27", "Rating Desk India (demo)", "news",
         "Kaveri Infra rating placed on watch with developing implications",
         "Agency cites large arbitration receivables and concentration in state-government contracts."),
    ],
    "orion pharmachem": [
        ("2025-08-29", "Pharma Pulse (demo)", "news",
         "Orion Pharmachem receives USFDA EIR for Hyderabad API unit",
         "The establishment inspection report closes the inspection with no Form 483 observations."),
        ("2025-06-10", "Pharma Pulse (demo)", "news",
         "Orion Pharmachem to invest ₹180 crore in PLI-backed fermentation capacity",
         "The project qualifies under the government's production-linked incentive scheme for bulk drugs."),
        ("2025-03-03", "Rating Desk India (demo)", "news",
         "Orion Pharmachem upgraded to AA-/Stable on strong cash flows",
         "Net debt to EBITDA is below 1x and return ratios have improved."),
    ],
}


def _key(company_name: str) -> str | None:
    low = company_name.lower()
    return next((k for k in _DEMO if k in low), None)


def has_demo_intel(company_name: str) -> bool:
    return _key(company_name) is not None


def demo_articles(company_name: str) -> list[tuple[Article, str]]:
    key = _key(company_name)
    if not key:
        return []
    return [
        (Article(title, snippet, None, source, f"{date}T09:00:00+00:00", "demo_intel", f'"{company_name}"'), hint)
        for date, source, hint, title, snippet in _DEMO[key]
    ]
