from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database.session import get_db_session
from ...models import UnderwritingCase
from ...research.summarization.service import build_research_intelligence
from ...schemas.platform import (
    ResearchIntelligenceRequest,
    ResearchIntelligenceResponse,
)
from ...schemas.uploads import StructuredExtraction

router = APIRouter()


@router.post("/intelligence", response_model=ResearchIntelligenceResponse)
def research_intelligence(
    request: ResearchIntelligenceRequest,
) -> ResearchIntelligenceResponse:
    return build_research_intelligence(request)


@router.post("/run", response_model=ResearchIntelligenceResponse)
def run_research(
    request: ResearchIntelligenceRequest,
) -> ResearchIntelligenceResponse:
    return build_research_intelligence(request)


@router.get("/{case_id}", response_model=ResearchIntelligenceResponse)
def get_case_research(
    case_id: str,
    db: Session = Depends(get_db_session),
) -> ResearchIntelligenceResponse:
    case = db.get(UnderwritingCase, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")

    latest_snapshot = case.snapshots[0] if case.snapshots else None
    if latest_snapshot is None or not latest_snapshot.research_json:
        raise HTTPException(status_code=404, detail="Research not yet generated for this case.")

    return ResearchIntelligenceResponse.model_validate(latest_snapshot.research_json)


@router.post("/{case_id}/refresh", response_model=ResearchIntelligenceResponse)
def refresh_case_research(
    case_id: str,
    db: Session = Depends(get_db_session),
) -> ResearchIntelligenceResponse:
    case = db.get(UnderwritingCase, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")

    latest_snapshot = case.snapshots[0] if case.snapshots else None
    extracted = None
    if latest_snapshot and latest_snapshot.extracted_json:
        extracted = StructuredExtraction.model_validate(latest_snapshot.extracted_json)

    response = build_research_intelligence(
        ResearchIntelligenceRequest(
            company_name=case.company.name,
            sector=case.company.sector or "General",
            promoter_names=[],
            analyst_note=case.due_diligence_note,
            extracted=extracted,
        )
    )

    if latest_snapshot is not None:
        latest_snapshot.research_json = response.model_dump(mode="json")
        db.commit()

    return response
