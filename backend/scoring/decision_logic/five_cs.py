"""Five Cs of Credit (character, capacity, capital, collateral, conditions) scored 0–100.

Each C aggregates the SHAP points of the model features mapped to it plus the qualitative overlays
tagged with it, so the Five Cs view is a re-cut of the same explanation — never a separate opinion.
"""

from __future__ import annotations

from typing import Any

TITLES = {"character": "Character", "capacity": "Capacity", "capital": "Capital", "collateral": "Collateral",
          "conditions": "Conditions"}


def build_five_cs(contributions: list[dict[str, Any]], overlays: list[dict[str, Any]], ctx: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    application = ctx.get("application") or {}
    for key, title in TITLES.items():
        mine = [c for c in contributions if c["five_c"] == key and not c["missing"]]
        notes = [o for o in overlays if o.get("five_c") == key]
        model_points = sum(c["points"] for c in mine)
        overlay_points = sum(o["points"] for o in notes)
        score = int(round(max(5, min(98, 60 + 0.35 * model_points + 0.45 * overlay_points))))
        evidence = [c["description"] for c in sorted(mine, key=lambda c: -abs(c["points_exact"]))[:3]]
        evidence += [f"{o['label']} ({o['points']:+d} pts)" for o in notes[:2]]
        if key == "collateral" and application.get("collateral_type"):
            evidence.append(f"Offered: {application['collateral_type']}")
        band = "Strong" if score >= 72 else "Adequate" if score >= 55 else "Weak"
        lead = evidence[0] if evidence else "Limited information available"
        lead = lead if len(lead) > 1 and lead[1].isupper() else lead[:1].lower() + lead[1:]
        out[key] = {"title": title, "score": score, "assessment": f"{band} — {lead}",
                    "model_points": model_points, "overlay_points": overlay_points, "evidence": evidence or [lead]}
    return out
