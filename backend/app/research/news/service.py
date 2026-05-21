from __future__ import annotations


def build_news_briefs(company_name: str, sector: str, promoter_names: list[str]) -> list[dict[str, str]]:
    promoter_phrase = promoter_names[0] if promoter_names else f"{company_name} promoters"
    return [
        {
            "source": "News Watch",
            "detail": f"{company_name} remains exposed to sector sentiment shifts in {sector.lower()}.",
        },
        {
            "source": "Promoter Watch",
            "detail": f"{promoter_phrase} should be checked for governance, dilution, and related-party headlines.",
        },
    ]
