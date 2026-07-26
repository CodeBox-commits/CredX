from __future__ import annotations

from fastapi import APIRouter

from ...schemas.platform import CreditDecisionResponse, UnderwritingRequest
from ...scoring.decision_logic.engine import build_credit_decision

router = APIRouter()


@router.post("/score", response_model=CreditDecisionResponse)
def score_underwriting(request: UnderwritingRequest) -> CreditDecisionResponse:
    return build_credit_decision(
        company_name=request.company_name,
        sector=request.sector,
        requested_amount=request.requested_amount,
        extracted=request.extracted,
        research=request.research,
        fraud=request.fraud,
        analyst_note=request.analyst_note,
    )
