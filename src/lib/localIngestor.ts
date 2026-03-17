import type {
  AnalysisHighlight,
  AnalysisSignal,
  ParseSummary,
  UploadMultipleResponse,
  UploadedFileMeta,
} from "./creditTypes";

type SignalRule = {
  label: string;
  severity: AnalysisSignal["severity"];
  penalty: number;
  detail: string;
  patterns: RegExp[];
};

const SIGNAL_RULES: SignalRule[] = [
  {
    label: "Default or overdue obligations",
    severity: "high",
    penalty: 18,
    detail:
      "Payment default, overdue balances, or delayed servicing language was detected.",
    patterns: [
      /\bdefault(?:ed|s)?\b/i,
      /\boverdue\b/i,
      /\bdelay(?:ed)? payment\b/i,
      /\bnon[- ]performing\b/i,
      /\bmissed installment\b/i,
    ],
  },
  {
    label: "Litigation or insolvency exposure",
    severity: "high",
    penalty: 16,
    detail:
      "The document references litigation, insolvency, or legal proceedings.",
    patterns: [
      /\blitigation\b/i,
      /\binsolvency\b/i,
      /\bnclt\b/i,
      /\barbitration\b/i,
      /\blegal proceedings?\b/i,
    ],
  },
  {
    label: "Related-party or promoter-linked exposure",
    severity: "medium",
    penalty: 10,
    detail:
      "Transactions involving promoters, related parties, or group entities were flagged.",
    patterns: [
      /\brelated party\b/i,
      /\bpromoter(?:s)?\b/i,
      /\bgroup compan(?:y|ies)\b/i,
      /\bassociate compan(?:y|ies)\b/i,
    ],
  },
  {
    label: "Negative cash flow or liquidity pressure",
    severity: "medium",
    penalty: 9,
    detail:
      "Liquidity stress indicators or negative operating cash flows were found.",
    patterns: [
      /\bnegative cash flow\b/i,
      /\bcash loss\b/i,
      /\bliquidity\b/i,
      /\bworking capital\b/i,
      /\bstressed cash\b/i,
    ],
  },
  {
    label: "Qualified audit or disclosure concern",
    severity: "medium",
    penalty: 8,
    detail:
      "Audit qualifications, emphasis of matter, or disclosure concerns were identified.",
    patterns: [
      /\bqualified opinion\b/i,
      /\bemphasis of matter\b/i,
      /\bmaterial weakness\b/i,
      /\bgoing concern\b/i,
      /\badverse opinion\b/i,
    ],
  },
  {
    label: "Cheque returns or covenant references",
    severity: "low",
    penalty: 4,
    detail:
      "The document mentions cheque returns, covenants, or compliance triggers worth reviewing.",
    patterns: [
      /\bcheque return(?:ed)?\b/i,
      /\bcovenant\b/i,
      /\bbreach\b/i,
      /\bnon[- ]compliance\b/i,
    ],
  },
];

const DOCUMENT_TYPE_RULES: Array<{
  type: string;
  patterns: RegExp[];
}> = [
  {
    type: "Annual Report",
    patterns: [
      /\bannual report\b/i,
      /\bboard of directors\b/i,
      /\bbalance sheet\b/i,
      /\bstatement of profit and loss\b/i,
    ],
  },
  {
    type: "Bank Statement",
    patterns: [
      /\bbank statement\b/i,
      /\baccount number\b/i,
      /\bopening balance\b/i,
      /\bclosing balance\b/i,
    ],
  },
  {
    type: "GST Return",
    patterns: [
      /\bgstr[- ]?[1239]\b/i,
      /\bgoods and services tax\b/i,
      /\binput tax credit\b/i,
      /\bgst\b/i,
    ],
  },
  {
    type: "Auditor Report",
    patterns: [
      /\bauditor'?s report\b/i,
      /\bindependent auditor'?s report\b/i,
      /\btrue and fair view\b/i,
    ],
  },
  {
    type: "Legal Notice",
    patterns: [/\blegal notice\b/i, /\bdemand notice\b/i, /\barbitration\b/i],
  },
];

const AMOUNT_PATTERN =
  /\b(?:rs\.?|inr|usd|eur|gbp|aed|sgd|jpy|cny)\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:crore|cr|lakh|lac|million|billion|mn|bn))?/gi;
const PERCENT_PATTERN = /\b\d{1,3}(?:\.\d+)?\s?%/gi;
const DATE_PATTERN =
  /\b(?:\d{1,2}[/-]){2}\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\b/gi;

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function safeFilename(filename: string): string {
  const cleaned = filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^[._]+|[._]+$/g, "");
  return cleaned || "upload.bin";
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

function decodeBinary(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

function extractPdfLikeText(raw: string): string {
  const literalMatches = Array.from(raw.matchAll(/\(([^()]|\\.){4,}\)/g))
    .map((match) => match[0].slice(1, -1).replace(/\\([()\\])/g, "$1"))
    .map(normalizeSpace)
    .filter((value) => value.length > 3);

  const printableMatches = Array.from(
    raw.matchAll(/[A-Za-z0-9][A-Za-z0-9,.:;()%/+\- ]{10,}/g),
  )
    .map((match) => normalizeSpace(match[0]))
    .filter((value) => value.length > 8);

  const uniqueValues: string[] = [];
  [...literalMatches, ...printableMatches].forEach((value) => {
    if (!value || uniqueValues.includes(value)) return;
    uniqueValues.push(value);
  });

  return uniqueValues.slice(0, 400).join("\n");
}

async function extractFilePayload(
  file: File,
): Promise<{ text: string; raw: string; pageCount: number }> {
  const loweredName = file.name.toLowerCase();
  const isPlainText =
    file.type.startsWith("text/") ||
    /\.(txt|csv|json|md|xml|html?)$/i.test(loweredName);

  if (isPlainText) {
    const text = await file.text();
    const lineCount = text.split(/\n+/).filter(Boolean).length;
    return {
      text,
      raw: text,
      pageCount: Math.max(1, Math.ceil(lineCount / 40)),
    };
  }

  const buffer = await file.arrayBuffer();
  const raw = decodeBinary(buffer);
  const text = loweredName.endsWith(".pdf") || file.type === "application/pdf"
    ? extractPdfLikeText(raw)
    : normalizeSpace(raw);

  const pageMarkers = raw.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  const derivedPageCount =
    pageMarkers > 0 ? pageMarkers : Math.max(1, Math.ceil(file.size / 120000));

  return {
    text,
    raw,
    pageCount: derivedPageCount,
  };
}

function detectDocumentType(text: string, filename: string): string {
  const searchable = `${filename} ${text}`;
  const matchedRule = DOCUMENT_TYPE_RULES.find((rule) =>
    rule.patterns.some((pattern) => pattern.test(searchable)),
  );
  return matchedRule?.type ?? "Financial Document";
}

function buildExcerpt(text: string, start: number, end: number): string {
  const left = Math.max(0, start - 90);
  const right = Math.min(text.length, end + 90);
  return normalizeSpace(text.slice(left, right));
}

function collectSignals(text: string): { signals: AnalysisSignal[]; penalty: number } {
  const signals: AnalysisSignal[] = [];
  let penalty = 0;

  SIGNAL_RULES.forEach((rule) => {
    const match = rule.patterns
      .map((pattern) => pattern.exec(text))
      .find((result) => result !== null);

    if (!match || match.index === undefined) return;

    signals.push({
      label: rule.label,
      severity: rule.severity,
      detail: rule.detail,
      page_number: null,
      excerpt: buildExcerpt(text, match.index, match.index + match[0].length),
    });
    penalty += rule.penalty;
  });

  if (text.length < 500) {
    signals.push({
      label: "Low extraction coverage",
      severity: "medium",
      detail:
        "Very little text was extracted locally, so a richer backend parser or OCR review may still be needed.",
      page_number: null,
      excerpt:
        "Browser fallback extracted limited text. Review the file manually if this document is image-heavy.",
    });
    penalty += 6;
  }

  if (signals.length === 0) {
    signals.push({
      label: "No obvious distress keywords found",
      severity: "low",
      detail:
        "Automated local screening did not detect common distress language, but manual review is still recommended.",
      page_number: null,
      excerpt: "No high-risk phrases were matched in the locally extracted text.",
    });
  }

  return {
    signals: signals.slice(0, 5),
    penalty,
  };
}

function uniqueMatches(pattern: RegExp, text: string, limit: number): string[] {
  const seen: string[] = [];
  const matches = text.match(pattern) ?? [];

  for (const match of matches) {
    const normalized = normalizeSpace(match);
    if (!normalized || seen.includes(normalized)) continue;
    seen.push(normalized);
    if (seen.length >= limit) break;
  }

  return seen;
}

function buildHighlights(
  documentType: string,
  pageCount: number,
  text: string,
  signals: AnalysisSignal[],
): AnalysisHighlight[] {
  const highlights: AnalysisHighlight[] = [
    {
      title: "Detected document type",
      detail: documentType,
      page_number: null,
    },
    {
      title: "Pages analyzed",
      detail: `${pageCount} page(s) estimated in browser fallback mode.`,
      page_number: null,
    },
  ];

  const amounts = uniqueMatches(AMOUNT_PATTERN, text, 3);
  if (amounts.length > 0) {
    highlights.push({
      title: "Monetary values spotted",
      detail: amounts.join(", "),
      page_number: null,
    });
  }

  const percentages = uniqueMatches(PERCENT_PATTERN, text, 3);
  if (percentages.length > 0) {
    highlights.push({
      title: "Ratios or percentages mentioned",
      detail: percentages.join(", "),
      page_number: null,
    });
  }

  const dates = uniqueMatches(DATE_PATTERN, text, 2);
  if (dates.length > 0) {
    highlights.push({
      title: "Reporting periods detected",
      detail: dates.join(", "),
      page_number: null,
    });
  }

  if (signals.length > 0) {
    highlights.push({
      title: "Primary review cue",
      detail: signals[0].label,
      page_number: signals[0].page_number ?? null,
    });
  }

  return highlights.slice(0, 5);
}

function riskLevelFromScore(score: number): ParseSummary["risk_level"] {
  if (score >= 720) return "low";
  if (score >= 620) return "medium";
  return "high";
}

function analyzeExtractedText(
  text: string,
  pageCount: number,
  filename: string,
): ParseSummary {
  const normalizedText = normalizeSpace(text);
  const documentType = detectDocumentType(normalizedText, filename);
  const { signals, penalty } = collectSignals(normalizedText);
  const score = Math.max(300, Math.min(900, 790 - penalty * 6));
  const riskLevel = riskLevelFromScore(score);
  const highlights = buildHighlights(documentType, pageCount, normalizedText, signals);
  const primarySignal = signals[0]?.label ?? "No obvious distress keywords found";

  return {
    parsed: true,
    status: "parsed",
    parser: "browser-fallback",
    result_type: "text",
    page_count: pageCount,
    character_count: normalizedText.length,
    detected_document_type: documentType,
    summary: `${documentType} analyzed in browser fallback mode. ${riskLevel?.toUpperCase()} review priority based on: ${primarySignal}.`,
    score,
    risk_level: riskLevel,
    signals,
    highlights,
  };
}

async function analyzeSingleFileLocally(
  file: File,
  companyId?: string,
  documentType?: string,
): Promise<UploadedFileMeta> {
  const originalFilename = safeFilename(file.name);
  const documentId = generateId();
  const timestamp = new Date().toISOString();

  try {
    const { text, pageCount } = await extractFilePayload(file);
    const parseSummary =
      text.trim().length > 0
        ? analyzeExtractedText(text, pageCount, originalFilename)
        : {
            parsed: false,
            status: "failed",
            reason:
              "Browser fallback could not extract meaningful text from this document.",
          };

    return {
      document_id: documentId,
      company_id: companyId ?? null,
      document_type: documentType ?? null,
      original_filename: originalFilename,
      stored_filename: `browser-${documentId}-${originalFilename}`,
      storage_path: "",
      content_type: file.type || null,
      size_bytes: file.size,
      uploaded_at: timestamp,
      parse_summary: parseSummary,
    };
  } catch (error) {
    return {
      document_id: documentId,
      company_id: companyId ?? null,
      document_type: documentType ?? null,
      original_filename: originalFilename,
      stored_filename: `browser-${documentId}-${originalFilename}`,
      storage_path: "",
      content_type: file.type || null,
      size_bytes: file.size,
      uploaded_at: timestamp,
      parse_summary: {
        parsed: false,
        status: "failed",
        reason:
          error instanceof Error
            ? error.message
            : "Local analysis failed unexpectedly.",
      },
    };
  }
}

export async function analyzeFilesLocally(params: {
  files: File[];
  companyId?: string;
  documentType?: string;
}): Promise<UploadMultipleResponse> {
  const files = await Promise.all(
    params.files.map((file) =>
      analyzeSingleFileLocally(file, params.companyId, params.documentType),
    ),
  );

  return {
    success: true,
    count: files.length,
    files,
    processing_mode: "local",
    warning:
      "Backend was unreachable, so CredX switched to browser fallback analysis for this session.",
  };
}
