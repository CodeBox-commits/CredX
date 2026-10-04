import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContributionBars } from "@/charts/shap-waterfall";
import { JobProgress } from "@/components/common/job-progress";
import { RiskBadge, ToneBadge } from "@/components/common/primitives";
import type { Contribution, Job } from "@/types/api";

const contrib = (feature: string, points: number, missing = false): Contribution => ({
  feature, label: feature.toUpperCase(), value: missing ? null : 1, display_value: missing ? "not available" : "1.00x", points,
  points_exact: points, direction: points < 0 ? "increases_risk" : "reduces_risk", description: "", five_c: "capacity", missing,
});

describe("explainability components", () => {
  it("renders signed SHAP points per feature", () => {
    render(<ContributionBars contributions={[contrib("dscr", 32), contrib("fraud_score", -41), contrib("pledge", 0, true)]} />);
    expect(screen.getByText("+32")).toBeInTheDocument();
    expect(screen.getByText("-41")).toBeInTheDocument();
    expect(screen.getByText("not available")).toHaveClass("italic");
  });

  it("shows risk badges and an unscored fallback", () => {
    render(<><RiskBadge risk="HIGH" /><RiskBadge risk={null} /><ToneBadge tone="success">ok</ToneBadge></>);
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByText("Unscored")).toBeInTheDocument();
  });

  it("renders job progress with workflow steps", () => {
    const job: Job = {
      id: "j1", kind: "full_analysis", case_id: "c1", document_id: null, status: "running", progress: 55, stage: "scoring",
      message: "Scoring with XGBoost + SHAP", result: null, error: null, attempts: 1, backend: "thread", created_at: "", started_at: null,
      finished_at: null, duration_ms: null,
      steps: [
        { key: "research", label: "Secondary research", status: "done" },
        { key: "scoring", label: "Credit scoring & explainability", status: "running" },
      ],
    };
    render(<JobProgress job={job} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "55");
    expect(screen.getByText("Full analysis")).toBeInTheDocument();
    expect(screen.getByText("Credit scoring & explainability")).toBeInTheDocument();
  });
});
