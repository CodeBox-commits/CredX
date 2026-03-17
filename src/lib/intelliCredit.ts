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
  const coreDocumentCount = [
    annualReportPresent,
    bankStatementPresent,
    gstReturnPresent,
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
      coreDocumentCount * 16 +
      Math.round(parsedRatio * 24) +
      Math.min(totalDocuments, 4) * 4,
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
      (gstReturnPresent ? 6 : -4),
    22,
    90,
  );
  const governanceScore = clamp(
    76 -
      (hasRelatedParty ? 17 : 0) -
      (hasAuditConcern ? 8 : 0) -
      mediumRiskSignals * 2 +
      (annualReportPresent ? 4 : 0),
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
      coreDocumentCount * 3,
    26,
    90,
  );

  const factors: CreditModelFactor[] = [
    {
      label: "Document coverage",
      score: coverageScore,
      weight: 20,
      impact: coverageScore >= 70 ? "positive" : "negative",
      detail: `Parsed ${parsedDocuments}/${totalDocuments} uploaded file(s). Core underwriting coverage stands at ${coreDocumentCount}/3 for annual report, bank statement, and GST return.`,
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
        : "Governance signals remain within a monitorable band for the prototype model.",
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
): WorkspaceInsight[] {
  const leadSignal = signals[0];
  const dueDiligenceText = source.dueDiligenceNote.trim();

  const insights: WorkspaceInsight[] = [];

  if (leadSignal) {
    insights.push({
      title: leadSignal.label,
      insight: `${leadSignal.detail} This is currently the top driver behind the ${riskLevel} risk posture.`,
      severity: leadSignal.severity === "high" ? "critical" : "warning",
      tags: ["SIGNAL", riskLevel.toUpperCase()],
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
): CamSection[] {
  const leadSignal = signals[0]?.label ?? "No major distress signal identified";
  const fiveCSummary = fiveCs
    .map((metric) => `${metric.metric}: ${metric.score}/100`)
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
      preview: documentSummary,
    },
    {
      title: "Research and External Intelligence",
      preview: `Lead external review cue: ${leadSignal}. Secondary research is layered on top of the uploaded documents to stress-test underwriting comfort.`,
    },
    {
      title: "Five Cs of Credit",
      preview: fiveCSummary,
    },
    {
      title: "Recommendation",
      preview: `${recommendation.decision} recommended. Amount: Rs ${recommendation.recommendedAmountCr} Cr. Rate: ${recommendation.rate}%. Tenor: ${recommendation.tenor}. Model readiness: ${creditModel.readiness}%. Key covenants: ${recommendation.covenants.join(" ")}`,
    },
  ];
}

function deriveWorkspaceState(source: WorkspaceSourceState): WorkspaceState {
  const topSignals = aggregateSignals(source.documents);
  const creditModel = buildCreditModel(source, topSignals);
  const overallScore = creditModel.score;
  const riskLevel = riskLevelFromScore(overallScore);
  const documentSummary = buildDocumentSummary(source.documents, topSignals);
  const recommendation = buildRecommendation(source, topSignals, creditModel);
  const scenarios = buildScenarios(recommendation, overallScore);
  const fiveCs = buildFiveCs(source, topSignals, overallScore);
  const featureImportance = buildFeatureImportance(topSignals, fiveCs, creditModel);
  const researchNews = buildResearchNews(source, topSignals, riskLevel);
  const networkNodes = buildNetworkNodes(source, topSignals);
  const timelineEvents = buildTimelineEvents(topSignals, recommendation);
  const aiInsights = buildAiInsights(
    source,
    topSignals,
    recommendation,
    riskLevel,
    creditModel,
  );
  const camSections = buildCamSections(
    source,
    recommendation,
    fiveCs,
    topSignals,
    documentSummary,
    creditModel,
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
