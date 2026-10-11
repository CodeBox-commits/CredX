// Decision bands — mirror backend/scoring/inference/engine.py (APPROVE_FLOOR, REFER_CEILING, DECLINE_FLOOR).
import type { Decision } from "@/types/api";

export const APPROVE_FLOOR = 700;
export const CONDITIONS_FLOOR = 660;
export const DECLINE_FLOOR = 600;

/** Same order of checks as the engine: knock-outs, decline floor, referral band, conditions, clean approval. */
export function decide(score: number, opts: { knockouts?: number; deviations?: number; severeOverlay?: boolean } = {}): Decision {
  const { knockouts = 0, deviations = 0, severeOverlay = false } = opts;
  if (knockouts > 0 || score < DECLINE_FLOOR) return "DECLINE";
  if (score < CONDITIONS_FLOOR || deviations >= 3 || severeOverlay) return "REFER";
  if (deviations > 0 || score < APPROVE_FLOOR) return "APPROVE_WITH_CONDITIONS";
  return "APPROVE";
}
