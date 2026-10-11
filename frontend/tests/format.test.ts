import { describe, expect, it } from "vitest";

import { decisionLabel, formatCr, formatINR, parseAmount, pct, times } from "@/lib/format";
import { decisionTone, riskTone, scoreTone } from "@/lib/tones";

describe("Indian number formatting", () => {
  it("groups in lakh/crore style", () => {
    expect(formatINR(12000000)).toBe("₹1,20,00,000");
    expect(formatINR(999)).toBe("₹999");
    expect(formatINR(-4500000)).toBe("-₹45,00,000");
    expect(formatINR(null)).toBe("—");
  });
  it("abbreviates crores and lakhs", () => {
    expect(formatCr(25e7)).toBe("₹25.00 Cr");
    expect(formatCr(4.5e5)).toBe("₹4.50 L");
    expect(formatCr(950)).toBe("₹950");
  });
  it("parses analyst amount input", () => {
    expect(parseAmount("25 cr")).toBe(25e7);
    expect(parseAmount("2.5 crore")).toBe(2.5e7);
    expect(parseAmount("40 lakh")).toBe(40e5);
    expect(parseAmount("₹2,50,00,000")).toBe(25000000);
    expect(parseAmount("12")).toBe(12e7);
    expect(parseAmount("abc")).toBeNull();
  });
  it("formats ratios", () => {
    expect(pct(0.1234)).toBe("12.3%");
    expect(times(1.256)).toBe("1.26x");
    expect(decisionLabel("APPROVE_WITH_CONDITIONS")).toBe("Approve w/ conditions");
  });
});

describe("semantic tones", () => {
  it("maps risk, decisions and scores consistently", () => {
    expect(riskTone("LOW")).toBe("success");
    expect(riskTone("CRITICAL")).toBe("destructive");
    expect(decisionTone("REFER")).toBe("warning");
    expect(scoreTone(820)).toBe("success");
    expect(scoreTone(590)).toBe("destructive");
    expect(scoreTone(null)).toBe("muted");
  });
});
