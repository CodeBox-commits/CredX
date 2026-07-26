from __future__ import annotations

from ...schemas.platform import CamPreviewRequest, CamPreviewResponse, CamSection
from ..formatting.presenter import format_inr


def build_cam_preview(request: CamPreviewRequest) -> CamPreviewResponse:
    decision = request.decision
    extracted = request.extracted
    research = request.research
    fraud = request.fraud

    sections = [
        CamSection(
            title="Executive Summary",
            content=(
                f"{request.company_name} is being assessed in {request.sector}. "
                f"CredX recommends {decision.decision.lower() if decision else 'further review'} "
                f"for a requested exposure of {format_inr(request.requested_amount)}."
            ),
        ),
        CamSection(
            title="Borrower and Financial Snapshot",
            content=(
                f"Revenue: {format_inr(extracted.revenue if extracted else None)} | "
                f"Debt: {format_inr(extracted.debt if extracted else None)} | "
                f"Financial health: {extracted.financial_health if extracted else 'UNKNOWN'}."
            ),
        ),
        CamSection(
            title="Research Intelligence",
            content=research.summary if research else "Secondary research has not been attached yet.",
        ),
        CamSection(
            title="Fraud and Compliance Observations",
            content=fraud.summary if fraud else "No fraud graph or GST anomaly report attached yet.",
        ),
        CamSection(
            title="Recommendation Logic",
            content=(
                decision.pricing_rationale
                if decision
                else "Decisioning engine has not yet produced a recommendation trace."
            ),
        ),
        CamSection(
            title="Analyst Commentary",
            content=request.analyst_note or "No analyst override captured for this case.",
        ),
    ]

    summary = (
        f"CAM preview prepared for {request.company_name} with "
        f"{'decision trace and supporting intelligence.' if decision else 'upstream sections awaiting scoring.'}"
    )

    return CamPreviewResponse(
        sections=sections,
        export_formats=["pdf", "docx"],
        summary=summary,
    )
