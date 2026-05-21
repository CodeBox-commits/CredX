import type { AnalysisSignal, UploadedFileMeta } from "./creditTypes";

export type ResearchNewsItem = {
  source: string;
  date: string;
  title: string;
  sentiment: "positive" | "neutral" | "negative";
  score: number;
};

export type ResearchNetworkNode = {
  name: string;
  type: "promoter" | "company" | "shell_suspect";
  connections: number;
};

export type ResearchTimelineEvent = {
  date: string;
  title: string;
  description: string;
  type: "financial" | "legal" | "regulatory" | "news";
};

export type WorkspaceInsight = {
  title: string;
  insight: string;
  severity: "info" | "warning" | "critical" | "positive";
  tags: string[];
};

export type FiveCMetric = {
  metric: "Character" | "Capacity" | "Capital" | "Collateral" | "Conditions";
  score: number;
  detail: string;
};

export type FeatureImportanceItem = {
  feature: string;
  importance: number;
  impact: "positive" | "negative";
};

export type RecommendationScenario = {
  label: string;
  amountCr: number;
  pd: number;
  riskScore: number;
};

export type Recommendation = {
  decision: "APPROVE" | "CONDITIONAL APPROVAL" | "REJECT";
  requestedAmountCr: number;
  recommendedAmountCr: number;
  rate: number;
  tenor: string;
  rationale: string;
  covenants: string[];
};

export type CreditModelFactor = {
  label: string;
  score: number;
  weight: number;
  impact: "positive" | "negative";
  detail: string;
};

export type PillarStatus = {
  name: "Data Ingestor" | "Research Agent" | "Recommendation Engine";
  status: "waiting" | "partial" | "ready";
  detail: string;
};

export type CreditModelSnapshot = {
  score: number;
  grade: string;
  readiness: number;
  parsedDocuments: number;
  totalDocuments: number;
  factors: CreditModelFactor[];
  pillars: PillarStatus[];
};

export type CamSection = {
  title: string;
  preview: string;
};

export type SourceCoverageItem = {
  label: string;
  sourceType: "structured" | "unstructured" | "external" | "primary";
  available: boolean;
  detail: string;
};

export type StructuredSynthesisItem = {
  label: string;
  value: string;
  status: "healthy" | "watch" | "risk" | "pending";
  explanation: string;
};

export type ResearchFinding = {
  category: "promoter" | "sector" | "regulatory" | "litigation" | "operations";
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
};

export type PrimaryAdjustment = {
  label: string;
  delta: number;
  reason: string;
};

export type DecisionTraceItem = {
  title: string;
  impact: "positive" | "negative";
  weight: number;
  detail: string;
};

export type MonitoringTrigger = {
  title: string;
  threshold: string;
  status: "active" | "watch" | "clear";
};

export type WorkspaceState = {
  companyName: string;
  cin: string;
  sector: string;
  facilityType: string;
  requestedAmountCr: number;
  dueDiligenceNote: string;
  documents: UploadedFileMeta[];
  topSignals: AnalysisSignal[];
  overallScore: number;
  riskLevel: "low" | "medium" | "high";
  researchNews: ResearchNewsItem[];
  networkNodes: ResearchNetworkNode[];
  timelineEvents: ResearchTimelineEvent[];
  aiInsights: WorkspaceInsight[];
  recommendation: Recommendation;
  scenarios: RecommendationScenario[];
  fiveCs: FiveCMetric[];
  featureImportance: FeatureImportanceItem[];
  creditModel: CreditModelSnapshot;
  camSections: CamSection[];
  sourceCoverage: SourceCoverageItem[];
  structuredSynthesis: StructuredSynthesisItem[];
  researchFindings: ResearchFinding[];
  primaryAdjustments: PrimaryAdjustment[];
  decisionTrace: DecisionTraceItem[];
  monitoringTriggers: MonitoringTrigger[];
  documentSummary: string;
};

type WorkspaceSourceState = {
  companyName: string;
  cin: string;
  sector: string;
  facilityType: string;
  requestedAmountCr: number;
  dueDiligenceNote: string;
  documents: UploadedFileMeta[];
};

const STORAGE_KEY = "credx-intelli-credit-workspace-v1";

const DEFAULT_SOURCE_STATE: WorkspaceSourceState = {
  companyName: "Adani Power Limited",
  cin: "U45209MH2008PLC123456",
  sector: "Infrastructure and Power",
  facilityType: "Term Loan",
  requestedAmountCr: 200,
  dueDiligenceNote:
    "Factory operating at 40% capacity. Significant inventory pile-up observed. Management explanation appears weaker than sector demand data.",
  documents: [],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rankSignal(left: AnalysisSignal, right: AnalysisSignal): number {
  const rank: Record<AnalysisSignal["severity"], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return rank[left.severity] - rank[right.severity];
}

function gradeFromScore(score: number): string {
  if (score >= 780) return "A";
  if (score >= 720) return "B";
  if (score >= 660) return "C";
  if (score >= 600) return "D";
  return "E";
}

function documentSearchText(document: UploadedFileMeta): string {
  return [
    document.document_type,
    document.parse_summary?.detected_document_type,
    document.original_filename,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasDocumentType(documents: UploadedFileMeta[], matcher: RegExp): boolean {
  return documents.some((document) => matcher.test(documentSearchText(document)));
}

function signalMatches(signal: AnalysisSignal, matcher: RegExp): boolean {
  return matcher.test(
    [signal.label, signal.detail, signal.excerpt ?? ""].join(" ").toLowerCase(),
  );
}

function aggregateSignals(documents: UploadedFileMeta[]): AnalysisSignal[] {
  const deduped = new Map<string, AnalysisSignal>();

  documents.forEach((document) => {
    (document.parse_summary?.signals ?? []).forEach((signal) => {
      const key = `${signal.label}-${signal.severity}`;
      if (!deduped.has(key)) {
        deduped.set(key, signal);
      }
    });
  });

  return Array.from(deduped.values()).sort(rankSignal).slice(0, 5);
}

function buildDocumentSummary(documents: UploadedFileMeta[], signals: AnalysisSignal[]): string {
  const parsedDocuments = documents.filter(
    (document) => document.parse_summary?.status === "parsed",
  );

  if (parsedDocuments.length === 0) {
    return "No uploaded documents yet. CredX is currently using the sample borrower profile for research and recommendation workflows.";
  }

  const firstSummary = parsedDocuments.find((document) => document.parse_summary?.summary)
    ?.parse_summary?.summary;
  if (firstSummary) return firstSummary;

  const leadSignal = signals[0]?.label ?? "No major signals detected";
  return `Analyzed ${parsedDocuments.length} document(s). Lead credit-review cue: ${leadSignal}.`;
}

function dueDiligencePenalty(note: string): number {
  const lowered = note.toLowerCase();
  let penalty = 0;

  if (lowered.includes("40% capacity") || lowered.includes("underutil")) penalty += 8;
  if (lowered.includes("inventory")) penalty += 4;
  if (lowered.includes("litigation") || lowered.includes("legal")) penalty += 5;
  if (lowered.includes("delayed") || lowered.includes("overdue")) penalty += 4;
  if (lowered.includes("strong order book") || lowered.includes("improved collections")) penalty -= 4;

  return penalty;
}

function buildSourceCoverage(source: WorkspaceSourceState): SourceCoverageItem[] {
  const parsedDocuments = source.documents.filter(
    (document) => document.parse_summary?.status === "parsed",
  ).length;

  return [
    {
      label: "GST filings",
      sourceType: "structured",
      available: hasDocumentType(source.documents, /gst return|gstr|goods and services tax/i),
      detail: "Used for turnover validation, GSTR-2A/3B reconciliation, and tax-compliance review.",
    },
    {
      label: "Bank statements",
      sourceType: "structured",
      available: hasDocumentType(source.documents, /bank statement|account statement/i),
      detail: "Used to compare cash realization trends and identify potential circular trading cues.",
    },
    {
      label: "ITR and tax audit",
      sourceType: "structured",
      available: hasDocumentType(source.documents, /itr|income tax return|tax audit|form 3cd/i),
      detail: "Supports profitability, tax discipline, and reported-income cross-checks.",
    },
    {
      label: "Annual and financial reports",
      sourceType: "unstructured",
      available: hasDocumentType(source.documents, /annual report|financial statement|balance sheet/i),
      detail: "Used for management commentary, leverage trends, and disclosure-based risk extraction.",
    },
    {
      label: "Board, shareholding, or rating reports",
      sourceType: "unstructured",
      available: hasDocumentType(
        source.documents,
        /board meeting|board minutes|shareholding|rating agency|credit rating|crisil|icra|care/i,
      ),
      detail: "Adds governance, promoter, and external-rating context to the case file.",
    },
    {
      label: "Legal and sanction documents",
      sourceType: "unstructured",
      available: hasDocumentType(
        source.documents,
        /legal notice|sanction letter|court|litigation|nclt|arbitration/i,
      ),
      detail: "Captures lender covenants, legal recovery actions, and historical borrowing terms.",
    },
    {
      label: "Secondary research stack",
      sourceType: "external",
      available: parsedDocuments > 0,
      detail: "News, MCA-linked context, regulatory watch items, and litigation screening are refreshed after ingestion.",
    },
    {
      label: "Primary due-diligence notes",
      sourceType: "primary",
      available: source.dueDiligenceNote.trim().length > 0,
      detail: "Site visits and management-interview notes directly modify the operating-risk assessment.",
    },
  ];
}

function buildPrimaryAdjustments(note: string): PrimaryAdjustment[] {
  const normalized = note.trim().toLowerCase();
  if (!normalized) return [];

  const rules: Array<{
    label: string;
    delta: number;
    reason: string;
    matcher: RegExp;
  }> = [
    {
      label: "Factory utilization below plan",
      delta: -8,
      reason: "Observed plant utilization suggests weaker throughput than sanctioned capacity assumptions.",
      matcher: /40% capacity|underutil|utili[sz]ation.*below|capacity.*40%/i,
    },
    {
      label: "Inventory build-up",
      delta: -4,
      reason: "Inventory pile-up may signal weak sell-through, blocked working capital, or revenue-quality concerns.",
      matcher: /inventory|pile-?up|stock accumulation|finished goods/i,
    },
    {
      label: "Collections or payment stretch",
      delta: -5,
      reason: "Delayed collections or overdue cues weaken cash-conversion confidence.",
      matcher: /delayed|overdue|stretch(ed)? receivable|slow collections/i,
    },
    {
      label: "Legal escalation from field checks",
      delta: -6,
      reason: "Primary diligence referenced litigation or legal escalation beyond the uploaded documents.",
      matcher: /litigation|legal|court|dispute/i,
    },
    {
      label: "Improving order book or collections",
      delta: 4,
      reason: "Positive field feedback offsets some downside if order visibility or collections are improving.",
      matcher: /strong order book|improved collections|order inflow|healthy demand/i,
    },
  ];

  const adjustments = rules.filter((rule) => rule.matcher.test(normalized)).map((rule) => ({
    label: rule.label,
    delta: rule.delta,
    reason: rule.reason,
  }));

  if (adjustments.length > 0) return adjustments;

  return [
    {
      label: "Management note captured",
      delta: 0,
      reason: "Primary diligence has been captured and is available for the credit committee narrative.",
    },
  ];
}

function buildStructuredSynthesis(
  source: WorkspaceSourceState,
  signals: AnalysisSignal[],
  creditModel: CreditModelSnapshot,
  sourceCoverage: SourceCoverageItem[],
): StructuredSynthesisItem[] {
  const highRiskSignals = signals.filter((signal) => signal.severity === "high").length;
  const mediumRiskSignals = signals.filter((signal) => signal.severity === "medium").length;
  const duePenalty = dueDiligencePenalty(source.dueDiligenceNote);
  const gstAvailable = sourceCoverage.some(
    (item) => item.label === "GST filings" && item.available,
  );
  const bankAvailable = sourceCoverage.some(
    (item) => item.label === "Bank statements" && item.available,
  );
  const itrAvailable = sourceCoverage.some(
    (item) => item.label === "ITR and tax audit" && item.available,
  );
  const governanceAvailable = sourceCoverage.some(
    (item) => item.label === "Board, shareholding, or rating reports" && item.available,
  );
  const hasRelatedParty = signals.some((signal) =>
    signalMatches(signal, /related-party|promoter-linked|group entit/i),
  );

  const sourceCount = sourceCoverage.filter((item) => item.available).length;
  const gstVariance =
    gstAvailable && bankAvailable
      ? Number(clamp(0.8 + highRiskSignals * 0.75 + mediumRiskSignals * 0.35 + duePenalty * 0.08, 0.4, 4.8).toFixed(1))
      : null;
  const gstVarianceStatus: StructuredSynthesisItem["status"] =
    gstVariance === null
      ? "pending"
      : gstVariance < 1.2
        ? "healthy"
        : gstVariance < 2.4
          ? "watch"
          : "risk";

  const cashAlignment =
    gstAvailable && bankAvailable
      ? Math.round(clamp(95 - highRiskSignals * 8 - mediumRiskSignals * 4 - duePenalty, 52, 98))
      : null;
  const cashAlignmentStatus: StructuredSynthesisItem["status"] =
    cashAlignment === null
      ? "pending"
      : cashAlignment >= 88
        ? "healthy"
        : cashAlignment >= 74
          ? "watch"
          : "risk";

  const circularTradingScore =
    gstAvailable && bankAvailable
      ? Math.round(clamp(18 + highRiskSignals * 18 + mediumRiskSignals * 10 + (hasRelatedParty ? 16 : 0), 8, 92))
      : null;
  const circularTradingStatus: StructuredSynthesisItem["status"] =
    circularTradingScore === null
      ? "pending"
      : circularTradingScore <= 30
        ? "healthy"
        : circularTradingScore <= 60
          ? "watch"
          : "risk";

  const evidenceCoverageStatus: StructuredSynthesisItem["status"] =
    sourceCount >= 6
      ? "healthy"
      : sourceCount >= 4
        ? "watch"
        : "risk";

  return [
    {
      label: "GSTR-2A vs 3B variance proxy",
      value: gstVariance === null ? "Pending GST and bank evidence" : `${gstVariance}% mismatch`,
      status: gstVarianceStatus,
      explanation:
        gstVariance === null
          ? "Upload both GST returns and bank statements to quantify a stronger reconciliation view."
          : "Higher mismatch suggests possible revenue-quality stress or delayed invoice settlement that warrants review.",
    },
    {
      label: "GST turnover to bank-credit alignment",
      value: cashAlignment === null ? "Pending structured inputs" : `${cashAlignment}% aligned`,
      status: cashAlignmentStatus,
      explanation:
        cashAlignment === null
          ? "Cash-realization checks need both GST and bank evidence in the same case file."
          : "Lower alignment can signal delayed collections, routing noise, or turnover inflation risk.",
    },
    {
      label: "Circular-trading watch score",
      value:
        circularTradingScore === null
          ? "Insufficient evidence"
          : circularTradingScore >= 61
            ? `High (${circularTradingScore}/100)`
            : circularTradingScore >= 31
              ? `Moderate (${circularTradingScore}/100)`
              : `Low (${circularTradingScore}/100)`,
      status: circularTradingStatus,
      explanation:
        circularTradingScore === null
          ? "The prototype waits for GST and bank inputs before estimating circular-flow risk."
          : "Promoter-linked counterparties, weak cash alignment, and dense risk signals raise this watch score.",
    },
    {
      label: "Underwriting evidence coverage",
      value: `${sourceCount}/${sourceCoverage.length} source lanes available`,
      status: evidenceCoverageStatus,
      explanation: `Current model readiness is ${creditModel.readiness}%. The case is strongest when structured, unstructured, external, and primary inputs are all represented.`,
    },
    {
      label: "Tax and governance comfort",
      value:
        itrAvailable && governanceAvailable
          ? "Dual validation available"
          : itrAvailable || governanceAvailable
            ? "Partial governance stack"
            : "Limited governance evidence",
      status:
        itrAvailable && governanceAvailable
          ? "healthy"
          : itrAvailable || governanceAvailable
            ? "watch"
            : "risk",
      explanation:
        "ITR, rating, board, and shareholding inputs improve explainability around promoter quality and disclosure discipline.",
    },
  ];
}

function buildResearchFindings(
  source: WorkspaceSourceState,
  signals: AnalysisSignal[],
  riskLevel: WorkspaceState["riskLevel"],
  primaryAdjustments: PrimaryAdjustment[],
): ResearchFinding[] {
  const hasLitigation = signals.some((signal) =>
    signalMatches(signal, /litigation|insolvency|nclt|legal proceedings/i),
  );
  const hasRelatedParty = signals.some((signal) =>
    signalMatches(signal, /related-party|promoter-linked|group entit/i),
  );
  const negativePrimaryAdjustment = primaryAdjustments.find((adjustment) => adjustment.delta < 0);

  return [
    {
      category: "promoter",
      title: hasRelatedParty
        ? "Promoter-linked relationships need UBO review"
        : "Promoter network appears monitorable",
      detail: hasRelatedParty
        ? "Secondary research should validate related-party exposures, common directors, and group-company cash flows."
        : "No strong promoter-network stress cue is leading the file, but MCA and charge filings should still be checked.",
      severity: hasRelatedParty ? "high" : "low",
    },
    {
      category: "sector",
      title: `${source.sector} underwriting remains selective`,
      detail:
        riskLevel === "high"
          ? `Sector posture is defensive for ${source.sector.toLowerCase()} borrowers, so downside resilience matters more than headline growth.`
          : `Sector conditions are manageable, but margin pressure and working-capital discipline remain core watch areas for ${source.sector.toLowerCase()}.`,
      severity: riskLevel === "high" ? "high" : "medium",
    },
    {
      category: "regulatory",
      title: "RBI, GST, and MCA overlays should stay in the case trail",
      detail:
        "The prototype assumes regulatory change, statutory filings, and public-record updates are rechecked before sanction and disbursement.",
      severity: "medium",
    },
    {
      category: "litigation",
      title: hasLitigation ? "Litigation screening changed the risk posture" : "No dominant litigation headline found",
      detail: hasLitigation
        ? "Legal-process language is present in the evidence set, so e-Courts and charge filings should be refreshed before committee sign-off."
        : "Litigation is not the lead driver right now, but the borrower should remain on a legal-watch refresh cycle.",
      severity: hasLitigation ? "high" : "low",
    },
    {
      category: "operations",
      title: negativePrimaryAdjustment
        ? "Primary diligence surfaced operational caution"
        : "Primary diligence can still tighten confidence bands",
      detail: negativePrimaryAdjustment
        ? negativePrimaryAdjustment.reason
        : "Site visits and management interviews are available as a direct override layer for the recommendation engine.",
      severity: negativePrimaryAdjustment ? "high" : "medium",
    },
  ];
}

function buildDecisionTrace(
  signals: AnalysisSignal[],
  creditModel: CreditModelSnapshot,
  primaryAdjustments: PrimaryAdjustment[],
): DecisionTraceItem[] {
  const factorItems: DecisionTraceItem[] = creditModel.factors.map((factor) => ({
    title: factor.label,
    impact: factor.impact,
    weight: clamp(Math.round(Math.abs(factor.score - 70) + factor.weight * 2), 36, 92),
    detail: factor.detail,
  }));

  const signalItems: DecisionTraceItem[] = signals.slice(0, 2).map((signal) => ({
    title: signal.label,
    impact: signal.severity === "low" ? "positive" : "negative",
    weight: signal.severity === "high" ? 90 : signal.severity === "medium" ? 76 : 58,
    detail: signal.detail,
  }));

  const primaryItems: DecisionTraceItem[] = primaryAdjustments
    .filter((adjustment) => adjustment.delta !== 0)
    .map((adjustment) => ({
      title: adjustment.label,
      impact: adjustment.delta > 0 ? "positive" : "negative",
      weight: clamp(Math.abs(adjustment.delta) * 8 + 32, 40, 88),
      detail: adjustment.reason,
    }));

  return [...signalItems, ...primaryItems, ...factorItems]
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 5);
}

function buildMonitoringTriggers(
  structuredSynthesis: StructuredSynthesisItem[],
  signals: AnalysisSignal[],
  primaryAdjustments: PrimaryAdjustment[],
): MonitoringTrigger[] {
  const gstVariance = structuredSynthesis.find((item) =>
    item.label.includes("GSTR-2A vs 3B"),
  );
  const cashAlignment = structuredSynthesis.find((item) =>
    item.label.includes("GST turnover to bank-credit alignment"),
  );
  const capacityAdjustment = primaryAdjustments.find((item) =>
    item.label.includes("Factory utilization"),
  );
  const litigationSignal = signals.find((signal) =>
    signalMatches(signal, /litigation|insolvency|nclt|legal proceedings/i),
  );

  return [
    {
      title: "Monthly GST reconciliation drift",
      threshold: "Escalate if variance exceeds 2.0%",
      status:
        gstVariance?.status === "risk"
          ? "active"
          : gstVariance?.status === "watch"
            ? "watch"
            : "clear",
    },
    {
      title: "Bank-credit realization falls below trend",
      threshold: "Monitor if alignment slips below 80%",
      status:
        cashAlignment?.status === "risk"
          ? "active"
          : cashAlignment?.status === "watch"
            ? "watch"
            : "clear",
    },
    {
      title: "Factory utilization remains below 60%",
      threshold: "Revisit sanctions if field checks stay weak for 2 quarters",
      status: capacityAdjustment && capacityAdjustment.delta < 0 ? "active" : "clear",
    },
    {
      title: "New legal filing or lender recovery action",
      threshold: "Any new court, NCLT, or arbitration event",
      status: litigationSignal ? "active" : "watch",
    },
  ];
}

function buildCreditModel(
  source: WorkspaceSourceState,
  signals: AnalysisSignal[],
): CreditModelSnapshot {
  const parsedDocuments = source.documents.filter(
    (document) => document.parse_summary?.status === "parsed",
  ).length;
  const totalDocuments = source.documents.length;
  const parsedRatio =
    totalDocuments === 0 ? 0 : parsedDocuments / Math.max(totalDocuments, 1);
  const annualReportPresent = hasDocumentType(source.documents, /annual report/i);
  const bankStatementPresent = hasDocumentType(source.documents, /bank statement/i);
  const gstReturnPresent = hasDocumentType(source.documents, /gst return|gstr|goods and services tax/i);
  const itrPresent = hasDocumentType(source.documents, /itr|income tax return|tax audit|form 3cd/i);
  const ratingReportPresent = hasDocumentType(
    source.documents,
    /rating agency|credit rating|crisil|icra|care/i,
  );
  const governanceDocsPresent = hasDocumentType(
    source.documents,
    /board meeting|board minutes|shareholding|shareholding pattern/i,
  );
  const legalDocPresent = hasDocumentType(
    source.documents,
    /legal notice|sanction letter|court|nclt|arbitration/i,
  );
  const structuredDocumentCount = [
    gstReturnPresent,
    bankStatementPresent,
    itrPresent,
  ].filter(Boolean).length;
  const unstructuredDocumentCount = [
    annualReportPresent,
    ratingReportPresent,
    governanceDocsPresent,
    legalDocPresent,
  ].filter(Boolean).length;
  const coreDocumentCount = [
    annualReportPresent,
    bankStatementPresent,
    gstReturnPresent,
    itrPresent,
  ].filter(Boolean).length;
  const duePenalty = dueDiligencePenalty(source.dueDiligenceNote);
  const highRiskSignals = signals.filter((signal) => signal.severity === "high").length;
  const mediumRiskSignals = signals.filter((signal) => signal.severity === "medium").length;
  const hasDefault = signals.some((signal) =>
    signalMatches(signal, /default|overdue|delay(?:ed)? payment|non[- ]performing/i),
  );
  const hasLitigation = signals.some((signal) =>
    signalMatches(signal, /litigation|insolvency|nclt|legal proceedings/i),
  );
  const hasRelatedParty = signals.some((signal) =>
    signalMatches(signal, /related-party|promoter-linked|group entit/i),
  );
  const hasLiquidityStress = signals.some((signal) =>
    signalMatches(signal, /liquidity|cash flow|working capital|cash loss/i),
  );
  const hasAuditConcern = signals.some((signal) =>
    signalMatches(signal, /audit|qualified opinion|going concern|material weakness/i),
  );
  const lowExtractionCoverage = signals.some((signal) =>
    signalMatches(signal, /low extraction coverage|limited text/i),
  );

  const coverageScore = clamp(
    34 +
      structuredDocumentCount * 15 +
      unstructuredDocumentCount * 7 +
      Math.round(parsedRatio * 22) +
      Math.min(totalDocuments, 6) * 3,
    25,
    92,
  );
  const repaymentBehaviorScore = clamp(
    82 -
      (hasDefault ? 22 : 0) -
      (hasLiquidityStress ? 11 : 0) -
      highRiskSignals * 4 +
      (bankStatementPresent ? 5 : -4),
    24,
    92,
  );
  const complianceLegalScore = clamp(
    79 -
      (hasLitigation ? 18 : 0) -
      (hasAuditConcern ? 8 : 0) -
      (lowExtractionCoverage ? 6 : 0) +
      (gstReturnPresent ? 6 : -4) +
      (itrPresent ? 4 : -3),
    22,
    90,
  );
  const governanceScore = clamp(
    76 -
      (hasRelatedParty ? 17 : 0) -
      (hasAuditConcern ? 8 : 0) -
      mediumRiskSignals * 2 +
      (annualReportPresent ? 4 : 0) +
      (governanceDocsPresent ? 6 : -2),
    28,
    90,
  );
  const operatingResilienceScore = clamp(
    74 -
      duePenalty * 2 -
      (hasLiquidityStress ? 12 : 0) -
      highRiskSignals * 3 +
      (parsedDocuments >= 2 ? 4 : 0),
    20,
    88,
  );
  const structuringSupportScore = clamp(
    78 -
      highRiskSignals * 6 -
      Math.max(0, source.requestedAmountCr - 180) / 12 +
      coreDocumentCount * 3 +
      (ratingReportPresent ? 4 : 0),
    26,
    90,
  );

  const factors: CreditModelFactor[] = [
    {
      label: "Document coverage",
      score: coverageScore,
      weight: 20,
      impact: coverageScore >= 70 ? "positive" : "negative",
      detail: `Parsed ${parsedDocuments}/${totalDocuments} uploaded file(s). Structured coverage is ${structuredDocumentCount}/3 for GST, bank statements, and ITRs, while unstructured coverage is ${unstructuredDocumentCount}/4 across annual, legal, governance, and rating inputs.`,
    },
    {
      label: "Repayment behavior",
      score: repaymentBehaviorScore,
      weight: 24,
      impact: repaymentBehaviorScore >= 70 ? "positive" : "negative",
      detail: hasDefault
        ? "Default or overdue language is weighing on repayment comfort."
        : "Repayment behavior remains manageable based on the currently ingested file set.",
    },
    {
      label: "Compliance and legal",
      score: complianceLegalScore,
      weight: 18,
      impact: complianceLegalScore >= 70 ? "positive" : "negative",
      detail: hasLitigation
        ? "Litigation or legal-process language is directly reducing sanction comfort."
        : "Compliance posture is acceptable, though continuing review of legal and tax cues is recommended.",
    },
    {
      label: "Governance quality",
      score: governanceScore,
      weight: 14,
      impact: governanceScore >= 70 ? "positive" : "negative",
      detail: hasRelatedParty
        ? "Promoter-linked or related-party exposure requires tighter governance checks."
        : governanceDocsPresent
          ? "Governance stack includes board/shareholding-style evidence and remains within a monitorable band."
          : "Governance signals remain within a monitorable band, but richer board/shareholding evidence would improve explainability.",
    },
    {
      label: "Operating resilience",
      score: operatingResilienceScore,
      weight: 14,
      impact: operatingResilienceScore >= 70 ? "positive" : "negative",
      detail: source.dueDiligenceNote.trim()
        ? "Primary due-diligence notes are being applied directly to the operating-resilience factor."
        : "Operating resilience is derived from financial document signals without a primary-note override.",
    },
    {
      label: "Collateral and structuring",
      score: structuringSupportScore,
      weight: 10,
      impact: structuringSupportScore >= 70 ? "positive" : "negative",
      detail: "Facility sizing, coverage of core documents, and risk-signal density shape the structure recommendation.",
    },
  ];

  const weightTotal = factors.reduce((total, factor) => total + factor.weight, 0);
  const weightedFactorScore = Math.round(
    factors.reduce((total, factor) => total + factor.score * factor.weight, 0) /
      weightTotal,
  );
  const score = clamp(Math.round(300 + weightedFactorScore * 6), 300, 900);
  const readiness = clamp(
    Math.round(coverageScore * 0.55 + parsedRatio * 30 + (coreDocumentCount / 3) * 15),
    0,
    100,
  );

  const pillars: PillarStatus[] = [
    {
      name: "Data Ingestor",
      status: parsedDocuments > 0 ? "ready" : totalDocuments > 0 ? "partial" : "waiting",
      detail:
        parsedDocuments > 0
          ? `${parsedDocuments} document(s) parsed and normalized for downstream credit analysis.`
          : totalDocuments > 0
            ? "Files were uploaded, but extraction coverage is still weak and needs review."
            : "Waiting for source documents to begin ingestion.",
    },
    {
      name: "Research Agent",
      status: parsedDocuments > 0 ? "ready" : totalDocuments > 0 ? "partial" : "waiting",
      detail:
        parsedDocuments > 0
          ? "Secondary research cues and borrower watch-items have been refreshed from the ingested evidence."
          : totalDocuments > 0
            ? "Research can start, but limited extracted evidence reduces confidence."
            : "Research agent will activate automatically after document ingestion.",
    },
    {
      name: "Recommendation Engine",
      status:
        parsedDocuments > 0 && readiness >= 60
          ? "ready"
          : totalDocuments > 0
            ? "partial"
            : "waiting",
      detail:
        parsedDocuments > 0 && readiness >= 60
          ? `Credit score ${score}/900 (${gradeFromScore(score)}) and CAM sections are ready from the same run.`
          : totalDocuments > 0
            ? "A recommendation is available, but more document coverage would improve confidence."
            : "Recommendation engine is waiting for ingested evidence.",
    },
  ];

  return {
    score,
    grade: gradeFromScore(score),
    readiness,
    parsedDocuments,
    totalDocuments,
    factors,
    pillars,
  };
}

function riskLevelFromScore(score: number): WorkspaceState["riskLevel"] {
  if (score >= 720) return "low";
  if (score >= 620) return "medium";
  return "high";
}

function buildRecommendation(
  source: WorkspaceSourceState,
  signals: AnalysisSignal[],
  creditModel: CreditModelSnapshot,
): Recommendation {
  const overallScore = creditModel.score;
  const riskLevel = riskLevelFromScore(overallScore);
  const requested = source.requestedAmountCr;
  const highRiskSignals = signals.filter((signal) => signal.severity === "high").length;
  const mediumRiskSignals = signals.filter((signal) => signal.severity === "medium").length;
  const coverageScore =
    creditModel.factors.find((factor) => factor.label === "Document coverage")?.score ?? 60;
  const structuringSupportScore =
    creditModel.factors.find((factor) => factor.label === "Collateral and structuring")?.score ??
    65;
  const readinessFactor = creditModel.readiness / 100;

  const recommendationFactor = clamp(
    0.3 +
      readinessFactor * 0.25 +
      coverageScore / 220 +
      structuringSupportScore / 260 -
      highRiskSignals * 0.12 -
      mediumRiskSignals * 0.05,
    riskLevel === "high" ? 0.18 : 0.35,
    0.9,
  );
  const recommendedAmountCr = clamp(
    Math.round(requested * recommendationFactor / 10) * 10,
    riskLevel === "high" ? 40 : 80,
    requested,
  );

  const rate = Number(
    (
      9.95 +
      highRiskSignals * 0.95 +
      mediumRiskSignals * 0.4 +
      (100 - structuringSupportScore) / 55 +
      (100 - coverageScore) / 90
    ).toFixed(1),
  );
  const decision =
    overallScore >= 750 && creditModel.readiness >= 65
      ? "APPROVE"
      : overallScore >= 620
        ? "CONDITIONAL APPROVAL"
        : "REJECT";

  const leadSignal = signals[0]?.label ?? "portfolio watch items";
  const rationale =
    decision === "APPROVE"
      ? `Approval is supported by a ${creditModel.grade}-grade credit model output, strong enough document coverage, and manageable downside despite review cue: ${leadSignal}.`
      : decision === "CONDITIONAL APPROVAL"
        ? `Exposure is reduced because the current review profile is led by ${leadSignal.toLowerCase()}, while document readiness is ${creditModel.readiness}%. Monitoring, covenants, and tighter structuring support a conditional approval.`
        : `Recommendation trends toward rejection because ${leadSignal.toLowerCase()} materially weakens near-term credit comfort and the current three-pillar evidence base does not justify the requested exposure.`;

  const covenants = [
    "Quarterly financial reporting and lender review.",
    "Maintain DSCR above 1.30x for the sanctioned tenor.",
    "No increase in promoter pledge without lender consent.",
  ];

  if (creditModel.readiness < 70) {
    covenants.push("Submit missing core underwriting documents before first disbursement.");
  }

  if (source.dueDiligenceNote.trim()) {
    covenants.push("Submit management response to due-diligence observations within 30 days.");
  }

  return {
    decision,
    requestedAmountCr: requested,
    recommendedAmountCr,
    rate,
    tenor: "5 years with 6-month moratorium",
    rationale,
    covenants,
  };
}

function buildScenarios(recommendation: Recommendation, overallScore: number): RecommendationScenario[] {
  const moderateAmount = recommendation.recommendedAmountCr;
  const conservativeAmount = Math.max(40, moderateAmount - 40);
  const aggressiveAmount = Math.max(moderateAmount, recommendation.requestedAmountCr);
  const basePd = clamp(Number(((900 - overallScore) / 75).toFixed(1)), 2.1, 12.9);

  return [
    {
      label: "Conservative",
      amountCr: conservativeAmount,
      pd: Number(Math.max(1.8, basePd - 2.2).toFixed(1)),
      riskScore: clamp(Math.round((overallScore - 300) / 6.2) + 8, 35, 92),
    },
    {
      label: "Moderate",
      amountCr: moderateAmount,
      pd: Number(basePd.toFixed(1)),
      riskScore: clamp(Math.round((overallScore - 300) / 6.2), 30, 88),
    },
    {
      label: "Aggressive",
      amountCr: aggressiveAmount,
      pd: Number(Math.min(18.5, basePd + 4.1).toFixed(1)),
      riskScore: clamp(Math.round((overallScore - 300) / 6.2) - 14, 20, 78),
    },
  ];
}

function buildFiveCs(
  source: WorkspaceSourceState,
  signals: AnalysisSignal[],
  overallScore: number,
): FiveCMetric[] {
  const hasLitigation = signals.some((signal) => signal.label.includes("Litigation"));
  const hasLiquidity = signals.some((signal) => signal.label.includes("liquidity"));
  const hasRelatedParty = signals.some((signal) => signal.label.includes("Related-party"));
  const notePenalty = dueDiligencePenalty(source.dueDiligenceNote);
  const base = Math.round((overallScore - 300) / 6);

  return [
    {
      metric: "Character",
      score: clamp(base - (hasRelatedParty ? 14 : 4), 35, 88),
      detail: hasRelatedParty
        ? "Promoter-linked or related-party exposure needs closer governance review."
        : "Promoter background appears manageable with routine monitoring.",
    },
    {
      metric: "Capacity",
      score: clamp(base - notePenalty - (hasLiquidity ? 12 : 5), 28, 86),
      detail:
        "Capacity reflects operating performance, DSCR comfort, and due-diligence observations.",
    },
    {
      metric: "Capital",
      score: clamp(base + 6, 40, 90),
      detail:
        "Capital profile reflects leverage tolerance and support available from the business base.",
    },
    {
      metric: "Collateral",
      score: clamp(base + 12, 48, 92),
      detail:
        "Collateral remains the strongest mitigant in the current prototype assessment.",
    },
    {
      metric: "Conditions",
      score: clamp(base - (hasLitigation ? 12 : 6), 25, 84),
      detail:
        "Conditions reflect sector stress, regulatory posture, and macro headwinds relevant to sanctioning.",
    },
  ];
}

function buildFeatureImportance(
  signals: AnalysisSignal[],
  fiveCs: FiveCMetric[],
  creditModel: CreditModelSnapshot,
): FeatureImportanceItem[] {
  const items: FeatureImportanceItem[] = [];

  creditModel.factors.forEach((factor) => {
    items.push({
      feature: factor.label,
      importance: clamp(
        Math.round(Math.abs(factor.score - 70) + factor.weight * 2.1),
        40,
        92,
      ),
      impact: factor.impact,
    });
  });

  signals.forEach((signal, index) => {
    items.push({
      feature: signal.label,
      importance: clamp(90 - index * 11, 42, 92),
      impact: signal.severity === "low" ? "positive" : "negative",
    });
  });

  fiveCs.forEach((metric) => {
    items.push({
      feature: `${metric.metric} Score`,
      importance: clamp(metric.score, 40, 88),
      impact: metric.score >= 68 ? "positive" : "negative",
    });
  });

  return items
    .sort((left, right) => right.importance - left.importance)
    .slice(0, 8);
}

function buildResearchNews(
  source: WorkspaceSourceState,
  signals: AnalysisSignal[],
  riskLevel: WorkspaceState["riskLevel"],
): ResearchNewsItem[] {
  const company = source.companyName;
  const sector = source.sector;
  const hasLitigation = signals.some((signal) => signal.label.includes("Litigation"));
  const hasRelatedParty = signals.some((signal) => signal.label.includes("Related-party"));

  return [
    {
      source: "Economic Times",
      date: "2025-12-14",
      title: `${company} faces tighter review as lenders reassess ${sector.toLowerCase()} exposure.`,
      sentiment: riskLevel === "high" ? "negative" : "neutral",
      score: riskLevel === "high" ? -0.74 : -0.18,
    },
    {
      source: "Business Standard",
      date: "2025-12-10",
      title: `${sector} outlook remains selective amid margin pressure and policy monitoring.`,
      sentiment: "negative",
      score: -0.46,
    },
    {
      source: "Mint",
      date: "2025-12-05",
      title: `${company} continues to pursue new contracts despite tighter underwriting filters.`,
      sentiment: "positive",
      score: 0.42,
    },
    {
      source: "Reuters",
      date: "2025-11-28",
      title: hasLitigation
        ? `Litigation-linked borrowers in ${sector.toLowerCase()} draw sharper attention from credit committees.`
        : `Banks continue to monitor sector-specific NPA trends for ${sector.toLowerCase()} borrowers.`,
      sentiment: "negative",
      score: hasLitigation ? -0.61 : -0.39,
    },
    {
      source: "LiveMint",
      date: "2025-11-20",
      title: hasRelatedParty
        ? "Promoter-linked entity relationships remain a focus area in recent due-diligence reviews."
        : "Market participants remain focused on covenant strength and disclosure quality.",
      sentiment: hasRelatedParty ? "negative" : "neutral",
      score: hasRelatedParty ? -0.28 : -0.08,
    },
  ];
}

function buildNetworkNodes(
  source: WorkspaceSourceState,
  signals: AnalysisSignal[],
): ResearchNetworkNode[] {
  const hasRelatedParty = signals.some((signal) => signal.label.includes("Related-party"));

  return [
    { name: "Rajesh Kumar (MD)", type: "promoter", connections: 5 },
    { name: "Alpha Holdings Pvt Ltd", type: "company", connections: 3 },
    { name: source.companyName, type: "company", connections: 6 },
    { name: "Sunita Kumar (Director)", type: "promoter", connections: 4 },
    {
      name: hasRelatedParty ? "Gamma Trading Co" : "Vendor Counterparty",
      type: hasRelatedParty ? "shell_suspect" : "company",
      connections: hasRelatedParty ? 1 : 2,
    },
    { name: "Delta Constructions", type: "company", connections: 2 },
    { name: "Epsilon Finance Ltd", type: "company", connections: 3 },
    { name: "Priya Sharma (Director)", type: "promoter", connections: 2 },
  ];
}

function buildTimelineEvents(
  signals: AnalysisSignal[],
  recommendation: Recommendation,
): ResearchTimelineEvent[] {
  const hasLitigation = signals.some((signal) => signal.label.includes("Litigation"));
  const hasAuditConcern = signals.some((signal) => signal.label.includes("audit"));

  return [
    {
      date: "2025-12",
      title: recommendation.decision === "REJECT" ? "Credit committee escalates file" : "Credit review refreshed",
      description: recommendation.rationale,
      type: "financial",
    },
    {
      date: "2025-11",
      title: hasLitigation ? "Litigation review intensified" : "Sector watchlist updated",
      description: hasLitigation
        ? "Secondary research surfaced legal proceedings that now influence sanction comfort."
        : "Sector and macro conditions were refreshed in the underwriting workflow.",
      type: hasLitigation ? "legal" : "news",
    },
    {
      date: "2025-10",
      title: hasAuditConcern ? "Audit qualification noted" : "Disclosure quality reviewed",
      description: hasAuditConcern
        ? "Audit commentary is being treated as a medium-priority monitoring signal."
        : "Financial disclosures were reviewed for consistency across submitted files.",
      type: "regulatory",
    },
    {
      date: "2025-09",
      title: "Document ingestion completed",
      description: "The data-ingestor completed parsing and surfaced key risk cues for downstream research.",
      type: "financial",
    },
  ];
}

function buildAiInsights(
  source: WorkspaceSourceState,
  signals: AnalysisSignal[],
  recommendation: Recommendation,
  riskLevel: WorkspaceState["riskLevel"],
  creditModel: CreditModelSnapshot,
  structuredSynthesis: StructuredSynthesisItem[],
): WorkspaceInsight[] {
  const leadSignal = signals[0];
  const dueDiligenceText = source.dueDiligenceNote.trim();
  const synthesisLead =
    structuredSynthesis.find((item) => item.status === "risk") ??
    structuredSynthesis.find((item) => item.status === "watch");

  const insights: WorkspaceInsight[] = [];

  if (leadSignal) {
    insights.push({
      title: leadSignal.label,
      insight: `${leadSignal.detail} This is currently the top driver behind the ${riskLevel} risk posture.`,
      severity: leadSignal.severity === "high" ? "critical" : "warning",
      tags: ["SIGNAL", riskLevel.toUpperCase()],
    });
  }

  if (synthesisLead) {
    insights.push({
      title: "Structured Synthesis Check",
      insight: `${synthesisLead.label}: ${synthesisLead.value}. ${synthesisLead.explanation}`,
      severity: synthesisLead.status === "risk" ? "critical" : "warning",
      tags: ["GST", "BANK", "SYNTHESIS"],
    });
  }

  insights.push({
    title: "Three-Pillar Sync",
    insight: `${creditModel.parsedDocuments} parsed document(s) pushed into research, credit scoring, and CAM generation together. Current model readiness is ${creditModel.readiness}% with grade ${creditModel.grade}.`,
    severity: creditModel.readiness >= 65 ? "positive" : "warning",
    tags: ["PIPELINE", "SYNC", `GRADE ${creditModel.grade}`],
  });

  if (dueDiligenceText) {
    insights.push({
      title: "Primary Insight Integration",
      insight: `Credit officer note captured: "${dueDiligenceText}" This observation is being factored into the recommendation engine.`,
      severity: "warning",
      tags: ["SITE VISIT", "PRIMARY INPUT"],
    });
  }

  insights.push({
    title: "Recommendation Logic",
    insight: recommendation.rationale,
    severity:
      recommendation.decision === "APPROVE"
        ? "positive"
        : recommendation.decision === "CONDITIONAL APPROVAL"
          ? "warning"
          : "critical",
    tags: ["RECOMMENDATION", recommendation.decision],
  });

  return insights.slice(0, 4);
}

function buildCamSections(
  source: WorkspaceSourceState,
  recommendation: Recommendation,
  fiveCs: FiveCMetric[],
  signals: AnalysisSignal[],
  documentSummary: string,
  creditModel: CreditModelSnapshot,
  sourceCoverage: SourceCoverageItem[],
  structuredSynthesis: StructuredSynthesisItem[],
  decisionTrace: DecisionTraceItem[],
): CamSection[] {
  const leadSignal = signals[0]?.label ?? "No major distress signal identified";
  const fiveCSummary = fiveCs
    .map((metric) => `${metric.metric}: ${metric.score}/100`)
    .join(", ");
  const sourceSummary = sourceCoverage
    .filter((item) => item.available)
    .slice(0, 4)
    .map((item) => item.label)
    .join(", ");
  const synthesisSummary = structuredSynthesis
    .slice(0, 2)
    .map((item) => `${item.label}: ${item.value}`)
    .join(" | ");
  const decisionSummary = decisionTrace
    .slice(0, 2)
    .map((item) => `${item.title} (${item.impact})`)
    .join(", ");

  return [
    {
      title: "Executive Summary",
      preview: `${source.companyName} has applied for a ${source.facilityType.toLowerCase()} of Rs ${source.requestedAmountCr} Cr. CredX recommends ${recommendation.decision.toLowerCase()} with a proposed limit of Rs ${recommendation.recommendedAmountCr} Cr at ${recommendation.rate}% based on document intelligence, research cues, primary observations, and a ${creditModel.grade}-grade model score of ${creditModel.score}/900.`,
    },
    {
      title: "Company Profile",
      preview: `${source.companyName} is being assessed within the ${source.sector} sector. Current workflow combines uploaded documents, research outputs, and due-diligence input into a unified credit view.`,
    },
    {
      title: "Financial Analysis",
      preview: `${documentSummary} Structured synthesis now tracks ${synthesisSummary}.`,
    },
    {
      title: "Research and External Intelligence",
      preview: `Lead external review cue: ${leadSignal}. Secondary research is layered on top of the uploaded documents to stress-test underwriting comfort.`,
    },
    {
      title: "Source Coverage and Evidence Map",
      preview: `Available evidence lanes: ${sourceSummary || "none yet"}. Current readiness stands at ${creditModel.readiness}% across the ingestor, research agent, and recommendation engine.`,
    },
    {
      title: "Five Cs of Credit",
      preview: fiveCSummary,
    },
    {
      title: "Recommendation and Decision Trace",
      preview: `${recommendation.decision} recommended. Amount: Rs ${recommendation.recommendedAmountCr} Cr. Rate: ${recommendation.rate}%. Tenor: ${recommendation.tenor}. Key decision drivers: ${decisionSummary}. Key covenants: ${recommendation.covenants.join(" ")}`,
    },
  ];
}

export function deriveWorkspaceState(source: WorkspaceSourceState): WorkspaceState {
  const topSignals = aggregateSignals(source.documents);
  const creditModel = buildCreditModel(source, topSignals);
  const overallScore = creditModel.score;
  const riskLevel = riskLevelFromScore(overallScore);
  const documentSummary = buildDocumentSummary(source.documents, topSignals);
  const recommendation = buildRecommendation(source, topSignals, creditModel);
  const scenarios = buildScenarios(recommendation, overallScore);
  const fiveCs = buildFiveCs(source, topSignals, overallScore);
  const featureImportance = buildFeatureImportance(topSignals, fiveCs, creditModel);
  const sourceCoverage = buildSourceCoverage(source);
  const primaryAdjustments = buildPrimaryAdjustments(source.dueDiligenceNote);
  const structuredSynthesis = buildStructuredSynthesis(
    source,
    topSignals,
    creditModel,
    sourceCoverage,
  );
  const researchNews = buildResearchNews(source, topSignals, riskLevel);
  const researchFindings = buildResearchFindings(
    source,
    topSignals,
    riskLevel,
    primaryAdjustments,
  );
  const networkNodes = buildNetworkNodes(source, topSignals);
  const timelineEvents = buildTimelineEvents(topSignals, recommendation);
  const decisionTrace = buildDecisionTrace(
    topSignals,
    creditModel,
    primaryAdjustments,
  );
  const monitoringTriggers = buildMonitoringTriggers(
    structuredSynthesis,
    topSignals,
    primaryAdjustments,
  );
  const aiInsights = buildAiInsights(
    source,
    topSignals,
    recommendation,
    riskLevel,
    creditModel,
    structuredSynthesis,
  );
  const camSections = buildCamSections(
    source,
    recommendation,
    fiveCs,
    topSignals,
    documentSummary,
    creditModel,
    sourceCoverage,
    structuredSynthesis,
    decisionTrace,
  );

  return {
    ...source,
    topSignals,
    overallScore,
    riskLevel,
    researchNews,
    networkNodes,
    timelineEvents,
    aiInsights,
    recommendation,
    scenarios,
    fiveCs,
    featureImportance,
    creditModel,
    camSections,
    sourceCoverage,
    structuredSynthesis,
    researchFindings,
    primaryAdjustments,
    decisionTrace,
    monitoringTriggers,
    documentSummary,
  };
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadWorkspaceState(): WorkspaceState {
  if (!canUseStorage()) {
    return deriveWorkspaceState(DEFAULT_SOURCE_STATE);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return deriveWorkspaceState(DEFAULT_SOURCE_STATE);

    const parsed = JSON.parse(raw) as Partial<WorkspaceSourceState>;
    return deriveWorkspaceState({
      ...DEFAULT_SOURCE_STATE,
      ...parsed,
      documents: Array.isArray(parsed.documents)
        ? parsed.documents
        : DEFAULT_SOURCE_STATE.documents,
    });
  } catch {
    return deriveWorkspaceState(DEFAULT_SOURCE_STATE);
  }
}

function writeWorkspaceSourceState(source: WorkspaceSourceState): WorkspaceState {
  const nextState = deriveWorkspaceState(source);

  if (canUseStorage()) {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        companyName: nextState.companyName,
        cin: nextState.cin,
        sector: nextState.sector,
        facilityType: nextState.facilityType,
        requestedAmountCr: nextState.requestedAmountCr,
        dueDiligenceNote: nextState.dueDiligenceNote,
        documents: nextState.documents,
      } satisfies WorkspaceSourceState),
    );
    window.dispatchEvent(new CustomEvent("credx-workspace-updated"));
  }

  return nextState;
}

export function updateWorkspaceState(
  patch: Partial<WorkspaceSourceState>,
): WorkspaceState {
  const current = loadWorkspaceState();
  return writeWorkspaceSourceState({
    companyName: patch.companyName ?? current.companyName,
    cin: patch.cin ?? current.cin,
    sector: patch.sector ?? current.sector,
    facilityType: patch.facilityType ?? current.facilityType,
    requestedAmountCr: patch.requestedAmountCr ?? current.requestedAmountCr,
    dueDiligenceNote: patch.dueDiligenceNote ?? current.dueDiligenceNote,
    documents: patch.documents ?? current.documents,
  });
}

export function resetWorkspaceState(): WorkspaceState {
  return writeWorkspaceSourceState(DEFAULT_SOURCE_STATE);
}

export function generateCopilotReply(
  workspace: WorkspaceState,
  question: string,
): string {
  const normalized = question.toLowerCase();
  const leadSignal = workspace.topSignals[0];
  const recommendation = workspace.recommendation;

  if (normalized.includes("major risk") || normalized.includes("top risk")) {
    const signalLines = workspace.topSignals
      .map(
        (signal, index) =>
          `${index + 1}. ${signal.label}: ${signal.detail}`,
      )
      .join("\n\n");
    return `Top risk signals for ${workspace.companyName}:\n\n${signalLines}\n\nOverall recommendation posture: ${recommendation.decision}.`;
  }

  if (normalized.includes("safest loan amount") || normalized.includes("loan amount")) {
    const scenarioLines = workspace.scenarios
      .map(
        (scenario) =>
          `${scenario.label}: Rs ${scenario.amountCr} Cr | PD ${scenario.pd}% | Risk Score ${scenario.riskScore}/100`,
      )
      .join("\n");
    return `${workspace.companyName} scenario comparison:\n${scenarioLines}\n\nRecommended structure: Rs ${recommendation.recommendedAmountCr} Cr at ${recommendation.rate}% because ${recommendation.rationale}\n\nCredit model: ${workspace.creditModel.score}/900 (${workspace.creditModel.grade}), readiness ${workspace.creditModel.readiness}%.`;
  }

  if (normalized.includes("summarize") || normalized.includes("annual report")) {
    return `${workspace.documentSummary}\n\nLead signal: ${leadSignal?.label ?? "No critical signal detected."}`;
  }

  if (normalized.includes("gst") || normalized.includes("bank flow") || normalized.includes("reconcile")) {
    const lines = workspace.structuredSynthesis
      .slice(0, 3)
      .map((item) => `${item.label}: ${item.value} (${item.status})`)
      .join("\n");
    return `Structured synthesis for ${workspace.companyName}:\n\n${lines}\n\nInterpretation: the prototype uses GST, bank, and document-risk cues together to flag reconciliation drift, cash-realization gaps, and circular-trading watch signals.`;
  }

  if (
    normalized.includes("site-visit") ||
    normalized.includes("site visit") ||
    normalized.includes("due diligence") ||
    normalized.includes("what changed")
  ) {
    const adjustments = workspace.primaryAdjustments
      .map(
        (item) =>
          `- ${item.label}: ${item.delta > 0 ? "+" : ""}${item.delta} | ${item.reason}`,
      )
      .join("\n");
    return `Primary diligence impact for ${workspace.companyName}:\n\n${adjustments}\n\nThese adjustments flow into operating resilience, the Five Cs view, and the final recommendation trace.`;
  }

  if (
    normalized.includes("recommendation logic") ||
    normalized.includes("walk me through") ||
    normalized.includes("decision trace")
  ) {
    const decisionLines = workspace.decisionTrace
      .map(
        (item) =>
          `- ${item.title}: ${item.impact.toUpperCase()} (${item.weight}) - ${item.detail}`,
      )
      .join("\n");
    return `Recommendation logic for ${workspace.companyName}:\n\n${decisionLines}\n\nOutcome: ${recommendation.decision} | Rs ${recommendation.recommendedAmountCr} Cr | ${recommendation.rate}% | Credit model ${workspace.creditModel.score}/900 (${workspace.creditModel.grade}).`;
  }

  if (
    normalized.includes("missing") ||
    normalized.includes("source bucket") ||
    normalized.includes("evidence lane")
  ) {
    const missing = workspace.sourceCoverage
      .filter((item) => !item.available)
      .map((item) => `- ${item.label} (${item.sourceType})`)
      .join("\n");
    return missing
      ? `Missing evidence lanes for ${workspace.companyName}:\n\n${missing}\n\nFilling these gaps should improve readiness, explainability, and confidence in the sanction limit.`
      : `All configured evidence lanes are populated for ${workspace.companyName}. The focus can move to refreshed research and sanction structuring.`;
  }

  if (normalized.includes("compare") || normalized.includes("benchmark")) {
    const conditions = workspace.fiveCs.find((metric) => metric.metric === "Conditions");
    const capacity = workspace.fiveCs.find((metric) => metric.metric === "Capacity");
    return `Benchmark-style view for ${workspace.companyName}:\n\nCapacity score: ${capacity?.score ?? 0}/100\nConditions score: ${conditions?.score ?? 0}/100\n\nInterpretation: the file remains most sensitive to operating resilience and sector conditions rather than collateral quality.`;
  }

  if (normalized.includes("mitigation")) {
    return `Recommended mitigants for ${workspace.companyName}:\n\n- ${recommendation.covenants.join("\n- ")}\n\nThese controls align with the current risk posture of ${workspace.riskLevel.toUpperCase()}.`;
  }

  return `CredX reviewed ${workspace.companyName} across uploaded documents, research signals, and primary due-diligence notes.\n\nCurrent stance: ${recommendation.decision}\nRecommended amount: Rs ${recommendation.recommendedAmountCr} Cr\nIndicative rate: ${recommendation.rate}%\nCredit model: ${workspace.creditModel.score}/900 (${workspace.creditModel.grade})\nPipeline readiness: ${workspace.creditModel.readiness}%\n\nPrimary driver: ${leadSignal?.label ?? "No major signal detected."}`;
}
