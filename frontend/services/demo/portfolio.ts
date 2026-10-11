// Demo portfolio — five FICTIONAL Indian borrowers mirrored from backend/database/demo/portfolio.py.
// All names, identifiers, people and events are invented. Financial amounts are in ₹ crore.

export const CR = 1e7;

export interface FyCr {
  revenue: number; ebitda: number; depreciation: number; interest_expense: number; pat: number;
  long_term_debt: number; short_term_debt: number; current_portion_ltd: number; net_worth: number;
  current_assets: number; current_liabilities: number; receivables: number; inventory: number;
  payables: number; cash: number; operating_cash_flow: number; total_assets: number;
}

const fy = (...v: number[]): FyCr => {
  const k = ["revenue", "ebitda", "depreciation", "interest_expense", "pat", "long_term_debt", "short_term_debt", "current_portion_ltd",
    "net_worth", "current_assets", "current_liabilities", "receivables", "inventory", "payables", "cash", "operating_cash_flow", "total_assets"] as const;
  return Object.fromEntries(k.map((key, i) => [key, v[i]])) as unknown as FyCr;
};

export interface DemoFinding {
  category: "news" | "litigation" | "regulatory" | "mca" | "fraud" | "sector";
  title: string; snippet: string; source: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; sentiment: number; daysAgo: number;
}

export interface DemoBorrower {
  key: string;
  reference: string;
  status: "in_review" | "approved" | "escalated" | "analyzing" | "draft";
  priority: "HIGH" | "NORMAL";
  updatedHoursAgo: number;
  company: {
    name: string; cin: string; pan: string; gstin: string; sector: string; sub_sector: string; constitution: string;
    incorporation_year: number; city: string; state: string; external_rating: string; website: string | null;
    promoters: { name: string; din: string; role: string; shareholding_pct: number }[];
  };
  facility: { facility_type: string; requested: number; tenure_months: number; purpose: string; collateral_type: string; collateral_value: number };
  financials: Record<string, FyCr>;
  gst: { gstr1: number; gstr3b: number; gstr2a: number; itc: number; tax: number; daysLate: number };
  bank: { bank: string; account: string; monthlyCredit: number; volatility: number; bounces: number; customers: string[]; suppliers: string[] };
  shareholding: { promoter: number; pledged: number; public: number };
  sector: { name: string; risk: number; outlook: "STRONG" | "STABLE" | "WEAK"; headwinds: string[]; tailwinds: string[]; rbi: string[]; benchmarkMargin: number };
  litigation: { title: string; forum: string; claim: number | null; status: string; types: string[]; borrowerIsClaimant?: boolean }[];
  research: { litigation: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE"; overall: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; summary: string; findings: DemoFinding[] };
  redFlags: { label: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; five_c: string; evidence: string; file: string }[];
  positives: string[];
  notes: { category: string; body: string; impact: number; five_c: string; rationale: string; author: string; daysAgo: number }[];
  fraudScore: number;
  network?: {
    entities: { id: string; label: string; type: "company" | "person"; risk: number; flagged: boolean; meta: Record<string, string> }[];
    links: { source: string; target: string; type: "PAYS" | "INVOICES" | "DIRECTOR_OF"; amount: number | null; count: number | null; flagged: boolean }[];
  };
  fraudAlerts: { type: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; title: string; description: string; entities: string[]; impact: number }[];
}

export const PORTFOLIO: DemoBorrower[] = [
  {
    key: "sunline",
    reference: "CX-2026-0001",
    status: "approved",
    priority: "NORMAL",
    updatedHoursAgo: 5,
    company: {
      name: "Sunline Processors Limited", cin: "L15400GJ2004PLC044321", pan: "AAKCS4821M", gstin: "24AAKCS4821M1ZQ",
      sector: "food_processing", sub_sector: "Dehydrated vegetables & spices", constitution: "Public Limited (Listed)",
      incorporation_year: 2004, city: "Rajkot", state: "Gujarat", external_rating: "A-/Stable (demo agency)", website: null,
      promoters: [
        { name: "Harish Patel", din: "00481236", role: "Managing Director", shareholding_pct: 41.5 },
        { name: "Kavita Patel", din: "00481237", role: "Whole-time Director", shareholding_pct: 26.5 },
      ],
    },
    facility: {
      facility_type: "Term Loan", requested: 40 * CR, tenure_months: 72,
      purpose: "Capex for cold-chain warehouse and dehydration line (30% capacity addition)",
      collateral_type: "Equitable mortgage of factory land & building, Metoda; hypothecation of plant", collateral_value: 68 * CR,
    },
    financials: {
      FY25: fy(242.0, 33.9, 6.0, 5.2, 16.5, 52.0, 20.0, 6.0, 165.0, 118.0, 74.0, 38.0, 41.0, 22.0, 9.0, 27.0, 270.0),
      FY24: fy(214.0, 29.1, 5.6, 5.5, 13.6, 56.0, 23.0, 6.0, 149.0, 104.0, 70.0, 37.0, 36.0, 20.0, 7.0, 22.0, 248.0),
      FY23: fy(191.0, 25.2, 5.3, 5.9, 10.9, 60.0, 25.0, 6.0, 136.0, 95.0, 68.0, 35.0, 33.0, 19.0, 5.5, 18.0, 233.0),
    },
    gst: { gstr1: 241.6, gstr3b: 242.0, gstr2a: 239.1, itc: 18.4, tax: 29.0, daysLate: 0 },
    bank: { bank: "State Bank of India", account: "XXXX2281", monthlyCredit: 23.8, volatility: 0.06, bounces: 0,
      customers: ["Agro Fresh Exports", "Gulf Retail Trading", "Spice Route Foods"], suppliers: ["Saurashtra Farmers Producer Co", "Kisan Agri Inputs"] },
    shareholding: { promoter: 68, pledged: 0, public: 32 },
    sector: {
      name: "Food Processing", risk: 38, outlook: "STRONG",
      headwinds: ["Monsoon-linked raw material price swings", "Export demand sensitivity to Gulf retail cycles"],
      tailwinds: ["PLI scheme for food processing", "Rising organised retail & export demand for dehydrated foods"],
      rbi: ["Food processing qualifies as Priority Sector (agri-allied) under RBI master directions", "Warehouse receipt finance eligible against negotiable receipts"],
      benchmarkMargin: 0.12,
    },
    litigation: [],
    research: {
      litigation: "LOW", sentiment: "POSITIVE", overall: "LOW",
      summary: "Coverage is constructive: capacity expansion, a reaffirmed A- rating and growing export orders. No litigation, regulatory action or promoter controversy was found across news, court and MCA sources.",
      findings: [
        { category: "news", title: "Sunline Processors adds dehydration line as Gulf export orders grow", snippet: "Company expects 30% capacity addition to be utilised within 18 months on firm export orders.", source: "Demo Business Wire (fictional)", severity: "LOW", sentiment: 0.6, daysAgo: 21 },
        { category: "news", title: "Rating reaffirmed at A-/Stable on steady margins", snippet: "Agency cites improved collections and moderate leverage.", source: "Demo Ratings Desk (fictional)", severity: "LOW", sentiment: 0.5, daysAgo: 64 },
        { category: "sector", title: "Food processing PLI disbursements accelerate", snippet: "Government released the third tranche of incentives to approved units.", source: "Demo Policy Monitor (fictional)", severity: "LOW", sentiment: 0.4, daysAgo: 40 },
        { category: "mca", title: "MCA filings up to date; two open charges in favour of SBI", snippet: "No director disqualification; AGM held on time.", source: "MCA21 (demo fixture)", severity: "LOW", sentiment: 0.1, daysAgo: 9 },
      ],
    },
    redFlags: [],
    positives: ["Strong order book and improved Q4 collections", "Unmodified audit opinion", "Working-capital borrowings reduced", "No promoter pledge"],
    notes: [
      { category: "site_visit", body: "Site visit satisfactory: plant well maintained, both dehydration lines running near 85% capacity utilisation.", impact: 6, five_c: "capacity", rationale: "High utilisation and good upkeep support capacity.", author: "Ananya Rao", daysAgo: 3 },
      { category: "collateral", body: "Collateral verified — clear and marketable title per legal scrutiny report; valuation ₹68 crore.", impact: 4, five_c: "collateral", rationale: "Verified title and 1.7x cover.", author: "Ananya Rao", daysAgo: 2 },
    ],
    fraudScore: 8,
    fraudAlerts: [],
  },
  {
    key: "orion",
    reference: "CX-2026-0002",
    status: "in_review",
    priority: "NORMAL",
    updatedHoursAgo: 2,
    company: {
      name: "Orion Pharmachem Limited", cin: "L24230TG1998PLC029874", pan: "AABCO7712Q", gstin: "36AABCO7712Q1ZK",
      sector: "pharmaceuticals", sub_sector: "Active pharmaceutical ingredients", constitution: "Public Limited (Listed)",
      incorporation_year: 1998, city: "Hyderabad", state: "Telangana", external_rating: "AA-/Stable (demo agency)", website: null,
      promoters: [
        { name: "Srinivas Reddy", din: "00112233", role: "Chairman & MD", shareholding_pct: 38 },
        { name: "Lakshmi Reddy", din: "00112234", role: "Director", shareholding_pct: 14 },
      ],
    },
    facility: {
      facility_type: "Term Loan", requested: 60 * CR, tenure_months: 84, purpose: "PLI-backed fermentation capacity for key starting materials",
      collateral_type: "First pari-passu charge on fixed assets of Bollaram unit", collateral_value: 95 * CR,
    },
    financials: {
      FY25: fy(412.0, 98.9, 18.0, 6.5, 52.0, 55.0, 22.0, 8.0, 390.0, 260.0, 140.0, 88.0, 95.0, 61.0, 34.0, 81.0, 560.0),
      FY24: fy(361.0, 82.3, 16.5, 7.1, 41.8, 60.0, 25.0, 8.0, 342.0, 231.0, 129.0, 81.0, 86.0, 55.0, 27.0, 66.0, 505.0),
      FY23: fy(318.0, 70.0, 15.2, 7.6, 34.5, 66.0, 26.0, 8.0, 303.0, 205.0, 121.0, 74.0, 79.0, 50.0, 22.0, 55.0, 461.0),
    },
    gst: { gstr1: 411.2, gstr3b: 412.0, gstr2a: 408.9, itc: 31.2, tax: 44.6, daysLate: 0 },
    bank: { bank: "HDFC Bank", account: "XXXX7654", monthlyCredit: 40.5, volatility: 0.07, bounces: 0,
      customers: ["Medilife Formulations", "Global Generics Inc"], suppliers: ["Deccan Chemicals", "Andhra Solvents"] },
    shareholding: { promoter: 52, pledged: 0, public: 48 },
    sector: {
      name: "Pharmaceuticals", risk: 32, outlook: "STRONG",
      headwinds: ["USFDA inspection outcomes", "API import dependence and price controls (NLEM/DPCO)"],
      tailwinds: ["PLI for bulk drugs and KSMs", "China+1 sourcing shift by global generics majors"],
      rbi: ["No sector-specific prudential restrictions; standard asset provisioning applies"],
      benchmarkMargin: 0.2,
    },
    litigation: [],
    research: {
      litigation: "LOW", sentiment: "POSITIVE", overall: "LOW",
      summary: "Orion has a clean regulatory record (USFDA EIR with zero observations), a recent rating upgrade and PLI approval for the proposed capacity. No adverse media or litigation was found.",
      findings: [
        { category: "regulatory", title: "Orion Pharmachem receives USFDA EIR with zero Form 483 observations", snippet: "Bollaram API facility cleared after a five-day inspection.", source: "Demo Pharma Pulse (fictional)", severity: "LOW", sentiment: 0.7, daysAgo: 33 },
        { category: "news", title: "Rating upgraded to AA-/Stable on strong cash flows", snippet: "Upgrade reflects 19% revenue growth and net-debt-light balance sheet.", source: "Demo Ratings Desk (fictional)", severity: "LOW", sentiment: 0.6, daysAgo: 58 },
        { category: "news", title: "Orion approved under PLI scheme for fermentation-based KSMs", snippet: "Six-year incentives support the ₹60 crore capacity plan.", source: "Demo Policy Wire (fictional)", severity: "LOW", sentiment: 0.5, daysAgo: 90 },
      ],
    },
    redFlags: [],
    positives: ["USFDA EIR with no observations", "Rating upgraded to AA-/Stable", "Unmodified audit opinion"],
    notes: [
      { category: "management", body: "Experienced promoter with three decades in API manufacturing; second-generation CFO with strong controls.", impact: 5, five_c: "character", rationale: "Strong management depth.", author: "Vikram Iyer", daysAgo: 1 },
    ],
    fraudScore: 5,
    fraudAlerts: [],
  },
  {
    key: "kaveri",
    reference: "CX-2026-0003",
    status: "in_review",
    priority: "HIGH",
    updatedHoursAgo: 7,
    company: {
      name: "Kaveri Infra Projects Limited", cin: "U45200KA2006PLC038812", pan: "AAECK3390R", gstin: "29AAECK3390R1ZD",
      sector: "infrastructure_epc", sub_sector: "Roads & highways EPC", constitution: "Public Limited (Unlisted)",
      incorporation_year: 2006, city: "Bengaluru", state: "Karnataka", external_rating: "BBB/Watch Developing (demo agency)", website: null,
      promoters: [
        { name: "Venkatesh Gowda", din: "01455672", role: "Managing Director", shareholding_pct: 58 },
        { name: "Prakash Rao", din: "01455673", role: "Director", shareholding_pct: 12 },
      ],
    },
    facility: {
      facility_type: "Cash Credit", requested: 20 * CR, tenure_months: 12, purpose: "Working-capital enhancement for ₹420 crore state highway order",
      collateral_type: "Hypothecation of current assets; collateral of commercial property, Jayanagar", collateral_value: 16 * CR,
    },
    financials: {
      FY25: fy(138.0, 17.9, 4.2, 7.1, 4.8, 28.0, 34.0, 6.0, 58.0, 121.0, 96.0, 61.0, 22.0, 38.0, 4.0, 3.5, 182.0),
      FY24: fy(121.0, 15.1, 4.0, 6.6, 3.9, 32.0, 29.0, 7.0, 53.0, 104.0, 84.0, 50.0, 19.0, 33.0, 3.2, 5.2, 165.0),
      FY23: fy(108.0, 13.4, 3.8, 6.0, 3.2, 33.0, 25.0, 7.0, 49.0, 92.0, 76.0, 43.0, 17.0, 30.0, 2.9, 6.0, 150.0),
    },
    gst: { gstr1: 137.1, gstr3b: 138.0, gstr2a: 135.4, itc: 11.9, tax: 13.1, daysLate: 5 },
    bank: { bank: "Canara Bank", account: "XXXX9876", monthlyCredit: 13.4, volatility: 0.38, bounces: 0,
      customers: ["Karnataka State Highways Authority", "Mysuru Smart City Ltd"], suppliers: ["Deccan Aggregates", "Sri Sai Bitumen"] },
    shareholding: { promoter: 70, pledged: 18, public: 30 },
    sector: {
      name: "Infrastructure & EPC", risk: 55, outlook: "STABLE",
      headwinds: ["Government receivable delays", "Execution and cost-overrun risk on fixed-price contracts"],
      tailwinds: ["Sustained state & central capex on highways", "Healthy order inflow across mid-size EPC players"],
      rbi: ["RBI prudential framework for project finance (draft, May 2024): higher provisioning during construction", "DCCO deferment norms for infrastructure projects"],
      benchmarkMargin: 0.12,
    },
    litigation: [
      { title: "Arbitration against state highway authority for cost overruns", forum: "Arbitral tribunal", claim: 62 * CR, status: "Tribunal constituted", types: ["arbitration"], borrowerIsClaimant: true },
    ],
    research: {
      litigation: "MEDIUM", sentiment: "NEUTRAL", overall: "MEDIUM",
      summary: "Order visibility is strong (₹430 crore book), but receivables from state authorities are stretched beyond 150 days and an arbitration claim of ₹62 crore is pending. Promoter pledge of 18% warrants monitoring.",
      findings: [
        { category: "news", title: "Kaveri Infra bags ₹420 crore state highway EPC order", snippet: "Order book now covers ~3x trailing revenue.", source: "Demo Infra Daily (fictional)", severity: "LOW", sentiment: 0.5, daysAgo: 15 },
        { category: "litigation", title: "Kaveri Infra invokes arbitration over ₹62 crore cost-overrun claim", snippet: "Tribunal constituted; award may be challenged before the High Court.", source: "Demo Legal Tracker (fictional)", severity: "MEDIUM", sentiment: -0.2, daysAgo: 48 },
        { category: "sector", title: "Delayed state payments stretch working capital for mid-size EPC firms", snippet: "Receivable days rising as state budgets tighten.", source: "Demo Infra Daily (fictional)", severity: "MEDIUM", sentiment: -0.3, daysAgo: 27 },
        { category: "mca", title: "18% of promoter shareholding pledged", snippet: "Pledge created in favour of an NBFC in FY24.", source: "MCA21 (demo fixture)", severity: "MEDIUM", sentiment: -0.2, daysAgo: 12 },
      ],
    },
    redFlags: [
      { label: "Receivables overdue > 150 days", severity: "MEDIUM", five_c: "capacity", evidence: "Receivables from government authorities remained overdue for more than 150 days.", file: "Kaveri_AR_FY25.pdf" },
      { label: "Contingent liabilities ₹38 crore", severity: "LOW", five_c: "capital", evidence: "Contingent liabilities on account of bank guarantees stood at INR 38 crore.", file: "Kaveri_AR_FY25.pdf" },
    ],
    positives: ["Order book of ₹430 crore", "No write-offs on government receivables"],
    notes: [
      { category: "operations", body: "Order book of ₹430 crore with state highway authority gives visibility; collections delayed but no write-offs.", impact: 3, five_c: "capacity", rationale: "Revenue visibility partly offsets collection delays.", author: "Vikram Iyer", daysAgo: 4 },
      { category: "financial", body: "Delayed stock statements submission for two quarters; reminded borrower.", impact: -6, five_c: "character", rationale: "Weak MIS discipline.", author: "Vikram Iyer", daysAgo: 4 },
    ],
    fraudScore: 22,
    fraudAlerts: [
      { type: "receivable_concentration", severity: "MEDIUM", title: "78% of credits from two government counterparties", description: "High concentration on state agencies amplifies collection-delay risk.", entities: ["Karnataka State Highways Authority"], impact: 4 },
    ],
  },
  {
    key: "aarav",
    reference: "CX-2026-0004",
    status: "escalated",
    priority: "NORMAL",
    updatedHoursAgo: 26,
    company: {
      name: "Aarav Textiles Private Limited", cin: "U17110TZ2008PTC014562", pan: "AAICA6684P", gstin: "33AAICA6684P1Z2",
      sector: "textiles", sub_sector: "Cotton knitwear exports", constitution: "Private Limited",
      incorporation_year: 2008, city: "Tiruppur", state: "Tamil Nadu", external_rating: "BB+/Stable (demo agency)", website: null,
      promoters: [
        { name: "Meena Aravind", din: "02566781", role: "Managing Director", shareholding_pct: 64 },
        { name: "Aravind Kumar", din: "02566782", role: "Director", shareholding_pct: 36 },
      ],
    },
    facility: {
      facility_type: "Term Loan", requested: 12 * CR, tenure_months: 60, purpose: "Rooftop solar and compacting machinery to cut conversion costs",
      collateral_type: "Mortgage of factory at Avinashi; personal guarantee of promoters", collateral_value: 15 * CR,
    },
    financials: {
      FY25: fy(96.0, 9.1, 3.1, 3.6, 1.8, 22.0, 15.0, 4.0, 33.0, 48.0, 41.0, 31.0, 18.0, 12.0, 1.5, 2.9, 96.0),
      FY24: fy(104.0, 11.8, 3.0, 3.3, 3.9, 21.0, 13.0, 4.0, 31.5, 46.0, 36.0, 27.0, 17.0, 11.0, 2.0, 6.1, 92.0),
      FY23: fy(98.0, 11.2, 2.8, 3.0, 3.7, 20.0, 12.0, 3.0, 27.6, 43.0, 33.0, 25.0, 16.0, 10.0, 2.2, 5.8, 85.0),
    },
    gst: { gstr1: 95.2, gstr3b: 96.0, gstr2a: 93.5, itc: 6.1, tax: 3.9, daysLate: 2 },
    bank: { bank: "Indian Bank", account: "XXXX2345", monthlyCredit: 9.1, volatility: 0.29, bounces: 1,
      customers: ["Northwind Apparel Inc", "Euro Kids Wear GmbH"], suppliers: ["Coimbatore Spinning Mills", "Kongu Dyeing Works"] },
    shareholding: { promoter: 100, pledged: 0, public: 0 },
    sector: {
      name: "Textiles & Apparel", risk: 62, outlook: "WEAK",
      headwinds: ["Soft US/EU apparel demand and buyer order deferrals", "Cotton yarn price volatility", "Competition from Bangladesh and Vietnam"],
      tailwinds: ["PM MITRA parks and PLI for MMF/technical textiles", "India–UK FTA tariff relief (phased)"],
      rbi: ["MSME textile units eligible for Priority Sector Lending", "Check MSME restructuring history in CIC data"],
      benchmarkMargin: 0.1,
    },
    litigation: [
      { title: "Industrial dispute — Aarav Textiles Workers' Union", forum: "Labour Court, Tiruppur", claim: 0.6 * CR, status: "Listed for hearing", types: ["labour"] },
    ],
    research: {
      litigation: "LOW", sentiment: "NEUTRAL", overall: "MEDIUM",
      summary: "Export demand for Tiruppur knitwear remains soft; Aarav's revenue fell 8% with margins compressing to 9.5%. A minor labour dispute is pending. Promoter infused ₹3 crore equity, a mitigant.",
      findings: [
        { category: "sector", title: "Tiruppur knitwear exporters report 15–20% order deferrals from US buyers", snippet: "Cluster-wide capacity utilisation slips below 60%.", source: "Demo Textile Journal (fictional)", severity: "MEDIUM", sentiment: -0.5, daysAgo: 18 },
        { category: "litigation", title: "Labour court lists workers' union dispute against Aarav Textiles", snippet: "Union seeks piece-rate revision and ₹0.6 crore arrears.", source: "Demo Legal Tracker (fictional)", severity: "LOW", sentiment: -0.2, daysAgo: 35 },
        { category: "news", title: "Aarav Textiles promoter infuses ₹3 crore to support working capital", snippet: "Infusion via equity in Q1 FY26.", source: "Demo Business Wire (fictional)", severity: "LOW", sentiment: 0.4, daysAgo: 52 },
      ],
    },
    redFlags: [
      { label: "Capacity utilisation 45%", severity: "MEDIUM", five_c: "capacity", evidence: "Capacity utilisation declined to 45% in H2 FY25 as US buyers deferred orders.", file: "Aarav_AR_FY25.pdf" },
      { label: "Margin compression", severity: "MEDIUM", five_c: "capacity", evidence: "Margin compression was observed on account of soft export realisations.", file: "Aarav_AR_FY25.pdf" },
      { label: "One cheque return in 12 months", severity: "LOW", five_c: "character", evidence: "Inward cheque returned — insufficient funds (Aug-24).", file: "Aarav_Bank_Statement.pdf" },
    ],
    positives: ["Promoter equity infusion of ₹3 crore", "Unmodified audit opinion"],
    notes: [
      { category: "site_visit", body: "Factory operating at 45% capacity during site visit; 6 of 14 knitting machines idle due to soft US orders.", impact: -18, five_c: "capacity", rationale: "Low utilisation directly weakens repayment capacity.", author: "Ananya Rao", daysAgo: 6 },
      { category: "management", body: "Promoter infused ₹3 crore equity in Q1 FY26 to support working capital.", impact: 5, five_c: "capital", rationale: "Skin in the game improves capital cushion.", author: "Ananya Rao", daysAgo: 5 },
    ],
    fraudScore: 18,
    fraudAlerts: [
      { type: "filing_delay", severity: "LOW", title: "GSTR-3B filed 2 days late", description: "Minor delay; no pattern of late filing.", entities: [], impact: 2 },
    ],
  },
  {
    key: "nebula",
    reference: "CX-2026-0005",
    status: "escalated",
    priority: "HIGH",
    updatedHoursAgo: 1,
    company: {
      name: "Nebula Components Private Limited", cin: "U34300MH2011PTC219876", pan: "AAGCN2290H", gstin: "27AAGCN2290H1ZT",
      sector: "auto_components", sub_sector: "Sheet-metal pressings for two-wheelers", constitution: "Private Limited",
      incorporation_year: 2011, city: "Pune", state: "Maharashtra", external_rating: "BB/Negative (demo agency)", website: null,
      promoters: [
        { name: "Rakesh Malhotra", din: "03344556", role: "Managing Director", shareholding_pct: 72 },
        { name: "Sunil Joshi", din: "03344557", role: "Director", shareholding_pct: 28 },
      ],
    },
    facility: {
      facility_type: "Cash Credit", requested: 25 * CR, tenure_months: 12, purpose: "Enhancement of working-capital limits",
      collateral_type: "Second charge on factory land & building, Chakan", collateral_value: 18 * CR,
    },
    financials: {
      FY25: fy(186.0, 12.1, 5.5, 9.8, -3.4, 48.0, 52.0, 12.0, 38.0, 82.0, 91.0, 64.0, 30.0, 41.0, 1.2, -6.0, 176.0),
      FY24: fy(192.0, 19.2, 5.2, 8.1, 3.8, 50.0, 41.0, 10.0, 41.4, 79.0, 78.0, 52.0, 28.0, 35.0, 2.8, 4.4, 170.0),
      FY23: fy(171.0, 18.8, 4.9, 7.0, 4.6, 46.0, 33.0, 9.0, 37.6, 70.0, 66.0, 41.0, 26.0, 30.0, 3.1, 7.9, 152.0),
    },
    gst: { gstr1: 184.0, gstr3b: 186.0, gstr2a: 171.0, itc: 21.7, tax: 9.4, daysLate: 69 },
    bank: { bank: "Bank of Baroda", account: "XXXX4419", monthlyCredit: 10.9, volatility: 0.55, bounces: 3,
      customers: ["Apex Auto Traders", "Zenith Distributors", "Bharat Two Wheelers"], suppliers: ["Orbit Steel Supplies", "Pune Coil Centre"] },
    shareholding: { promoter: 100, pledged: 62, public: 0 },
    sector: {
      name: "Auto Components", risk: 45, outlook: "STABLE",
      headwinds: ["EV transition risk for ICE-dependent product lines", "OEM pricing pressure and customer concentration"],
      tailwinds: ["PLI scheme for auto components", "Two-wheeler volume recovery in rural markets"],
      rbi: ["Large exposure / customer-concentration checks under lender's internal policy"],
      benchmarkMargin: 0.11,
    },
    litigation: [
      { title: "IBC Section 8 demand notice — Western Steel Rolling Mills", forum: "NCLT Mumbai (threatened)", claim: 4.7 * CR, status: "Demand notice served", types: ["ibc", "operational_creditor"] },
      { title: "Section 138 NI Act complaint — Swift Logistics", forum: "JMFC, Pune", claim: 0.38 * CR, status: "Pending", types: ["cheque_dishonour"] },
    ],
    research: {
      litigation: "HIGH", sentiment: "NEGATIVE", overall: "CRITICAL",
      summary: "Multiple adverse signals converge: an IBC demand notice for ₹4.7 crore, a cheque-dishonour complaint, a negative rating outlook, a going-concern emphasis of matter and a GST probe into distributor billing. Promoter pledge stands at 62%.",
      findings: [
        { category: "litigation", title: "Operational creditor serves IBC demand notice on Nebula Components over ₹4.7 crore", snippet: "Creditor intends to approach NCLT Mumbai under Section 9 if unpaid.", source: "Demo Legal Tracker (fictional)", severity: "HIGH", sentiment: -0.7, daysAgo: 12 },
        { category: "fraud", title: "GST officials examine distributor billing linked to Nebula Components", snippet: "Authorities reviewing round-value invoices between Nebula and two distributors over suspected circular trading.", source: "Demo Tax Watch (fictional)", severity: "CRITICAL", sentiment: -0.8, daysAgo: 6 },
        { category: "news", title: "Rating outlook revised to negative on margin compression", snippet: "Agency flags stretched receivables and going-concern emphasis in audit report.", source: "Demo Ratings Desk (fictional)", severity: "HIGH", sentiment: -0.6, daysAgo: 40 },
        { category: "mca", title: "Promoter pledges 62% of shareholding", snippet: "Pledge increased from 28% to 62% within nine months.", source: "MCA21 (demo fixture)", severity: "HIGH", sentiment: -0.5, daysAgo: 70 },
        { category: "litigation", title: "Cheque-dishonour complaint filed by logistics vendor", snippet: "Cheque of ₹38 lakh returned for insufficient funds.", source: "Demo Legal Tracker (fictional)", severity: "MEDIUM", sentiment: -0.4, daysAgo: 25 },
      ],
    },
    redFlags: [
      { label: "Going-concern emphasis of matter", severity: "CRITICAL", five_c: "character", evidence: "The auditor's report included an emphasis of matter regarding going concern assumptions.", file: "Nebula_AR_FY25.pdf" },
      { label: "GSTR-2A vs 3B mismatch 8.1%", severity: "HIGH", five_c: "character", evidence: "Mismatch observed between GSTR-2A and GSTR-3B for Q4 FY25.", file: "Nebula_GSTR3B_FY25.pdf" },
      { label: "Circular trading cue in distributor accounts", severity: "CRITICAL", five_c: "character", evidence: "The review team flagged possible revenue inflation and circular trading patterns in two distributor accounts.", file: "Nebula_GSTR3B_FY25.pdf" },
      { label: "Receivables overdue > 90 days", severity: "HIGH", five_c: "capacity", evidence: "Liquidity pressure increased because receivables remained overdue for more than 90 days.", file: "Nebula_AR_FY25.pdf" },
      { label: "Related-party purchases", severity: "MEDIUM", five_c: "character", evidence: "The company disclosed related party purchases from promoter-linked group companies.", file: "Nebula_AR_FY25.pdf" },
      { label: "3 cheque returns in 6 months", severity: "HIGH", five_c: "character", evidence: "Outward cheque returned — funds insufficient (Jun-25).", file: "Nebula_Bank_Statement.pdf" },
    ],
    positives: [],
    notes: [
      { category: "site_visit", body: "Factory operating at 40% capacity during site visit; two of five press lines idle.", impact: -20, five_c: "capacity", rationale: "Severe under-utilisation.", author: "Ananya Rao", daysAgo: 2 },
      { category: "management", body: "Promoter was evasive on related-party sales to Zenith Distributors and could not explain the round-value invoices.", impact: -15, five_c: "character", rationale: "Evasive management on suspected related-party trades.", author: "Ananya Rao", daysAgo: 2 },
    ],
    fraudScore: 82,
    network: {
      entities: [
        { id: "zenith", label: "Zenith Distributors Pvt Ltd", type: "company", risk: 0.9, flagged: true, meta: { PAN: "AAJCZ4410B", Incorporated: "2019", Address: "Office 9, Kalpataru Plaza, Pune" } },
        { id: "apex", label: "Apex Auto Traders", type: "company", risk: 0.85, flagged: true, meta: { PAN: "AAJCZ4410B (shared with Zenith)", Incorporated: "2020", Address: "Office 9, Kalpataru Plaza, Pune" } },
        { id: "orbit", label: "Orbit Steel Supplies", type: "company", risk: 0.8, flagged: true, meta: { GST: "Cancelled", Incorporated: "2024", Employees: "2" } },
        { id: "bharat", label: "Bharat Two Wheelers", type: "company", risk: 0.05, flagged: false, meta: { Incorporated: "1985", Employees: "4,200" } },
        { id: "pune_coil", label: "Pune Coil Centre", type: "company", risk: 0.1, flagged: false, meta: { Incorporated: "2002" } },
        { id: "rakesh", label: "Rakesh Malhotra", type: "person", risk: 0.75, flagged: true, meta: { DIN: "03344556", Role: "MD, Nebula · Director, Zenith" } },
        { id: "sunil", label: "Sunil Joshi", type: "person", risk: 0.1, flagged: false, meta: { DIN: "03344557", Role: "Director, Nebula" } },
        { id: "neha", label: "Neha Kulkarni", type: "person", risk: 0.6, flagged: true, meta: { DIN: "08899001", Role: "Director, Zenith & Apex" } },
        { id: "imran", label: "Imran Sheikh", type: "person", risk: 0.4, flagged: false, meta: { DIN: "09912345", Role: "Director, Orbit" } },
      ],
      links: [
        { source: "borrower", target: "zenith", type: "INVOICES", amount: 38 * CR, count: 42, flagged: true },
        { source: "zenith", target: "apex", type: "INVOICES", amount: 36.5 * CR, count: 39, flagged: true },
        { source: "apex", target: "borrower", type: "INVOICES", amount: 35 * CR, count: 37, flagged: true },
        { source: "zenith", target: "borrower", type: "PAYS", amount: 30.4 * CR, count: 28, flagged: true },
        { source: "apex", target: "zenith", type: "PAYS", amount: 29.8 * CR, count: 27, flagged: true },
        { source: "borrower", target: "apex", type: "PAYS", amount: 28.9 * CR, count: 25, flagged: true },
        { source: "borrower", target: "orbit", type: "PAYS", amount: 12 * CR, count: 10, flagged: true },
        { source: "orbit", target: "zenith", type: "PAYS", amount: 11.6 * CR, count: 9, flagged: true },
        { source: "orbit", target: "borrower", type: "INVOICES", amount: 14 * CR, count: 14, flagged: false },
        { source: "bharat", target: "borrower", type: "PAYS", amount: 61 * CR, count: 48, flagged: false },
        { source: "borrower", target: "bharat", type: "INVOICES", amount: 63 * CR, count: 51, flagged: false },
        { source: "pune_coil", target: "borrower", type: "INVOICES", amount: 22 * CR, count: 30, flagged: false },
        { source: "rakesh", target: "borrower", type: "DIRECTOR_OF", amount: null, count: null, flagged: false },
        { source: "rakesh", target: "zenith", type: "DIRECTOR_OF", amount: null, count: null, flagged: true },
        { source: "sunil", target: "borrower", type: "DIRECTOR_OF", amount: null, count: null, flagged: false },
        { source: "neha", target: "zenith", type: "DIRECTOR_OF", amount: null, count: null, flagged: true },
        { source: "neha", target: "apex", type: "DIRECTOR_OF", amount: null, count: null, flagged: true },
        { source: "imran", target: "orbit", type: "DIRECTOR_OF", amount: null, count: null, flagged: false },
      ],
    },
    fraudAlerts: [
      { type: "circular_trading", severity: "CRITICAL", title: "Circular trading loop: Nebula → Zenith → Apex → Nebula", description: "₹35 crore of invoices circulate through a three-entity ring with matching reverse payments — classic turnover inflation.", entities: ["borrower", "zenith", "apex"], impact: 30 },
      { type: "common_director", severity: "HIGH", title: "Borrower MD is a director of Zenith Distributors", description: "Rakesh Malhotra sits on both boards; ₹38 crore of sales to Zenith are undisclosed related-party transactions.", entities: ["rakesh", "zenith"], impact: 14 },
      { type: "shell_indicators", severity: "HIGH", title: "Orbit Steel Supplies looks like a pass-through shell", description: "Incorporated 2024, GST cancelled, 2 employees; forwards 97% of Nebula's payments to Zenith.", entities: ["orbit"], impact: 12 },
      { type: "same_pan", severity: "MEDIUM", title: "Zenith and Apex share PAN and registered address", description: "Two 'independent' counterparties trace back to the same legal entity.", entities: ["zenith", "apex"], impact: 8 },
      { type: "gst_mismatch", severity: "HIGH", title: "GSTR-3B turnover 8.8% above GSTR-2A", description: "Turnover declared in 3B is not corroborated by counterparty filings.", entities: [], impact: 14 },
    ],
  },
];
