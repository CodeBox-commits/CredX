export type ResearchArticleRecord = {
  headline: string;
  summary: string;
  url: string;
  published_at: string;
  publisher: string;
  provider: string;
  source_type: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  relevance_score: number;
  confidence: number;
  key_reasons: string[];
};

export type ResearchTimelineEntry = {
  title: string;
  date: string;
  detail: string;
  severity: "low" | "medium" | "high";
};

export type ResearchRiskSummary = {
  top_positive_signals: string[];
  top_negative_signals: string[];
  regulatory_risks: string[];
  sector_risks: string[];
  promoter_risks: string[];
  legal_risks: string[];
  sector_overview: string;
  market_outlook: string;
  industry_growth: string;
  industry_risks: string[];
  rbi_policy_impact: string;
  government_policy_impact: string;
  news_summary: string;
  overall_research_risk: "LOW" | "MEDIUM" | "HIGH";
};
