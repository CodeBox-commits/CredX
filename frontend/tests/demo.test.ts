import { describe, expect, it } from "vitest";

import { buildFraud, buildScore } from "@/services/demo/build";
import { PORTFOLIO } from "@/services/demo/portfolio";

const byKey = (k: string) => PORTFOLIO.find((b) => b.key === k)!;

describe("demo fixtures", () => {
  const scores = Object.fromEntries(PORTFOLIO.map((b) => [b.key, buildScore(b)]));

  it("spans the risk spectrum the demo story relies on", () => {
    console.table(PORTFOLIO.map((b) => ({ key: b.key, model: scores[b.key].model_score, overlay: scores[b.key].overlay_total, score: scores[b.key].credit_score, decision: scores[b.key].decision, amount: scores[b.key].recommended_amount / 1e7, rate: scores[b.key].suggested_rate })));
    expect(scores.sunline.decision).toBe("APPROVE");
    expect(scores.orion.decision).toBe("APPROVE");
    expect(scores.nebula.decision).toBe("DECLINE");
    expect(["APPROVE_WITH_CONDITIONS", "REFER"]).toContain(scores.kaveri.decision);
    expect(["REFER", "APPROVE_WITH_CONDITIONS"]).toContain(scores.aarav.decision);
    expect(scores.orion.credit_score).toBeGreaterThan(scores.nebula.credit_score + 150);
  });

  it("keeps the score waterfall additive", () => {
    for (const s of Object.values(scores)) {
      const sum = s.base_points + s.contributions.reduce((a, c) => a + c.points_exact, 0);
      expect(Math.abs(sum - s.model_score)).toBeLessThanOrEqual(0.5);
      expect(s.credit_score).toBe(Math.max(300, Math.min(900, s.model_score + s.overlay_total)));
    }
  });

  it("builds a fraud ring only for the fraud showcase borrower", () => {
    expect(buildFraud(byKey("nebula")).alerts.some((a) => a.alert_type === "circular_trading")).toBe(true);
    expect(buildFraud(byKey("orion")).alerts).toHaveLength(0);
  });
});
