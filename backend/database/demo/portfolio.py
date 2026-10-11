"""Demo portfolio — five FICTIONAL Indian borrowers spanning the risk spectrum.

All names, identifiers, people and events are invented. Amounts are in ₹ crore unless noted.
Each borrower is designed to exercise a different part of the platform:

  Sunline Processors    clean, growing food processor                  -> APPROVE
  Orion Pharmachem      large, low-leverage API maker                  -> APPROVE
  Kaveri Infra Projects EPC contractor, long receivables, arbitration  -> APPROVE WITH CONDITIONS / REFER
  Aarav Textiles        weak-sector exporter at 45% capacity           -> REFER
  Nebula Components     GST mismatch, circular trading, NCLT notice    -> DECLINE (fraud-graph showcase)
"""

from __future__ import annotations

from typing import Any

from utils.india import make_gstin

CR = 1e7


def _fy(rev, ebitda, dep, intr, pat, lt, st, cpltd, nw, ca, cl, rec, inv, pay, cash, ocf, ta) -> dict[str, float]:
    return {"revenue": rev, "ebitda": ebitda, "depreciation": dep, "interest_expense": intr, "pat": pat,
            "long_term_debt": lt, "short_term_debt": st, "current_portion_ltd": cpltd, "total_debt": lt + st + cpltd,
            "net_worth": nw, "current_assets": ca, "current_liabilities": cl, "receivables": rec, "inventory": inv,
            "payables": pay, "cash": cash, "operating_cash_flow": ocf, "total_assets": ta}


PORTFOLIO: list[dict[str, Any]] = [
    {
        "key": "sunline",
        "company": {
            "name": "Sunline Processors Limited", "cin": "L15400GJ2004PLC044321", "pan": "AAKCS4821M", "state_code": "24",
            "sector": "food_processing", "sub_sector": "Dehydrated vegetables & spices", "constitution": "Public Limited (Listed)",
            "incorporation_year": 2004, "city": "Rajkot", "state": "Gujarat", "external_rating": "A-/Stable (demo agency)",
            "promoters": [{"name": "Harish Patel", "din": "00481236", "role": "Managing Director", "shareholding_pct": 41.5},
                          {"name": "Kavita Patel", "din": "00481237", "role": "Whole-time Director", "shareholding_pct": 26.5}],
            "address": "Plot 14, GIDC Metoda, Rajkot 360021",
        },
        "case": {"facility_type": "Term Loan", "requested_amount": 40 * CR, "tenure_months": 72,
                 "purpose": "Capex for cold-chain warehouse and dehydration line (30% capacity addition)",
                 "collateral_type": "Equitable mortgage of factory land & building, Metoda; hypothecation of plant", "collateral_value": 68 * CR},
        "financials": {
            "FY25": _fy(242.0, 33.9, 6.0, 5.2, 16.5, 52.0, 20.0, 6.0, 165.0, 118.0, 74.0, 38.0, 41.0, 22.0, 9.0, 27.0, 270.0),
            "FY24": _fy(214.0, 29.1, 5.6, 5.5, 13.6, 56.0, 23.0, 6.0, 149.0, 104.0, 70.0, 37.0, 36.0, 20.0, 7.0, 22.0, 248.0),
            "FY23": _fy(191.0, 25.2, 5.3, 5.9, 10.9, 60.0, 25.0, 6.0, 136.0, 95.0, 68.0, 35.0, 33.0, 19.0, 5.5, 18.0, 233.0),
        },
        "gst": {"GSTR-1": 241.6, "GSTR-3B": 242.0, "GSTR-2A": 239.1, "itc": 18.4, "tax": 29.0, "filed_on": "18-04-2025", "due": "20-04-2025"},
        "bank": {"bank": "State Bank of India", "account": "60218842281", "monthly_credit": 23.8, "volatility": 0.06, "bounces": 0, "opening": 3.4,
                 "customers": ["Agro Fresh Exports", "Gulf Retail Trading", "Spice Route Foods"], "suppliers": ["Saurashtra Farmers Producer Co", "Kisan Agri Inputs"]},
        "shareholding": {"promoter": 68.0, "pledged": 0.0, "public": 32.0},
        "legal": [],
        "sanction": {"lender": "State Bank of India", "facilities": [("Cash Credit", 20.0), ("Term Loan", 58.0)], "rate": 9.65},
        "red_flag_text": [],
        "positive_text": ["Management reported a strong order book and improved collections in Q4.",
                          "No adverse audit qualification was reported; the auditor issued an unmodified opinion.",
                          "The company reduced working capital borrowings and maintained adequate liquidity.",
                          "Promoter contribution remained stable with no increase in pledge."],
        "notes": [
            {"category": "site_visit", "body": "Site visit satisfactory: plant well maintained, both dehydration lines running near 85% capacity utilisation."},
            {"category": "collateral", "body": "Collateral verified — clear and marketable title per legal scrutiny report; valuation ₹68 crore."},
        ],
        "network": {"entities": [{"name": "Agro Fresh Exports", "pan": "AAFCA1234K", "directors": [{"name": "Rohit Shah", "din": "07812001"}]},
                                 {"name": "Kisan Agri Inputs", "pan": "AAFCK5521L", "directors": [{"name": "Mahesh Dave", "din": "07812002"}]}],
                    "transactions": []},
    },
    {
        "key": "orion",
        "company": {
            "name": "Orion Pharmachem Limited", "cin": "L24230TG1998PLC029874", "pan": "AABCO7712Q", "state_code": "36",
            "sector": "pharmaceuticals", "sub_sector": "Active pharmaceutical ingredients", "constitution": "Public Limited (Listed)",
            "incorporation_year": 1998, "city": "Hyderabad", "state": "Telangana", "external_rating": "AA-/Stable (demo agency)",
            "promoters": [{"name": "Srinivas Reddy", "din": "00112233", "role": "Chairman & MD", "shareholding_pct": 38.0},
                          {"name": "Lakshmi Reddy", "din": "00112234", "role": "Director", "shareholding_pct": 14.0}],
            "address": "Survey No. 42, IDA Bollaram, Sangareddy 502325",
        },
        "case": {"facility_type": "Term Loan", "requested_amount": 60 * CR, "tenure_months": 84,
                 "purpose": "PLI-backed fermentation capacity for key starting materials",
                 "collateral_type": "First pari-passu charge on fixed assets of Bollaram unit", "collateral_value": 95 * CR},
        "financials": {
            "FY25": _fy(412.0, 98.9, 18.0, 6.5, 52.0, 55.0, 22.0, 8.0, 390.0, 260.0, 140.0, 88.0, 95.0, 61.0, 34.0, 81.0, 560.0),
            "FY24": _fy(361.0, 82.3, 16.5, 7.1, 41.8, 60.0, 25.0, 8.0, 342.0, 231.0, 129.0, 81.0, 86.0, 55.0, 27.0, 66.0, 505.0),
            "FY23": _fy(318.0, 70.0, 15.2, 7.6, 34.5, 66.0, 26.0, 8.0, 303.0, 205.0, 121.0, 74.0, 79.0, 50.0, 22.0, 55.0, 461.0),
        },
        "gst": {"GSTR-1": 411.2, "GSTR-3B": 412.0, "GSTR-2A": 408.9, "itc": 31.2, "tax": 44.6, "filed_on": "17-04-2025", "due": "20-04-2025"},
        "bank": {"bank": "HDFC Bank", "account": "50200011987654", "monthly_credit": 40.5, "volatility": 0.07, "bounces": 0, "opening": 22.0,
                 "customers": ["Medilife Formulations", "Global Generics Inc"], "suppliers": ["Deccan Chemicals", "Andhra Solvents"]},
        "shareholding": {"promoter": 52.0, "pledged": 0.0, "public": 48.0},
        "legal": [],
        "sanction": {"lender": "HDFC Bank", "facilities": [("Term Loan", 70.0), ("Cash Credit", 30.0)], "rate": 9.1},
        "red_flag_text": [],
        "positive_text": ["The company received an establishment inspection report from USFDA with no Form 483 observations.",
                          "The auditor issued an unmodified opinion on the financial statements.",
                          "Rating upgraded to AA-/Stable on strong cash flows; adequate liquidity maintained."],
        "notes": [{"category": "management", "body": "Experienced promoter with three decades in API manufacturing; second-generation CFO with strong controls."}],
        "network": {"entities": [], "transactions": []},
    },
    {
        "key": "kaveri",
        "company": {
            "name": "Kaveri Infra Projects Limited", "cin": "U45200KA2006PLC038812", "pan": "AAECK3390R", "state_code": "29",
            "sector": "infrastructure_epc", "sub_sector": "Roads & highways EPC", "constitution": "Public Limited (Unlisted)",
            "incorporation_year": 2006, "city": "Bengaluru", "state": "Karnataka", "external_rating": "BBB/Watch Developing (demo agency)",
            "promoters": [{"name": "Venkatesh Gowda", "din": "01455672", "role": "Managing Director", "shareholding_pct": 58.0},
                          {"name": "Prakash Rao", "din": "01455673", "role": "Director", "shareholding_pct": 12.0}],
            "address": "No. 88, 4th Cross, Jayanagar, Bengaluru 560011",
        },
        "case": {"facility_type": "Cash Credit", "requested_amount": 20 * CR, "tenure_months": 12,
                 "purpose": "Working-capital enhancement for ₹420 crore state highway order",
                 "collateral_type": "Hypothecation of current assets; collateral of commercial property, Jayanagar", "collateral_value": 16 * CR},
        "financials": {
            "FY25": _fy(138.0, 17.9, 4.2, 7.1, 4.8, 28.0, 34.0, 6.0, 58.0, 121.0, 96.0, 61.0, 22.0, 38.0, 4.0, 3.5, 182.0),
            "FY24": _fy(121.0, 15.1, 4.0, 6.6, 3.9, 32.0, 29.0, 7.0, 53.0, 104.0, 84.0, 50.0, 19.0, 33.0, 3.2, 5.2, 165.0),
            "FY23": _fy(108.0, 13.4, 3.8, 6.0, 3.2, 33.0, 25.0, 7.0, 49.0, 92.0, 76.0, 43.0, 17.0, 30.0, 2.9, 6.0, 150.0),
        },
        "gst": {"GSTR-1": 137.1, "GSTR-3B": 138.0, "GSTR-2A": 135.4, "itc": 11.9, "tax": 13.1, "filed_on": "25-04-2025", "due": "20-04-2025"},
        "bank": {"bank": "Canara Bank", "account": "0412201009876", "monthly_credit": 13.4, "volatility": 0.38, "bounces": 0, "opening": 2.1,
                 "customers": ["Karnataka State Highways Authority", "Mysuru Smart City Ltd"], "suppliers": ["Deccan Aggregates", "Sri Sai Bitumen"]},
        "shareholding": {"promoter": 70.0, "pledged": 18.0, "public": 30.0},
        "legal": [{"title": "NOTICE INVOKING ARBITRATION", "body": [
            "Claimant: Kaveri Infra Projects Limited. Respondent: State highway authority (demo).",
            "The claimant invokes arbitration under clause 26 of the EPC agreement for a claim of INR 62 crore towards cost overruns and idle charges.",
            "An arbitral tribunal has been constituted; the award, if passed, may be challenged before the High Court.",
        ]}],
        "sanction": {"lender": "Canara Bank", "facilities": [("Cash Credit", 25.0), ("Bank Guarantee", 40.0)], "rate": 10.4},
        "red_flag_text": ["Receivables from government authorities remained overdue for more than 150 days.",
                          "Contingent liabilities on account of bank guarantees stood at INR 38 crore."],
        "positive_text": ["The order book stood at INR 430 crore, providing strong revenue visibility."],
        "notes": [{"category": "operations", "body": "Order book of ₹430 crore with state highway authority gives visibility; collections delayed but no write-offs."},
                  {"category": "financial", "body": "Delayed stock statements submission for two quarters; reminded borrower."}],
        "network": {"entities": [], "transactions": []},
    },
    {
        "key": "aarav",
        "company": {
            "name": "Aarav Textiles Private Limited", "cin": "U17110TZ2008PTC014562", "pan": "AAICA6684P", "state_code": "33",
            "sector": "textiles", "sub_sector": "Cotton knitwear exports", "constitution": "Private Limited",
            "incorporation_year": 2008, "city": "Tiruppur", "state": "Tamil Nadu", "external_rating": "BB+/Stable (demo agency)",
            "promoters": [{"name": "Meena Aravind", "din": "02566781", "role": "Managing Director", "shareholding_pct": 64.0},
                          {"name": "Aravind Kumar", "din": "02566782", "role": "Director", "shareholding_pct": 36.0}],
            "address": "SF No. 210, Avinashi Road, Tiruppur 641603",
        },
        "case": {"facility_type": "Term Loan", "requested_amount": 12 * CR, "tenure_months": 60,
                 "purpose": "Rooftop solar and compacting machinery to cut conversion costs",
                 "collateral_type": "Mortgage of factory at Avinashi; personal guarantee of promoters", "collateral_value": 15 * CR},
        "financials": {
            "FY25": _fy(96.0, 9.1, 3.1, 3.6, 1.8, 22.0, 15.0, 4.0, 33.0, 48.0, 41.0, 31.0, 18.0, 12.0, 1.5, 2.9, 96.0),
            "FY24": _fy(104.0, 11.8, 3.0, 3.3, 3.9, 21.0, 13.0, 4.0, 31.5, 46.0, 36.0, 27.0, 17.0, 11.0, 2.0, 6.1, 92.0),
            "FY23": _fy(98.0, 11.2, 2.8, 3.0, 3.7, 20.0, 12.0, 3.0, 27.6, 43.0, 33.0, 25.0, 16.0, 10.0, 2.2, 5.8, 85.0),
        },
        "gst": {"GSTR-1": 95.2, "GSTR-3B": 96.0, "GSTR-2A": 93.5, "itc": 6.1, "tax": 3.9, "filed_on": "22-04-2025", "due": "20-04-2025"},
        "bank": {"bank": "Indian Bank", "account": "6789012345", "monthly_credit": 9.1, "volatility": 0.29, "bounces": 1, "opening": 0.9,
                 "customers": ["Northwind Apparel Inc", "Euro Kids Wear GmbH"], "suppliers": ["Coimbatore Spinning Mills", "Kongu Dyeing Works"]},
        "shareholding": {"promoter": 100.0, "pledged": 0.0, "public": 0.0},
        "legal": [{"title": "NOTICE FROM LABOUR COURT, TIRUPPUR", "body": [
            "In the matter of industrial dispute raised by Aarav Textiles Workers' Union versus Aarav Textiles Private Limited.",
            "The union seeks revision of piece rates and arrears of INR 0.6 crore. The matter is listed for hearing next quarter.",
        ]}],
        "sanction": None,
        "red_flag_text": ["Margin compression was observed on account of soft export realisations.",
                          "Capacity utilisation declined to 45% in H2 FY25 as US buyers deferred orders."],
        "positive_text": ["The auditor issued an unmodified opinion on the financial statements."],
        "notes": [{"category": "site_visit", "body": "Factory operating at 45% capacity during site visit; 6 of 14 knitting machines idle due to soft US orders."},
                  {"category": "management", "body": "Promoter infused ₹3 crore equity in Q1 FY26 to support working capital."}],
        "network": {"entities": [], "transactions": []},
    },
    {
        "key": "nebula",
        "company": {
            "name": "Nebula Components Private Limited", "cin": "U34300MH2011PTC219876", "pan": "AAGCN2290H", "state_code": "27",
            "sector": "auto_components", "sub_sector": "Sheet-metal pressings for two-wheelers", "constitution": "Private Limited",
            "incorporation_year": 2011, "city": "Pune", "state": "Maharashtra", "external_rating": "BB/Negative (demo agency)",
            "promoters": [{"name": "Rakesh Malhotra", "din": "03344556", "role": "Managing Director", "shareholding_pct": 72.0},
                          {"name": "Sunil Joshi", "din": "03344557", "role": "Director", "shareholding_pct": 28.0}],
            "address": "Gat No. 312, Chakan MIDC Phase II, Pune 410501",
        },
        "case": {"facility_type": "Cash Credit", "requested_amount": 25 * CR, "tenure_months": 12,
                 "purpose": "Enhancement of working-capital limits",
                 "collateral_type": "Second charge on factory land & building, Chakan", "collateral_value": 18 * CR},
        "financials": {
            "FY25": _fy(186.0, 12.1, 5.5, 9.8, -3.4, 48.0, 52.0, 12.0, 38.0, 82.0, 91.0, 64.0, 30.0, 41.0, 1.2, -6.0, 176.0),
            "FY24": _fy(192.0, 19.2, 5.2, 8.1, 3.8, 50.0, 41.0, 10.0, 41.4, 79.0, 78.0, 52.0, 28.0, 35.0, 2.8, 4.4, 170.0),
            "FY23": _fy(171.0, 18.8, 4.9, 7.0, 4.6, 46.0, 33.0, 9.0, 37.6, 70.0, 66.0, 41.0, 26.0, 30.0, 3.1, 7.9, 152.0),
        },
        "gst": {"GSTR-1": 184.0, "GSTR-3B": 186.0, "GSTR-2A": 171.0, "itc": 21.7, "tax": 9.4, "filed_on": "28-06-2025", "due": "20-04-2025"},
        "bank": {"bank": "Bank of Baroda", "account": "33440200004419", "monthly_credit": 10.9, "volatility": 0.55, "bounces": 3, "opening": 1.8,
                 "customers": ["Apex Auto Traders", "Zenith Distributors", "Bharat Two Wheelers"], "suppliers": ["Orbit Steel Supplies", "Pune Coil Centre"]},
        "shareholding": {"promoter": 100.0, "pledged": 62.0, "public": 0.0},
        "legal": [
            {"title": "LEGAL NOTICE — DEMAND NOTICE UNDER SECTION 8 OF THE INSOLVENCY AND BANKRUPTCY CODE, 2016", "body": [
                "Operational creditor: Western Steel Rolling Mills (demo). Corporate debtor: Nebula Components Private Limited.",
                "The operational creditor alleges an overdue outstanding of INR 4.7 crore against supplies of cold-rolled coils.",
                "If unpaid within ten days, the creditor intends to file an application before NCLT Mumbai under Section 9.",
            ]},
            {"title": "COMPLAINT UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT", "body": [
                "Complainant: Swift Logistics (demo). Accused: Nebula Components Private Limited and its directors.",
                "Cheque No. 004512 for INR 38 lakh was dishonoured with the remark 'funds insufficient'.",
                "The complaint is pending before the Judicial Magistrate First Class, Pune.",
            ]},
        ],
        "sanction": {"lender": "Bank of Baroda", "facilities": [("Cash Credit", 35.0), ("Term Loan", 48.0)], "rate": 11.2},
        "red_flag_text": [
            "Working capital remained stretched in Q4 and liquidity pressure increased because receivables remained overdue for more than 90 days.",
            "The company disclosed related party purchases from promoter-linked group companies.",
            "Management is evaluating restructuring of unsecured promoter support.",
            "The credit rating outlook was revised to negative after margin compression.",
            "The auditor's report included an emphasis of matter regarding going concern assumptions.",
        ],
        "gst_note": ["Mismatch observed between GSTR-2A and GSTR-3B for Q4 FY25.",
                     "The review team flagged possible revenue inflation and circular trading patterns in two distributor accounts.",
                     "Input tax credit claim requires additional validation."],
        "positive_text": [],
        "notes": [
            {"category": "site_visit", "body": "Factory operating at 40% capacity during site visit; two of five press lines idle."},
            {"category": "management", "body": "Promoter was evasive on related-party sales to Zenith Distributors and could not explain the round-value invoices."},
        ],
        # GSTN invoice network / MCA registry enrichment (fictional): designed to contain a 3-entity
        # circular-trading loop, a shared director, shared PAN/address and a pass-through shell.
        "network": {
            "source": "GSTN e-invoice network + MCA registry (demo fixture)",
            "entities": [
                {"name": "Zenith Distributors Private Limited", "pan": "AAJCZ4410B", "gstin": None, "address": "Office 9, Kalpataru Plaza, Pune 411001",
                 "incorporated": "2019", "directors": [{"name": "Rakesh Malhotra", "din": "03344556"}, {"name": "Neha Kulkarni", "din": "08899001"}]},
                {"name": "Apex Auto Traders", "pan": "AAJCZ4410B", "address": "Office 9, Kalpataru Plaza, Pune 411001", "incorporated": "2020",
                 "directors": [{"name": "Neha Kulkarni", "din": "08899001"}]},
                {"name": "Orbit Steel Supplies", "pan": "AAKCO7781C", "address": "Shop 3, Bhosari, Pune 411026", "incorporated": "2024",
                 "gst_status": "cancelled", "employees": 2, "directors": [{"name": "Imran Sheikh", "din": "09912345"}]},
                {"name": "Bharat Two Wheelers", "pan": "AAACB1111D", "incorporated": "1985", "employees": 4200, "directors": []},
            ],
            "transactions": [
                # Goods loop: Nebula -> Zenith -> Apex -> Nebula (same stock re-invoiced round the ring)
                {"from": "Nebula Components Private Limited", "to": "Zenith Distributors Private Limited", "kind": "invoice", "amount": 38 * CR, "count": 42, "ref": "INV-N-Z"},
                {"from": "Zenith Distributors Private Limited", "to": "Apex Auto Traders", "kind": "invoice", "amount": 36.5 * CR, "count": 39, "ref": "INV-Z-A"},
                {"from": "Apex Auto Traders", "to": "Nebula Components Private Limited", "kind": "invoice", "amount": 35 * CR, "count": 37, "ref": "INV-A-N"},
                # Money loop runs the other way round the same ring
                {"from": "Zenith Distributors Private Limited", "to": "Nebula Components Private Limited", "kind": "payment", "amount": 30.4 * CR, "count": 28, "ref": "PAY-Z-N"},
                {"from": "Apex Auto Traders", "to": "Zenith Distributors Private Limited", "kind": "payment", "amount": 29.8 * CR, "count": 27, "ref": "PAY-A-Z"},
                {"from": "Nebula Components Private Limited", "to": "Apex Auto Traders", "kind": "payment", "amount": 28.9 * CR, "count": 25, "ref": "PAY-N-A"},
                # Orbit: newly incorporated, GST-cancelled conduit forwarding Nebula's money to Zenith
                {"from": "Nebula Components Private Limited", "to": "Orbit Steel Supplies", "kind": "payment", "amount": 12 * CR, "count": 10, "ref": "PAY-N-O"},
                {"from": "Orbit Steel Supplies", "to": "Zenith Distributors Private Limited", "kind": "payment", "amount": 11.6 * CR, "count": 9, "ref": "PAY-O-Z"},
                {"from": "Orbit Steel Supplies", "to": "Nebula Components Private Limited", "kind": "invoice", "amount": 14 * CR, "count": 14, "ref": "INV-O-N"},
                {"from": "Bharat Two Wheelers", "to": "Nebula Components Private Limited", "kind": "payment", "amount": 61 * CR, "count": 48, "ref": "PAY-B-N"},
                {"from": "Nebula Components Private Limited", "to": "Bharat Two Wheelers", "kind": "invoice", "amount": 63 * CR, "count": 51, "ref": "INV-N-B"},
            ],
        },
    },
]


def gstin_for(spec: dict[str, Any]) -> str:
    c = spec["company"]
    return make_gstin(c["state_code"], c["pan"])
