// Derives every API payload for demo mode from the compact borrower specs in ./portfolio.
// Scores are computed (not hard-coded): each feature contributes explainable points around a
// fixed base, exactly like the backend's SHAP waterfall, so the numbers stay internally consistent.

import type {
  Cam, CamSection, CaseOverview, Company, Contribution, CreditCase, DashboardSummary, Decision, DocumentDetail,
  DocumentRecord, FinancialsResponse, FiveC, Fraud, GraphLink, GraphNode, Note, PolicyRule, RatioRow, Research,
  RiskLevel, Score, TimelineEvent, User,
} from "@/types/api";

import { decide } from "@/lib/policy";

import { CR, type DemoBorrower, type FyCr, PORTFOLIO } from "./portfolio";

const NOW = Date.now();
export const ago = (hours: number) => new Date(NOW - hours * 3600_000).toISOString();
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const cr = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;

export const USERS: User[] = [
  { id: "u-ananya", email: "analyst@credx.demo", full_name: "Ananya Rao", role: "analyst", is_active: true, created_at: ago(2400), last_login_at: ago(1) },
  { id: "u-vikram", email: "manager@credx.demo", full_name: "Vikram Iyer", role: "credit_manager", is_active: true, created_at: ago(2400), last_login_at: ago(5) },
  { id: "u-admin", email: "admin@credx.demo", full_name: "Meera Shah", role: "admin", is_active: true, created_at: ago(3000), last_login_at: ago(30) },
];
const userByName = (name: string) => USERS.find((u) => u.full_name === name) ?? USERS[0];

// ---------------------------------------------------------------- ratios
export function ratioRow(fyLabel: string, f: FyCr, prev?: FyCr): RatioRow {
  const debt = f.long_term_debt + f.short_term_debt + f.current_portion_ltd;
  const v = (x: number) => x * CR;
  return {
    fiscal_year: fyLabel,
    revenue: v(f.revenue), ebitda: v(f.ebitda), pat: v(f.pat), total_debt: v(debt), net_worth: v(f.net_worth),
    ebitda_margin: round(f.ebitda / f.revenue, 4),
    pat_margin: round(f.pat / f.revenue, 4),
    revenue_growth: prev ? round(f.revenue / prev.revenue - 1, 4) : null,
    debt_to_ebitda: round(debt / f.ebitda),
    debt_equity: round(debt / f.net_worth),
    interest_coverage: round(f.ebitda / f.interest_expense),
    dscr: round((f.pat + f.depreciation + f.interest_expense) / (f.interest_expense + f.current_portion_ltd)),
    current_ratio: round(f.current_assets / f.current_liabilities),
    receivable_days: Math.round((f.receivables / f.revenue) * 365),
    inventory_days: Math.round((f.inventory / f.revenue) * 365),
    payable_days: Math.round((f.payables / f.revenue) * 365),
  };
}

const years = (b: DemoBorrower) => Object.keys(b.financials).sort().reverse(); // newest first
export function ratioTrend(b: DemoBorrower): RatioRow[] {
  const ys = years(b).slice().reverse(); // oldest first
  return ys.map((y, i) => ratioRow(y, b.financials[y], i ? b.financials[ys[i - 1]] : undefined));
}

// ---------------------------------------------------------------- scoring
const BASE_POINTS = 680;

interface FeatureDef {
  feature: string; label: string; five_c: string;
  value: (r: RatioRow, b: DemoBorrower) => number | null;
  display: (v: number) => string;
  points: (v: number) => number;
  describe: (v: number, good: boolean) => string;
}

const FEATURES: FeatureDef[] = [
  { feature: "dscr", label: "Debt service coverage", five_c: "capacity", value: (r) => r.dscr, display: (v) => `${v.toFixed(2)}x`,
    points: (v) => clamp((v - 1.4) * 40, -45, 40), describe: (v, g) => g ? `DSCR of ${v.toFixed(2)}x comfortably covers debt service` : `DSCR of ${v.toFixed(2)}x is thin against obligations` },
  { feature: "debt_to_ebitda", label: "Debt / EBITDA", five_c: "capital", value: (r) => r.debt_to_ebitda, display: (v) => `${v.toFixed(2)}x`,
    points: (v) => clamp(-(v - 3) * 9, -35, 25), describe: (v, g) => g ? `Leverage of ${v.toFixed(1)}x is moderate` : `Leverage of ${v.toFixed(1)}x is elevated` },
  { feature: "ebitda_margin", label: "EBITDA margin", five_c: "capacity", value: (r) => r.ebitda_margin, display: (v) => `${(v * 100).toFixed(1)}%`,
    points: (v) => clamp((v - 0.11) * 260, -28, 28), describe: (v, g) => g ? `Healthy EBITDA margin of ${(v * 100).toFixed(1)}%` : `Weak EBITDA margin of ${(v * 100).toFixed(1)}%` },
  { feature: "interest_coverage", label: "Interest coverage", five_c: "capacity", value: (r) => r.interest_coverage, display: (v) => `${v.toFixed(2)}x`,
    points: (v) => clamp((v - 3) * 3.5, -18, 18), describe: (v, g) => g ? `EBITDA covers interest ${v.toFixed(1)}x` : `EBITDA covers interest only ${v.toFixed(1)}x` },
  { feature: "debt_equity", label: "Debt / Equity", five_c: "capital", value: (r) => r.debt_equity, display: (v) => `${v.toFixed(2)}x`,
    points: (v) => clamp(-(v - 1) * 12, -24, 14), describe: (v, g) => g ? `Gearing of ${v.toFixed(2)}x leaves a solid equity cushion` : `Gearing of ${v.toFixed(2)}x leaves a thin equity cushion` },
  { feature: "current_ratio", label: "Current ratio", five_c: "capacity", value: (r) => r.current_ratio, display: (v) => `${v.toFixed(2)}x`,
    points: (v) => clamp((v - 1.25) * 28, -18, 14), describe: (v, g) => g ? `Current ratio of ${v.toFixed(2)}x gives liquidity headroom` : `Current ratio of ${v.toFixed(2)}x signals tight liquidity` },
  { feature: "revenue_growth", label: "Revenue growth", five_c: "conditions", value: (r) => r.revenue_growth, display: (v) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`,
    points: (v) => clamp((v - 0.06) * 110, -15, 12), describe: (v, g) => g ? `Revenue grew ${(v * 100).toFixed(1)}% year on year` : `Revenue ${v < 0 ? "fell" : "grew only"} ${Math.abs(v * 100).toFixed(1)}%` },
  { feature: "receivable_days", label: "Receivable days", five_c: "capacity", value: (r) => r.receivable_days, display: (v) => `${v.toFixed(0)} days`,
    points: (v) => clamp(-(v - 75) * 0.1, -12, 8), describe: (v, g) => g ? `Receivable cycle of ${v.toFixed(0)} days is efficient` : `Receivables of ${v.toFixed(0)} days tie up working capital` },
  { feature: "gst_variance", label: "GSTR-2A vs 3B variance", five_c: "character", value: (_r, b) => (b.gst.gstr3b - b.gst.gstr2a) / b.gst.gstr3b,
    display: (v) => `${(v * 100).toFixed(1)}%`, points: (v) => clamp(-(v - 0.02) * 220, -22, 6),
    describe: (v, g) => g ? `GST returns reconcile within ${(v * 100).toFixed(1)}%` : `GSTR-3B exceeds 2A by ${(v * 100).toFixed(1)}%` },
  { feature: "bounce_rate", label: "Cheque returns (12m)", five_c: "character", value: (_r, b) => b.bank.bounces, display: (v) => `${v}`,
    points: (v) => (v === 0 ? 5 : -v * 6), describe: (v, g) => g ? "No cheque or ECS returns in 12 months" : `${v} cheque/ECS return(s) indicate cash stress` },
  { feature: "litigation", label: "Litigation severity", five_c: "character", value: (_r, b) => ({ LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 })[b.research.litigation],
    display: (v) => ["Low", "Medium", "High", "Critical"][v], points: (v) => [5, -6, -18, -28][v],
    describe: (v, g) => g ? "No material litigation" : `${["Low", "Medium", "High", "Critical"][v]} litigation exposure` },
  { feature: "adverse_media", label: "Media & promoter sentiment", five_c: "character", value: (_r, b) => ({ POSITIVE: 1, NEUTRAL: 0, NEGATIVE: -1 })[b.research.sentiment],
    display: (v) => ["Negative", "Neutral", "Positive"][v + 1], points: (v) => [-16, 0, 6][v + 1],
    describe: (v, g) => g ? "Benign or positive media coverage" : "Adverse media around promoter/company" },
  { feature: "sector_risk", label: "Sector risk", five_c: "conditions", value: (_r, b) => b.sector.risk, display: (v) => `${v}/100`,
    points: (v) => clamp(-(v - 47) * 0.45, -10, 8), describe: (v, g) => g ? "Supportive sector backdrop" : "Sector headwinds weigh on outlook" },
  { feature: "promoter_pledge", label: "Promoter pledge", five_c: "capital", value: (_r, b) => b.shareholding.pledged, display: (v) => `${v}%`,
    points: (v) => (v === 0 ? 3 : -v * 0.2), describe: (v, g) => g ? "No promoter shares pledged" : `${v}% of promoter shares pledged` },
  { feature: "fraud_score", label: "Fraud risk score", five_c: "character", value: (_r, b) => b.fraudScore, display: (v) => `${v}/100`,
    points: (v) => clamp(-(v - 12) * 0.55, -40, 4), describe: (v, g) => g ? "No material fraud indicators" : `Fraud indicators raise risk (${v}/100)` },
];

function riskLevel(score: number): RiskLevel {
  return score >= 740 ? "LOW" : score >= 640 ? "MEDIUM" : score >= 560 ? "HIGH" : "CRITICAL";
}
function rating(score: number) {
  return score >= 800 ? "CX1" : score >= 760 ? "CX2" : score >= 720 ? "CX3" : score >= 680 ? "CX4" : score >= 640 ? "CX5" : score >= 600 ? "CX6" : score >= 550 ? "CX7" : "CX8";
}
// PDO of 75 points keeps demo PDs in a realistic 1–45% band across the 360–850 score range.
const scoreToPd = (s: number) => 1 / (1 + 19 * Math.exp((s - 660) / (75 / Math.LN2)));

export function buildScore(b: DemoBorrower): Score {
  const trend = ratioTrend(b);
  const latest = trend[trend.length - 1];
  const contributions: Contribution[] = FEATURES.map((f) => {
    const value = f.value(latest, b);
    const pts = value == null ? 0 : f.points(value);
    return {
      feature: f.feature, label: f.label, value, display_value: value == null ? "n/a" : f.display(value),
      points: Math.round(pts), points_exact: round(pts, 3), direction: (pts < 0 ? "increases_risk" : "reduces_risk") as Contribution["direction"],
      description: value == null ? "Not available" : f.describe(value, pts >= 0), five_c: f.five_c, missing: value == null,
    };
  }).sort((a, z) => Math.abs(z.points_exact) - Math.abs(a.points_exact));

  const modelScore = Math.round(BASE_POINTS + contributions.reduce((s, c) => s + c.points_exact, 0));
  const overlays = [
    ...b.notes.map((n, i) => ({ source: "analyst_note" as const, label: n.body.length > 70 ? `${n.body.slice(0, 68)}…` : n.body, points: n.impact, rationale: n.rationale, five_c: n.five_c, reference_id: `${b.key}-note-${i}` })),
    ...b.redFlags.filter((r) => r.severity === "CRITICAL").map((r) => ({ source: "red_flag" as const, label: r.label, points: -10, rationale: r.evidence, five_c: r.five_c, reference_id: null })),
  ];
  const overlayTotal = clamp(overlays.reduce((s, o) => s + o.points, 0), -60, 25);
  const credit = clamp(modelScore + overlayTotal, 300, 900);
  const risk = riskLevel(credit);

  const policyRules: PolicyRule[] = [
    { id: "ko_fraud", name: "No critical fraud indicators", kind: "knockout", threshold: "Fraud score < 75", actual: b.fraudScore, status: b.fraudScore >= 75 ? "fail" : "pass", guidance: "Critical fraud signals require forensic review before any sanction." },
    { id: "ko_going_concern", name: "No going-concern doubt", kind: "knockout", threshold: "Unmodified audit opinion", actual: b.redFlags.some((r) => r.label.includes("Going-concern")) ? "Emphasis of matter" : "Unmodified", status: b.redFlags.some((r) => r.label.includes("Going-concern")) ? "fail" : "pass", guidance: "Auditor going-concern doubt is a policy knock-out." },
    { id: "dscr_min", name: "Minimum DSCR", kind: "deviation", threshold: "≥ 1.25x", actual: latest.dscr, status: (latest.dscr ?? 0) >= 1.25 ? "pass" : "fail", guidance: "Cash accruals must cover debt service with a 25% cushion." },
    { id: "leverage_max", name: "Maximum Debt / EBITDA", kind: "deviation", threshold: "≤ 4.0x", actual: latest.debt_to_ebitda, status: (latest.debt_to_ebitda ?? 0) <= 4 ? "pass" : "fail", guidance: "Total debt should be repayable from ~4 years of EBITDA." },
    { id: "gearing_max", name: "Maximum Debt / Equity", kind: "deviation", threshold: "≤ 2.5x", actual: latest.debt_equity, status: (latest.debt_equity ?? 0) <= 2.5 ? "pass" : "fail", guidance: "Promoter equity cushion requirement." },
    { id: "current_ratio_min", name: "Minimum current ratio", kind: "deviation", threshold: "≥ 1.20x", actual: latest.current_ratio, status: (latest.current_ratio ?? 0) >= 1.2 ? "pass" : "fail", guidance: "Working-capital lenders require 1.2x–1.33x." },
    { id: "gst_integrity", name: "GST reconciliation", kind: "deviation", threshold: "2A vs 3B ≤ 5%", actual: `${(((b.gst.gstr3b - b.gst.gstr2a) / b.gst.gstr3b) * 100).toFixed(1)}%`, status: (b.gst.gstr3b - b.gst.gstr2a) / b.gst.gstr3b <= 0.05 ? "pass" : "fail", guidance: "Turnover in 3B should be corroborated by counterparty filings." },
    { id: "pledge_max", name: "Promoter pledge", kind: "deviation", threshold: "≤ 25%", actual: `${b.shareholding.pledged}%`, status: b.shareholding.pledged <= 25 ? "pass" : "fail", guidance: "High pledge indicates promoter funding stress." },
  ];
  const knockouts = policyRules.filter((r) => r.kind === "knockout" && r.status === "fail");
  const deviations = policyRules.filter((r) => r.kind === "deviation" && r.status === "fail");

  const decision: Decision = decide(credit, { knockouts: knockouts.length, deviations: deviations.length, severeOverlay: overlays.some((o) => o.points <= -30) });

  const f = b.financials[years(b)[0]];
  const leverageCap = Math.max(0, f.ebitda * (risk === "LOW" ? 3.75 : 3) - (f.long_term_debt + f.short_term_debt + f.current_portion_ltd)) * CR;
  const isWc = /cash credit|working/i.test(b.facility.facility_type);
  const methods = [
    { method: "Requested amount", limit: b.facility.requested, basis: "Applicant request", binding: false },
    isWc
      ? { method: "Turnover method (Nayak Committee)", limit: Math.max(0, f.revenue * (1 + Math.max(0.1, 2 * (latest.revenue_growth ?? 0))) * 0.2) * CR, basis: "20% of order-book-driven projected turnover", binding: false }
      : { method: "DSCR capacity (1.25x)", limit: Math.max(0, ((f.pat + f.depreciation + f.interest_expense) / 1.25 - f.interest_expense - f.current_portion_ltd) * (b.facility.tenure_months / 12) * 0.82) * CR, basis: `Surplus accruals over ${b.facility.tenure_months / 12} years`, binding: false },
    // Working-capital lines are self-liquidating and sized on turnover / drawing power, not leverage.
    ...(isWc ? [] : [{ method: "Leverage headroom", limit: leverageCap, basis: `${risk === "LOW" ? "3.75" : "3.0"}x EBITDA less existing debt`, binding: false }]),
    { method: "Collateral cover (1.25x)", limit: b.facility.collateral_value / 1.25, basis: "Security value ÷ 1.25", binding: false },
  ];
  const minMethod = methods.reduce((a, m) => (m.limit < a.limit ? m : a));
  minMethod.binding = true;
  const haircut = credit >= 760 ? 1 : credit >= 700 ? 0.9 : credit >= 650 ? 0.75 : 0.5;
  const recommended = decision === "DECLINE" ? 0 : Math.round((minMethod.limit * haircut) / 5e5) * 5e5;

  const grade = rating(credit);
  const spread = { CX1: 75, CX2: 115, CX3: 165, CX4: 225, CX5: 300, CX6: 390, CX7: 500, CX8: 650 }[grade] ?? 300;
  const components = [
    { component: "Base rate (EBLR proxy)", bps: 925, rationale: "Repo-linked external benchmark" },
    { component: `Credit spread — ${grade}`, bps: spread, rationale: "Grade-based risk premium" },
    ...(b.facility.tenure_months > 60 ? [{ component: "Tenor premium", bps: 25, rationale: "Tenor above five years" }] : []),
    ...(b.fraudScore >= 25 ? [{ component: "Governance premium", bps: b.fraudScore >= 50 ? 100 : 50, rationale: "Elevated fraud / governance indicators" }] : []),
    ...(b.sector.outlook === "WEAK" ? [{ component: "Sector premium", bps: 25, rationale: "Weak sector outlook" }] : []),
    ...(b.facility.collateral_value / b.facility.requested >= 1.5 ? [{ component: "Collateral discount", bps: -25, rationale: "Security cover above 1.5x" }] : []),
  ];
  const rate = round(components.reduce((s, c) => s + c.bps, 0) / 100);

  const byC = (c: string) => contributions.filter((x) => x.five_c === c).reduce((s, x) => s + x.points_exact, 0);
  const ovC = (c: string) => overlays.filter((x) => x.five_c === c).reduce((s, x) => s + x.points, 0);
  const cScore = (c: string, base: number) => Math.round(clamp(base + (byC(c) + ovC(c)) * 0.9, 8, 98));
  const fiveC = (key: string, title: string, base: number, evidence: string[]): FiveC => {
    const score = cScore(key, base);
    return { title, score, assessment: score >= 72 ? "Strong" : score >= 55 ? "Adequate" : "Weak", model_points: Math.round(byC(key)), overlay_points: ovC(key), evidence };
  };
  const cover = b.facility.collateral_value / b.facility.requested;
  const five_cs = {
    character: fiveC("character", "Character", 68, [b.research.sentiment === "POSITIVE" ? "Positive media coverage" : b.research.sentiment === "NEGATIVE" ? "Adverse media & litigation" : "Neutral media coverage", `${b.bank.bounces} cheque returns`, `Fraud score ${b.fraudScore}/100`]),
    capacity: fiveC("capacity", "Capacity", 62, [`DSCR ${latest.dscr?.toFixed(2)}x`, `EBITDA margin ${((latest.ebitda_margin ?? 0) * 100).toFixed(1)}%`, `Receivables ${latest.receivable_days} days`]),
    capital: fiveC("capital", "Capital", 62, [`Debt/Equity ${latest.debt_equity?.toFixed(2)}x`, `Net worth ${cr(f.net_worth)}`, `Pledge ${b.shareholding.pledged}%`]),
    collateral: { title: "Collateral", score: Math.round(clamp(40 + cover * 25, 10, 95)), assessment: cover >= 1.5 ? "Strong" : cover >= 1 ? "Adequate" : "Weak", model_points: 0, overlay_points: ovC("collateral"), evidence: [`Security cover ${cover.toFixed(2)}x`, b.facility.collateral_type] },
    conditions: fiveC("conditions", "Conditions", 66, [`Sector outlook: ${b.sector.outlook.toLowerCase()}`, `Revenue growth ${latest.revenue_growth != null ? `${(latest.revenue_growth * 100).toFixed(1)}%` : "n/a"}`]),
  };

  const neg = contributions.filter((c) => c.points < -2 && !c.missing);
  const pos = contributions.filter((c) => c.points > 2 && !c.missing);
  const reasons = [
    `Model score ${modelScore} adjusted by ${overlayTotal >= 0 ? "+" : ""}${overlayTotal} points of analyst and document overlays → ${credit} (${grade}).`,
    ...(knockouts.length ? [`Policy knock-out: ${knockouts.map((k) => k.name).join(", ")}.`] : []),
    ...(deviations.length ? [`${deviations.length} policy deviation(s): ${deviations.map((d) => d.name).join(", ")}.`] : ["All policy covenants pass."]),
    ...(neg[0] ? [`Largest drag: ${neg[0].description} (${neg[0].points} pts).`] : []),
    ...(pos[0] ? [`Largest support: ${pos[0].description} (+${pos[0].points} pts).`] : []),
  ];
  const conditions = decision === "DECLINE" ? [] : [
    ...deviations.map((d) => ({
      dscr_min: "Maintain DSCR ≥ 1.25x tested annually; create a DSRA of one quarter's debt service.",
      leverage_max: "No additional borrowing without lender consent; bring Debt/EBITDA below 4.0x within 18 months.",
      gearing_max: "Promoters to infuse subordinated funds to bring Debt/Equity below 2.5x.",
      current_ratio_min: "Monthly stock & book-debt statements; drawing power at 25% stock / 40% debtor margins.",
      gst_integrity: "CA-certified GSTR-2B vs 3B reconciliation before first disbursement.",
      pledge_max: "No further promoter pledge; release of 10% pledge within 12 months.",
    } as Record<string, string>)[d.id]).filter(Boolean),
    "Personal guarantees of promoter directors.",
    "Exclusive charge on primary security with minimum 1.25x cover.",
    "Quarterly unaudited financials and annual review.",
  ];
  const whatIf = neg.slice(0, 3).map((c) => ({
    feature: c.feature, label: c.label, current: c.display_value,
    target: ({ dscr: "1.50x", debt_to_ebitda: "3.00x", ebitda_margin: "12.0%", gst_variance: "2.0%", receivable_days: "75 days", fraud_score: "10/100", promoter_pledge: "0%", litigation: "Low", current_ratio: "1.33x", interest_coverage: "3.00x", debt_equity: "1.00x", revenue_growth: "+6.0%", bounce_rate: "0", adverse_media: "Neutral", sector_risk: "47/100" } as Record<string, string>)[c.feature] ?? "benchmark",
    score_gain: Math.round(Math.abs(c.points_exact)),
  }));

  return {
    id: `score-${b.key}`, version: 2, model_version: "xgb-202610-mono", model_score: modelScore, credit_score: credit,
    probability_of_default: round(scoreToPd(credit), 4), approval_probability: round(1 / (1 + Math.exp(-(credit - 650) / 60)), 3),
    risk_level: risk, rating: grade, decision, recommended_amount: recommended, suggested_rate: rate,
    contributions, overlays, overlay_total: overlayTotal, base_points: BASE_POINTS,
    policy: { rules: policyRules, knockouts, deviations, passed: policyRules.filter((r) => r.status === "pass").length, not_evaluable: 0 },
    five_cs,
    loan_sizing: { requested_amount: b.facility.requested, recommended_amount: recommended, binding_constraint: minMethod.method, methods, tenure_months: b.facility.tenure_months },
    pricing: { suggested_rate: rate, spread_over_benchmark: round(rate - 9.25), grade, components },
    ratios: { latest_year: latest.fiscal_year, latest, trend },
    top_risk_factors: [...knockouts.map((k) => k.name), ...neg.slice(0, 4).map((c) => c.description)].slice(0, 5),
    top_strengths: pos.slice(0, 4).map((c) => c.description),
    decision_reasons: reasons,
    conditions,
    what_if: whatIf,
    features: { values: Object.fromEntries(contributions.map((c) => [c.feature, c.value])), sources: {} },
    model_metrics: { auc: 0.884, gini: 0.769, ks: 0.611 },
    created_at: ago(b.updatedHoursAgo + 0.5),
  };
}

// ---------------------------------------------------------------- research
export function buildResearch(b: DemoBorrower): Research {
  return {
    id: `research-${b.key}`,
    litigation_risk: b.research.litigation,
    promoter_sentiment: b.research.sentiment,
    sector_outlook: b.sector.outlook,
    overall_risk: b.research.overall,
    summary: b.research.summary,
    summary_provider: "local",
    sentiment_score: round(b.research.findings.reduce((s, f) => s + f.sentiment, 0) / Math.max(1, b.research.findings.length), 3),
    litigation_score: { LOW: 8, MEDIUM: 35, HIGH: 68, CRITICAL: 90 }[b.research.litigation],
    sector: { name: b.sector.name, risk: b.sector.risk, outlook: b.sector.outlook, headwinds: b.sector.headwinds, tailwinds: b.sector.tailwinds, rbi_context: b.sector.rbi, kb_version: "2026.09", benchmark_ebitda_margin: b.sector.benchmarkMargin },
    mca: {
      cin: b.company.cin, cin_details: { listed: b.company.cin.startsWith("L"), state: b.company.state, year: b.company.incorporation_year },
      vintage_years: 2026 - b.company.incorporation_year, company_status: "Active",
      open_charges: [{ holder: b.bank.bank, amount: b.facility.collateral_value * 0.8, status: "Open" }],
      observations: [
        { severity: "LOW", text: `Incorporated ${b.company.incorporation_year}; ${2026 - b.company.incorporation_year} years of operating history.` },
        ...(b.shareholding.pledged > 25 ? [{ severity: "HIGH" as const, text: `${b.shareholding.pledged}% of promoter holding pledged.` }] : []),
      ],
      directors: b.company.promoters.map((p) => ({ name: p.name, din: p.din })),
    },
    findings: b.research.findings.map((f) => ({ category: f.category, title: f.title, snippet: f.snippet, source: f.source, url: null, severity: f.severity, sentiment: f.sentiment, provider: "offline", published_at: ago(f.daysAgo * 24) })),
    litigation_cases: b.litigation.map((l) => ({ source: "documents", types: l.types, title: l.title, forum: l.forum, claim_amount: l.claim ?? undefined, status: l.status, weight: l.types.includes("ibc") ? 0.8 : 0.4, borrower_is_claimant: l.borrowerIsClaimant })),
    providers: ["offline", "documents", "knowledge_base"],
    queries: [`"${b.company.name}"`, `"${b.company.name.replace(/ (Private )?Limited/, "")}" fraud OR NCLT OR default`, ...b.company.promoters.map((p) => `"${p.name}" litigation`)],
    created_at: ago(b.updatedHoursAgo + 1),
  };
}

// ---------------------------------------------------------------- fraud
export function buildFraud(b: DemoBorrower): Fraud {
  const borrowerNode: GraphNode = { id: "borrower", label: b.company.name.replace(" Private Limited", "").replace(" Limited", ""), type: "borrower", risk: b.fraudScore / 100, flagged: b.fraudScore >= 50, size: 26, meta: { GSTIN: b.company.gstin, CIN: b.company.cin } };
  let nodes: GraphNode[];
  let links: GraphLink[];
  if (b.network) {
    nodes = [borrowerNode, ...b.network.entities.map((e) => ({ ...e, size: e.type === "person" ? 13 : 17 }))];
    links = b.network.links;
  } else {
    const parties = [
      ...b.bank.customers.map((n, i) => ({ id: `c${i}`, label: n, dir: "out" as const, amt: (b.bank.monthlyCredit * 12 * CR) / (b.bank.customers.length + 0.5) })),
      ...b.bank.suppliers.map((n, i) => ({ id: `s${i}`, label: n, dir: "in" as const, amt: (b.bank.monthlyCredit * 6 * CR) / (b.bank.suppliers.length + 1) })),
    ];
    nodes = [borrowerNode,
      ...parties.map((p) => ({ id: p.id, label: p.label, type: "company" as const, risk: 0.08, flagged: false, size: 17, meta: { Role: p.dir === "out" ? "Customer" : "Supplier" } })),
      ...b.company.promoters.map((p, i) => ({ id: `p${i}`, label: p.name, type: "person" as const, risk: 0.05, flagged: false, size: 13, meta: { DIN: p.din, Role: p.role } })),
    ];
    links = [
      ...parties.flatMap((p) => p.dir === "out"
        ? [{ source: "borrower", target: p.id, type: "INVOICES" as const, amount: p.amt, count: 40, flagged: false }, { source: p.id, target: "borrower", type: "PAYS" as const, amount: p.amt * 0.96, count: 36, flagged: false }]
        : [{ source: p.id, target: "borrower", type: "INVOICES" as const, amount: p.amt, count: 30, flagged: false }]),
      ...b.company.promoters.map((_, i) => ({ source: `p${i}`, target: "borrower", type: "DIRECTOR_OF" as const, amount: null, count: null, flagged: false })),
    ];
  }
  const v = (b.gst.gstr3b - b.gst.gstr2a) / b.gst.gstr3b;
  const itcRatio = b.gst.itc / (b.gst.itc * (1 - Math.max(0, v - 0.01)));
  const bankAnnual = b.bank.monthlyCredit * 12;
  const bankRatio = bankAnnual / b.gst.gstr3b;
  const status = (bad: boolean, warn: boolean) => (bad ? "fail" : warn ? "warn" : "pass") as "fail" | "warn" | "pass";
  const gst_checks = [
    { check: "GSTR-2A vs GSTR-3B turnover", status: status(v > 0.08, v > 0.03), detail: `3B exceeds 2A by ${(v * 100).toFixed(1)}%`, value: round(v, 4), score_impact: v > 0.08 ? -14 : v > 0.03 ? -6 : 0 },
    { check: "GSTR-1 vs GSTR-3B outward supplies", status: status(false, Math.abs(b.gst.gstr1 - b.gst.gstr3b) / b.gst.gstr3b > 0.01), detail: `${((Math.abs(b.gst.gstr1 - b.gst.gstr3b) / b.gst.gstr3b) * 100).toFixed(1)}% variance`, value: round(Math.abs(b.gst.gstr1 - b.gst.gstr3b) / b.gst.gstr3b, 4), score_impact: 0 },
    { check: "ITC claimed vs available (2B)", status: status(itcRatio > 1.08, itcRatio > 1.03), detail: `ITC claimed is ${itcRatio.toFixed(2)}x supplier-reported credit`, value: round(itcRatio, 3), score_impact: itcRatio > 1.08 ? -10 : 0 },
    { check: "Bank credits vs GST turnover", status: status(bankRatio < 0.75, bankRatio < 0.88), detail: `Annualised credits are ${bankRatio.toFixed(2)}x GST turnover`, value: round(bankRatio, 3), score_impact: bankRatio < 0.75 ? -12 : 0 },
    { check: "Effective GST cash outflow", status: status(false, b.gst.tax / b.gst.gstr3b < 0.06), detail: `Tax paid is ${((b.gst.tax / b.gst.gstr3b) * 100).toFixed(1)}% of turnover`, value: round(b.gst.tax / b.gst.gstr3b, 4), score_impact: 0 },
    { check: "Filing discipline", status: status(b.gst.daysLate > 30, b.gst.daysLate > 0), detail: b.gst.daysLate ? `Latest GSTR-3B filed ${b.gst.daysLate} days late` : "All returns filed on time", value: b.gst.daysLate, score_impact: b.gst.daysLate > 30 ? -4 : 0 },
  ];
  const alerts = b.fraudAlerts.map((a, i) => ({ id: `${b.key}-alert-${i}`, alert_type: a.type, severity: a.severity, title: a.title, description: a.description, entities: a.entities, evidence: {}, score_impact: a.impact, status: "open" as const }));
  const heatmap = nodes.filter((n) => n.type !== "person").slice(0, 8).map((n) => ({
    entity: n.label, id: n.id,
    "Circular flows": n.flagged && b.network ? Math.round(n.risk * 100) : 0,
    "Related party": b.network && ["zenith", "apex", "rakesh"].includes(n.id) ? 80 : 0,
    "Shell signals": n.id === "orbit" ? 85 : n.id === "apex" ? 55 : 0,
    "GST mismatch": n.id === "borrower" ? Math.round(clamp(v * 900, 0, 100)) : 0,
    Concentration: n.id === "borrower" ? 0 : Math.round(clamp(n.size * 1.6, 0, 60)),
  }));
  const level: RiskLevel = b.fraudScore >= 75 ? "CRITICAL" : b.fraudScore >= 50 ? "HIGH" : b.fraudScore >= 25 ? "MEDIUM" : "LOW";
  return {
    id: `fraud-${b.key}`, fraud_score: b.fraudScore, risk_level: level,
    summary: alerts.length
      ? `Fraud risk ${level} (${b.fraudScore}/100). ${alerts.slice(0, 2).map((a) => a.title).join("; ")}.`
      : `Fraud risk LOW (${b.fraudScore}/100). Graph, GST and banking checks show no material anomalies.`,
    graph: { nodes, links, borrower_id: "borrower" },
    heatmap,
    gst_checks,
    alerts,
    stats: { nodes: nodes.length, links: links.length, cycles: b.network ? 2 : 0, flagged_entities: nodes.filter((n) => n.flagged).length },
    created_at: ago(b.updatedHoursAgo + 0.8),
  };
}

// ---------------------------------------------------------------- documents
const DOC_KINDS = [
  { suffix: "AR_FY25.pdf", type: "annual_report", pages: 148, conf: 0.94 },
  { suffix: "GSTR3B_FY25.pdf", type: "gst_return", pages: 12, conf: 0.97 },
  { suffix: "Bank_Statement.pdf", type: "bank_statement", pages: 36, conf: 0.95 },
  { suffix: "Sanction_Letter.pdf", type: "sanction_letter", pages: 6, conf: 0.91 },
  { suffix: "Shareholding_Q1FY26.pdf", type: "shareholding_pattern", pages: 3, conf: 0.89 },
  { suffix: "MCA_Master_Data.pdf", type: "mca_filing", pages: 4, conf: 0.93 },
];

export function buildDocuments(b: DemoBorrower): DocumentRecord[] {
  const stem = b.company.name.split(" ")[0];
  const docs = [...DOC_KINDS, ...b.litigation.map((l, i) => ({ suffix: `Legal_Notice_${i + 1}.pdf`, type: "legal_notice", pages: 4, conf: 0.9 }))];
  return docs.map((d, i) => ({
    id: `${b.key}-doc-${i}`, case_id: b.key, filename: `${stem}_${d.suffix}`, content_type: "application/pdf",
    size_bytes: d.pages * 61_000 + 18_000, declared_type: null, doc_type: d.type, classification_confidence: d.conf,
    classification_signals: [d.type.replace(/_/g, " "), `filename:${stem}_${d.suffix}`],
    status: "processed", page_count: d.pages, ocr_used: d.type === "legal_notice", extraction_confidence: round(d.conf - 0.06, 2),
    error: null, created_at: ago(b.updatedHoursAgo + 30 - i),
  }));
}

export function buildDocumentDetail(b: DemoBorrower, doc: DocumentRecord): DocumentDetail {
  const f = b.financials[years(b)[0]];
  const isFin = doc.doc_type === "annual_report";
  const fieldList: [string, number][] = [["revenue", f.revenue], ["ebitda", f.ebitda], ["pat", f.pat], ["total_debt", f.long_term_debt + f.short_term_debt + f.current_portion_ltd], ["net_worth", f.net_worth], ["current_assets", f.current_assets], ["current_liabilities", f.current_liabilities], ["interest_expense", f.interest_expense]];
  return {
    ...doc,
    text_preview: isFin
      ? `${b.company.name.toUpperCase()}\nANNUAL REPORT 2024-25\n\nStatement of Profit and Loss for the year ended 31 March 2025\n(₹ in Crores)                           FY2025      FY2024\nRevenue from operations                 ${f.revenue.toFixed(2)}      ${b.financials.FY24?.revenue.toFixed(2)}\nEBITDA                                  ${f.ebitda.toFixed(2)}       ${b.financials.FY24?.ebitda.toFixed(2)}\nFinance costs                           ${f.interest_expense.toFixed(2)}        ${b.financials.FY24?.interest_expense.toFixed(2)}\nProfit after tax                        ${f.pat.toFixed(2)}       ${b.financials.FY24?.pat.toFixed(2)}\n…`
      : `${doc.doc_type?.replace(/_/g, " ").toUpperCase()}\n${b.company.name}\nGSTIN ${b.company.gstin}\n…`,
    extracted: {
      company_name: b.company.name, doc_type: doc.doc_type ?? "unknown", fiscal_years: years(b),
      headline: { company_name: b.company.name, revenue: f.revenue * CR, ebitda: f.ebitda * CR, pat: f.pat * CR, debt: (f.long_term_debt + f.short_term_debt + f.current_portion_ltd) * CR, gst_number: b.company.gstin,
        financial_health: b.fraudScore > 50 ? "STRESSED" : f.ebitda / f.revenue > 0.13 ? "STRONG" : "MODERATE" },
      classification: { type: doc.doc_type ?? "unknown", confidence: doc.classification_confidence ?? 0, signals: doc.classification_signals, scores: { [doc.doc_type ?? "unknown"]: 14.2, financial_statement: 6.1, gst_return: 1.2 } },
      identifiers: { gstins: [b.company.gstin], pans: [b.company.pan], cins: [b.company.cin], dins: b.company.promoters.map((p) => p.din), invalid_gstins: [] },
      directors: b.company.promoters.map((p) => ({ name: p.name, din: p.din })),
      financials: isFin ? Object.fromEntries(years(b).map((y) => [y, Object.fromEntries(fieldList.map(([k]) => {
        const yf = b.financials[y] as unknown as Record<string, number>;
        const val = k === "total_debt" ? yf.long_term_debt + yf.short_term_debt + yf.current_portion_ltd : yf[k];
        return [k, { value: val * CR, confidence: 0.93, method: "table", page: 87, snippet: `${k.replace(/_/g, " ")} … ${val.toFixed(2)}` }];
      }))])) : {},
      gst: doc.doc_type === "gst_return" ? { returns: [{ return_type: "GSTR-3B", turnover: b.gst.gstr3b * CR, evidence: "Table 3.1(a)" }, { return_type: "GSTR-2A", turnover: b.gst.gstr2a * CR, evidence: "Auto-populated" }, { return_type: "GSTR-1", turnover: b.gst.gstr1 * CR, evidence: "B2B + B2C" }], mismatch_pct: round(((b.gst.gstr3b - b.gst.gstr2a) / b.gst.gstr3b) * 100), itc_claimed: b.gst.itc * CR, tax_paid: b.gst.tax * CR, days_late: b.gst.daysLate } : undefined,
      red_flags: b.redFlags.filter((r) => r.file.endsWith(doc.filename.split("_").slice(1).join("_"))).map((r) => ({ label: r.label, severity: r.severity, five_c: r.five_c, evidence: r.evidence, page: 42, filename: doc.filename })),
      positive_signals: isFin ? b.positives : [],
      tables: isFin ? [{ page: 87, method: "pdfplumber", header: ["Particulars (₹ Cr)", ...years(b)], rows: fieldList.map(([k]) => [k.replace(/_/g, " "), ...years(b).map((y) => { const yf = b.financials[y] as unknown as Record<string, number>; return (k === "total_debt" ? yf.long_term_debt + yf.short_term_debt + yf.current_portion_ltd : yf[k]).toFixed(2); })]), accuracy: 98.4 }] : [],
      pages: Array.from({ length: Math.min(doc.page_count ?? 1, 6) }, (_, i) => ({ number: i + 1, method: doc.ocr_used ? "ocr:tesseract" : "pdfplumber", confidence: doc.ocr_used ? 0.86 : 0.99, chars: 2100 + i * 130 })),
      ocr_used: doc.ocr_used, page_count: doc.page_count ?? 1,
      confidence: { overall: doc.extraction_confidence ?? 0.9, text: doc.ocr_used ? 0.86 : 0.99, classification: doc.classification_confidence ?? 0.9, fields: isFin ? 0.93 : null },
      warnings: doc.ocr_used ? ["Scanned pages processed with OCR — review extracted values"] : [],
      stages: [
        { name: "preprocessing", status: "done", ms: 42 }, { name: "text_extraction", status: "done", ms: 610 }, { name: "ocr", status: doc.ocr_used ? "done" : "skipped", ms: doc.ocr_used ? 2840 : 0 },
        { name: "tables", status: "done", ms: 920 }, { name: "classification", status: "done", ms: 18 }, { name: "entities", status: "done", ms: 140 }, { name: "normalization", status: "done", ms: 35 },
      ],
    },
  };
}

// ---------------------------------------------------------------- notes, case, overview
export function buildNotes(b: DemoBorrower): Note[] {
  return b.notes.map((n, i) => ({
    id: `${b.key}-note-${i}`, case_id: b.key, parent_id: null, kind: "note", category: n.category, body: n.body,
    impact_points: n.impact, inferred_impact: n.impact, impact_rationale: n.rationale, five_c: n.five_c,
    include_in_cam: true, pinned: i === 0, author: userByName(n.author), created_at: ago(n.daysAgo * 24),
    preview_impact: null, preview_rationale: null,
  }));
}

export function buildCompany(b: DemoBorrower): Company {
  const c = b.company;
  return { id: `co-${b.key}`, name: c.name, cin: c.cin, pan: c.pan, gstin: c.gstin, sector: c.sector, sub_sector: c.sub_sector, constitution: c.constitution,
    incorporation_year: c.incorporation_year, city: c.city, state: c.state, website: c.website, promoters: c.promoters, external_rating: c.external_rating, created_at: ago(900) };
}

export function buildCase(b: DemoBorrower, score: Score): CreditCase {
  const decided = b.status === "approved";
  return {
    id: b.key, reference: b.reference, company: buildCompany(b), facility_type: b.facility.facility_type, requested_amount: b.facility.requested,
    tenure_months: b.facility.tenure_months, purpose: b.facility.purpose, collateral_type: b.facility.collateral_type, collateral_value: b.facility.collateral_value,
    status: b.status, priority: b.priority, latest_score: score.credit_score, latest_risk_level: score.risk_level, latest_fraud_score: b.fraudScore,
    final_decision: decided ? score.decision : null, decision_rationale: decided ? "Approved by credit committee in line with CredX recommendation." : null,
    decided_at: decided ? ago(b.updatedHoursAgo) : null, is_demo: true, assigned_to: b.key === "orion" || b.key === "kaveri" ? USERS[1] : USERS[0],
    created_at: ago(b.updatedHoursAgo + 72), updated_at: ago(b.updatedHoursAgo),
  };
}

export function buildFinancials(b: DemoBorrower, score: Score): FinancialsResponse {
  return {
    statements: years(b).map((y) => {
      const f = b.financials[y] as unknown as Record<string, number>;
      const values: Record<string, number | null> = {};
      for (const [k, val] of Object.entries(f)) values[k] = val * CR;
      values.total_debt = (f.long_term_debt + f.short_term_debt + f.current_portion_ltd) * CR;
      return {
        fiscal_year: y, source: "extracted", confidence: 0.93, values,
        provenance: Object.fromEntries(Object.keys(values).map((k) => [k, { filename: `${b.company.name.split(" ")[0]}_AR_FY25.pdf`, page: 87, snippet: `${k.replace(/_/g, " ")} ${(values[k]! / CR).toFixed(2)}`, confidence: 0.93, method: "table" }])),
      };
    }),
    ratios: score.ratios,
  };
}

export function buildCam(b: DemoBorrower, score: Score, research: Research, fraud: Fraud, comments: Record<string, string> = {}): Cam {
  const decisionText = { APPROVE: "Approve", APPROVE_WITH_CONDITIONS: "Approve with conditions", REFER: "Refer to committee", DECLINE: "Decline" }[score.decision];
  const sections: CamSection[] = [
    { id: "executive_summary", title: "Executive summary & recommendation", kind: "decision", analyst_comment: comments.executive_summary ?? "",
      content: { decision: decisionText, decision_code: score.decision,
        narrative: `${b.company.name} (${b.company.sub_sector}, ${b.company.city}) seeks a ${b.facility.facility_type.toLowerCase()} of ${cr(b.facility.requested / CR)} for ${b.facility.purpose.toLowerCase()}. CredX scores the borrower ${score.credit_score} (${score.rating}, ${score.risk_level.toLowerCase()} risk; PD ${(score.probability_of_default * 100).toFixed(2)}%). ${score.decision_reasons[1] ?? ""}`,
        metrics: [
          { label: "CredX score", value: `${score.credit_score} · ${score.rating}` }, { label: "Probability of default", value: `${(score.probability_of_default * 100).toFixed(2)}%` },
          { label: "Recommended", value: score.recommended_amount ? cr(score.recommended_amount / CR) : "Nil" }, { label: "Pricing", value: `${score.suggested_rate.toFixed(2)}% p.a.` },
        ] } },
    { id: "borrower", title: "Borrower profile", kind: "kv", analyst_comment: comments.borrower ?? "",
      content: [
        { label: "Legal name", value: b.company.name }, { label: "CIN", value: b.company.cin }, { label: "GSTIN", value: b.company.gstin },
        { label: "Constitution", value: b.company.constitution }, { label: "Incorporated", value: String(b.company.incorporation_year) },
        { label: "Sector", value: `${b.sector.name} — ${b.company.sub_sector}` }, { label: "External rating", value: b.company.external_rating },
        { label: "Promoters", value: b.company.promoters.map((p) => `${p.name} (${p.shareholding_pct}%)`).join(", ") },
      ] },
    { id: "facility", title: "Proposed facility", kind: "kv", analyst_comment: comments.facility ?? "",
      content: [
        { label: "Facility", value: b.facility.facility_type }, { label: "Requested", value: cr(b.facility.requested / CR) }, { label: "Tenure", value: `${b.facility.tenure_months} months` },
        { label: "Purpose", value: b.facility.purpose }, { label: "Security", value: b.facility.collateral_type }, { label: "Security cover", value: `${(b.facility.collateral_value / b.facility.requested).toFixed(2)}x` },
      ] },
    { id: "financials", title: "Financial analysis", kind: "table", analyst_comment: comments.financials ?? "",
      note: `Figures in ₹ crore, extracted from audited financial statements. Sector benchmark EBITDA margin ${(b.sector.benchmarkMargin * 100).toFixed(0)}%.`,
      content: { header: ["Particulars", ...score.ratios.trend.map((r) => r.fiscal_year)], rows: [
        ["Revenue", ...score.ratios.trend.map((r) => ((r.revenue ?? 0) / CR).toFixed(1))],
        ["EBITDA", ...score.ratios.trend.map((r) => ((r.ebitda ?? 0) / CR).toFixed(1))],
        ["EBITDA margin", ...score.ratios.trend.map((r) => `${((r.ebitda_margin ?? 0) * 100).toFixed(1)}%`)],
        ["PAT", ...score.ratios.trend.map((r) => ((r.pat ?? 0) / CR).toFixed(1))],
        ["Total debt", ...score.ratios.trend.map((r) => ((r.total_debt ?? 0) / CR).toFixed(1))],
        ["Debt / EBITDA", ...score.ratios.trend.map((r) => `${r.debt_to_ebitda?.toFixed(2)}x`)],
        ["DSCR", ...score.ratios.trend.map((r) => `${r.dscr?.toFixed(2)}x`)],
        ["Current ratio", ...score.ratios.trend.map((r) => `${r.current_ratio?.toFixed(2)}x`)],
      ] } },
    { id: "five_cs", title: "Five Cs of credit", kind: "five_cs", analyst_comment: comments.five_cs ?? "",
      content: Object.values(score.five_cs).map((c) => ({ c: c.title, score: c.score, assessment: c.assessment, evidence: c.evidence })) },
    { id: "gst_banking", title: "GST & banking conduct", kind: "table", analyst_comment: comments.gst_banking ?? "",
      content: { header: ["Check", "Result", "Observation"], rows: fraud.gst_checks.map((g) => [g.check, g.status.toUpperCase(), g.detail]) } },
    { id: "external", title: "External intelligence & sector", kind: "bullets", analyst_comment: comments.external ?? "",
      content: { summary: research.summary, badges: [{ label: "Litigation", value: research.litigation_risk }, { label: "Sentiment", value: research.promoter_sentiment }, { label: "Sector", value: research.sector_outlook }],
        groups: [{ title: "Sector headwinds", lines: research.sector.headwinds }, { title: "RBI / policy context", lines: research.sector.rbi_context }] } },
    { id: "fraud", title: "Fraud & early-warning observations", kind: "bullets", analyst_comment: comments.fraud ?? "",
      content: { summary: fraud.summary, bullets: fraud.alerts.map((a) => `${a.severity}: ${a.title}`) } },
    { id: "risk", title: "Risk assessment & explainability", kind: "table", analyst_comment: comments.risk ?? "",
      note: `Base ${score.base_points} points + model drivers = ${score.model_score}; overlays ${score.overlay_total >= 0 ? "+" : ""}${score.overlay_total} → ${score.credit_score}.`,
      content: { header: ["Driver", "Value", "Points", "Interpretation"], rows: score.contributions.slice(0, 8).map((c) => [c.label, c.display_value, `${c.points >= 0 ? "+" : ""}${c.points}`, c.description]) },
      secondary: { header: ["Policy rule", "Threshold", "Actual", "Status"], rows: score.policy.rules.map((r) => [r.name, r.threshold, String(r.actual ?? "—"), r.status.toUpperCase()]) } },
    { id: "pricing", title: "Pricing & structure", kind: "table", analyst_comment: comments.pricing ?? "",
      content: { header: ["Component", "bps", "Rationale"], rows: score.pricing.components.map((c) => [c.component, String(c.bps), c.rationale]) },
      secondary: { header: ["Sizing method", "Eligible", "Basis"], rows: score.loan_sizing.methods.map((m) => [`${m.method}${m.binding ? " (binding)" : ""}`, cr(m.limit / CR), m.basis]) } },
    { id: "conditions", title: "Terms, conditions & covenants", kind: "bullets", analyst_comment: comments.conditions ?? "",
      content: { summary: score.conditions.length ? "Recommended sanction conditions:" : "No sanction is recommended; conditions are not applicable.", bullets: score.conditions } },
    { id: "analyst", title: "Analyst field observations", kind: "bullets", analyst_comment: comments.analyst ?? "",
      content: { summary: `${b.notes.length} field observation(s) recorded and reflected in the score as overlays.`, bullets: b.notes.map((n) => `${n.body} (${n.impact >= 0 ? "+" : ""}${n.impact} pts)`) } },
  ];
  return { id: `cam-${b.key}`, version: 1, status: "draft", sections, analyst_comments: comments, narrative_provider: "local", created_at: ago(b.updatedHoursAgo), versions: [1] };
}

export function buildTimeline(b: DemoBorrower): TimelineEvent[] {
  const h = b.updatedHoursAgo;
  const events: TimelineEvent[] = [
    { type: "audit" as const, at: ago(h + 72), actor: "analyst@credx.demo", action: "case.created", summary: `Case opened for ${b.facility.facility_type} of ${cr(b.facility.requested / CR)}` },
    { type: "audit" as const, at: ago(h + 30), actor: "analyst@credx.demo", action: "documents.uploaded", summary: `${6 + b.litigation.length} documents uploaded` },
    { type: "job" as const, at: ago(h + 29.5), actor: null, action: "job.full_analysis", summary: "Full analysis completed in 41.2s" },
    ...b.notes.map((n) => ({ type: "note" as const, at: ago(n.daysAgo * 24), actor: userByName(n.author).email, action: "note.added", summary: n.body })),
    ...(b.status === "escalated" ? [{ type: "audit" as const, at: ago(h), actor: "analyst@credx.demo", action: "case.escalated", summary: "Escalated to credit committee" }] : []),
    ...(b.status === "approved" ? [{ type: "audit" as const, at: ago(h), actor: "manager@credx.demo", action: "case.decided", summary: "Final decision recorded: Approve" }] : []),
  ];
  return events.sort((a, z) => z.at.localeCompare(a.at));
}

export function buildOverview(b: DemoBorrower, ctx: { score: Score; research: Research; fraud: Fraud; docs: DocumentRecord[]; notes: Note[]; caseRecord: CreditCase }): CaseOverview {
  const { score, research, fraud, docs, notes, caseRecord } = ctx;
  return {
    company: caseRecord.company,
    case: { reference: caseRecord.reference, status: caseRecord.status },
    case_record: caseRecord,
    score, research,
    fraud: { fraud_score: fraud.fraud_score, risk_level: fraud.risk_level, summary: fraud.summary, alerts: fraud.alerts.map(({ id: _i, entities: _e, evidence: _v, score_impact: _s, ...rest }) => rest), gst_checks: fraud.gst_checks },
    facts: {
      bank: [{ bank: b.bank.bank, account: b.bank.account, monthly_credit: b.bank.monthlyCredit * CR, volatility: b.bank.volatility, bounces: b.bank.bounces }],
      gst: [{ gstr1: b.gst.gstr1 * CR, gstr3b: b.gst.gstr3b * CR, gstr2a: b.gst.gstr2a * CR, itc: b.gst.itc * CR, tax: b.gst.tax * CR }],
      legal: b.litigation,
      documents: docs.map((d) => ({ id: d.id, filename: d.filename, doc_type: d.doc_type ?? "unknown", confidence: d.extraction_confidence ?? 0 })),
      red_flags: b.redFlags.map((r) => ({ label: r.label, severity: r.severity, five_c: r.five_c, evidence: r.evidence, page: 42, filename: r.file })),
      positive_signals: b.positives,
      shareholding: b.shareholding,
    },
    notes: notes.map((n) => ({ id: n.id, body: n.body, effective_impact: n.impact_points, category: n.category, author: n.author?.full_name ?? null, created_at: n.created_at })),
    active_jobs: [],
    financials: Object.fromEntries(Object.entries(b.financials).map(([y, f]) => [y, Object.fromEntries(Object.entries(f).map(([k, v]) => [k, (v as number) * CR]))])),
    latest_cam_version: 1,
  };
}

export function buildDashboard(cases: CreditCase[], frauds: Record<string, Fraud | null>): Omit<DashboardSummary, "recent_activity"> {
  const scored = cases.filter((c) => c.latest_score != null);
  const count = <T extends string>(arr: T[]) => arr.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});
  return {
    totals: {
      cases: cases.length, scored: scored.length,
      avg_score: scored.length ? Math.round(scored.reduce((s, c) => s + (c.latest_score ?? 0), 0) / scored.length) : null,
      requested_exposure: cases.reduce((s, c) => s + c.requested_amount, 0),
      approved: cases.filter((c) => c.status === "approved").length,
      in_review: cases.filter((c) => c.status === "in_review").length,
      escalated: cases.filter((c) => c.status === "escalated").length,
      high_fraud: cases.filter((c) => (c.latest_fraud_score ?? 0) >= 50).length,
      companies: new Set(cases.map((c) => c.company.id)).size,
    },
    by_status: count(cases.map((c) => c.status)),
    by_risk: count(scored.map((c) => c.latest_risk_level ?? "LOW")),
    by_sector: count(cases.map((c) => c.company.sector ?? "other")),
    score_distribution: scored.map((c) => ({ reference: c.reference, company: c.company.name, score: c.latest_score!, fraud: c.latest_fraud_score, amount: c.requested_amount, risk: c.latest_risk_level! })),
    recent_cases: [...cases].sort((a, z) => z.updated_at.localeCompare(a.updated_at)).slice(0, 8).map((c) => ({ id: c.id, reference: c.reference, company: c.company.name, status: c.status, score: c.latest_score, risk: c.latest_risk_level, amount: c.requested_amount, updated_at: c.updated_at })),
    alerts: cases.flatMap((c) => (frauds[c.id]?.alerts ?? []).filter((a) => a.severity === "HIGH" || a.severity === "CRITICAL").map((a) => ({ id: a.id, case_id: c.id, company: c.company.name, title: a.title, severity: a.severity, alert_type: a.alert_type }))),
    ai_usage: [{ provider: "local", input_tokens: 0, output_tokens: 0, calls: 37 }, { provider: "anthropic", input_tokens: 182_400, output_tokens: 24_900, calls: 21 }],
    active_jobs: 0,
  };
}

export { PORTFOLIO };
