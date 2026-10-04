from __future__ import annotations

import json
from pathlib import Path


DEMO_CASES = [
    {
        "case_id": "sunline-stable",
        "company_name": "Sunline Industrial Components Pvt Ltd",
        "sector": "Manufacturing",
        "requested_amount": 18_000_000,
        "analyst_note": "Collections stable and promoter access appears orderly, though working-capital discipline should still be monitored.",
        "extracted": {
            "company_name": "Sunline Industrial Components Pvt Ltd",
            "gst_number": "29ABCDE1234F1Z5",
            "revenue": 124_000_000,
            "ebitda": 15_400_000,
            "debt": 41_500_000,
            "financial_health": "STRONG",
            "confidence_score": 0.88,
            "risk_indicators": ["GST mismatch"],
        },
    },
    {
        "case_id": "nebula-stressed",
        "company_name": "Nebula Buildmart Limited",
        "sector": "Infrastructure",
        "requested_amount": 32_000_000,
        "analyst_note": "Factory operating at 40% capacity with inventory pile-up and legal follow-up from a trade creditor.",
        "extracted": {
            "company_name": "Nebula Buildmart Limited",
            "gst_number": "27ABCDE1234F1Z5",
            "revenue": 96_000_000,
            "ebitda": 6_800_000,
            "debt": 72_000_000,
            "financial_health": "STRESSED",
            "confidence_score": 0.81,
            "risk_indicators": ["Litigation reference", "Liquidity stress", "Promoter linkage"],
        },
    },
]


def main() -> None:
    output_dir = Path("backend/storage/demo")
    output_dir.mkdir(parents=True, exist_ok=True)

    for case in DEMO_CASES:
        target = output_dir / f"{case['case_id']}.json"
        target.write_text(json.dumps(case, indent=2), encoding="utf-8")
        print(f"seeded {target}")


if __name__ == "__main__":
    main()
