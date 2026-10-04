import { describe, expect, it } from "vitest";
import { deriveWorkspaceState, generateCopilotReply } from "@/lib/intelliCredit";
import type { AnalysisSignal, UploadedFileMeta } from "@/lib/creditTypes";

function makeSignal(
  label: string,
  severity: AnalysisSignal["severity"],
  detail: string,
): AnalysisSignal {
  return {
    label,
    severity,
    detail,
    page_number: 1,
    excerpt: detail,
  };
}

function makeParsedDocument(params: {
  name: string;
  type: string;
  score: number;
  risk: "low" | "medium" | "high";
  summary: string;
  signals: AnalysisSignal[];
}): UploadedFileMeta {
  return {
    document_id: `${params.name}-id`,
    company_id: "demo-co",
    document_type: params.type,
    original_filename: params.name,
    stored_filename: params.name,
    storage_path: `/tmp/${params.name}`,
    content_type: "application/pdf",
    size_bytes: 1024,
    uploaded_at: "2026-04-05T00:00:00.000Z",
    parse_summary: {
      parsed: true,
      status: "parsed",
      parser: "test",
      result_type: "text",
      page_count: 5,
      character_count: 2000,
      detected_document_type: params.type,
      summary: params.summary,
      score: params.score,
      risk_level: params.risk,
      signals: params.signals,
      highlights: [],
    },
  };
}

describe("deriveWorkspaceState", () => {
  it("builds structured synthesis, primary adjustments, and a decision trace", () => {
    const state = deriveWorkspaceState({
      companyName: "Orbit Metals Private Limited",
      cin: "U27100MH2012PTC000001",
      sector: "Metals and Manufacturing",
      facilityType: "Working Capital",
      requestedAmountCr: 160,
      dueDiligenceNote:
        "Factory operating at 40% capacity with inventory pile-up observed during site visit.",
      documents: [
        makeParsedDocument({
          name: "gstr-3b-q4.pdf",
          type: "GST Return",
          score: 640,
          risk: "medium",
          summary: "GST return reviewed with reconciliation observations.",
          signals: [
            makeSignal(
              "GST reconciliation or circular-trading cue",
              "high",
              "Mismatch observed between GSTR-2A and GSTR-3B flows.",
            ),
          ],
        }),
        makeParsedDocument({
          name: "bank-statement.pdf",
          type: "Bank Statement",
          score: 655,
          risk: "medium",
          summary: "Bank statement reviewed with working-capital pressure cues.",
          signals: [
            makeSignal(
              "Negative cash flow or liquidity pressure",
              "medium",
              "Working-capital stretch visible in recent months.",
            ),
          ],
        }),
        makeParsedDocument({
          name: "annual-report.pdf",
          type: "Annual Report",
          score: 670,
          risk: "medium",
          summary: "Annual report reviewed with promoter commentary.",
          signals: [
            makeSignal(
              "Related-party or promoter-linked exposure",
              "medium",
              "Promoter-linked counterparties referenced in disclosures.",
            ),
          ],
        }),
        makeParsedDocument({
          name: "itr-ay25.pdf",
          type: "Income Tax Return",
          score: 702,
          risk: "low",
          summary: "Income tax return reviewed.",
          signals: [],
        }),
      ],
    });

    expect(
      state.sourceCoverage.find((item) => item.label === "GST filings")?.available,
    ).toBe(true);
    expect(
      state.structuredSynthesis.find((item) =>
        item.label.includes("GSTR-2A vs 3B"),
      )?.status,
    ).not.toBe("pending");
    expect(
      state.primaryAdjustments.some(
        (item) => item.label === "Factory utilization below plan",
      ),
    ).toBe(true);
    expect(state.decisionTrace.length).toBeGreaterThan(0);
  });

  it("surfaces missing evidence lanes and answers copilot questions about them", () => {
    const state = deriveWorkspaceState({
      companyName: "Sparse Case Limited",
      cin: "U99999DL2015PLC000002",
      sector: "Logistics",
      facilityType: "Term Loan",
      requestedAmountCr: 120,
      dueDiligenceNote: "",
      documents: [],
    });

    expect(
      state.sourceCoverage.find((item) => item.label === "Bank statements")?.available,
    ).toBe(false);

    const reply = generateCopilotReply(state, "Which source buckets are still missing?");
    expect(reply).toContain("Missing evidence lanes");
    expect(reply).toContain("Bank statements");
  });
});
